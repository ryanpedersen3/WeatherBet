import { httpServerHandler } from "cloudflare:node";
import express from "express";
import { getUpcomingGames, formatGameInfo } from "./nfl.js";
import { getWeatherForLocation, formatWeatherInfo } from "./weather.js";
import {
  sendMessageToAgent,
  handshakeWithAgent,
  generateMessageId,
  createChatPayload,
  createTaskPayload,
  type A2AMessage,
} from "./agent-comm.js";
import {
  getGamesByDateRange,
  getGamesBySeasonWeek,
  getGamesByTeam,
  getGamesBySeason,
  getGameStats,
} from "./database.js";
import {
  populateDatabase,
  populateSeason,
  populateWeek,
} from "./populate-db.js";
import { processChat, type ChatMessage } from "./chatbot.js";

const app = express();
app.use(express.json());

// Store env at module level to be accessed by middleware
// This will be set by the fetch handler before requests are processed
let workerEnv: { [key: string]: any } | null = null;

// Symbol for attaching env to request object
const ENV_SYMBOL = Symbol('workerEnv');

// Global variable approach (as last resort)
declare global {
  var __WORKER_ENV__: { [key: string]: any } | null | undefined;
}

// Extend Express Request to include env and DB for Cloudflare Workers
declare global {
  namespace Express {
    interface Request {
      env?: { [key: string]: any };
      db?: D1Database;
    }
  }
}

/**
 * -----------------------
 * Middleware to access environment variables and database
 * In Cloudflare Workers, env is available at the handler level
 * httpServerHandler should inject env into req.env, but we also check module-level storage
 * This MUST be before route handlers to ensure req.env is available
 * -----------------------
 */
// Middleware to inject env into req.env
// This is CRITICAL - it must run before any route handlers that need DB access
app.use((req: any, _res, next) => {
  // Strategy: Try ALL possible sources for env
  const env = workerEnv || req.app?.locals?.env || (globalThis as any).__WORKER_ENV__ || req.env;
  
  if (env) {
    req.env = env;
    // Also attach to request object via Symbol for extra safety
    req[ENV_SYMBOL] = env;
  } else if (!req.env) {
    req.env = {} as { [key: string]: any };
  }
  
  // Ensure DB is available from any source (try all possible locations)
  const dbSource = env?.DB || workerEnv?.DB || req.app?.locals?.env?.DB || (globalThis as any).__WORKER_ENV__?.DB;
  if (dbSource && req.env) {
    req.env.DB = dbSource;
  }
  
  next();
});

/**
 * -----------------------
 * Health check
 * -----------------------
 */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "weatherbet",
    time: new Date().toISOString(),
  });
});

/**
 * -----------------------
 * A2A: Handshake
 * Advertises agent identity & capabilities
 * -----------------------
 */
app.get("/api/agent/handshake", (_req, res) => {
  res.json({
    agent: "weatherbet",
    version: "0.1.0",
    description: "WeatherBet agent - Provides NFL game weather information and can communicate with other agents",
    capabilities: {
      accepts: ["chat", "task", "event"],
      provides: [
        "nfl_game_weather",
        "upcoming_games",
        "weather_forecast",
        "agent_communication",
      ],
      routes: {
        handshake: "/api/agent/handshake",
        message: "/api/agent/message",
        respond: "/api/agent/respond",
        games: "/api/nfl/games",
        weather: "/api/nfl/weather",
      },
    },
    time: new Date().toISOString(),
  });
});

/**
 * -----------------------
 * A2A: Message handling
 * -----------------------
 */

app.post("/api/agent/message", async (req, res) => {
  const msg = req.body as Partial<A2AMessage>;
  const env = req.env || {};

  // Minimal validation
  if (
    !msg.message_id ||
    !msg.from ||
    !msg.to ||
    !msg.type ||
    !msg.timestamp
  ) {
    return res.status(400).json({
      ok: false,
      error: "Invalid A2A message envelope",
      required: [
        "message_id",
        "from",
        "to",
        "type",
        "timestamp",
        "payload",
      ],
    });
  }

  try {
    // Process different message types
    if (msg.type === "chat") {
      const response = await handleChatMessage(msg, env);
      return res.json({
        ok: true,
        received: msg,
        reply: response,
        ack: {
          status: "processed",
          at: Date.now(),
        },
      });
    } else if (msg.type === "task") {
      const result = await handleTaskMessage(msg, env);
      return res.json({
        ok: true,
        received: msg,
        result,
        ack: {
          status: "completed",
          at: Date.now(),
        },
      });
    } else {
      // For event type, just acknowledge
      return res.json({
        ok: true,
        received: msg,
        ack: {
          status: "accepted",
          at: Date.now(),
        },
      });
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      received: msg,
    });
  }
});

/**
 * -----------------------
 * Handle chat messages
 * -----------------------
 */
async function handleChatMessage(
  msg: Partial<A2AMessage>,
  env: { [key: string]: any }
): Promise<string> {
  if (!msg.payload || typeof msg.payload !== "object" || msg.payload === null) {
    return "I received your message, but no payload was found.";
  }

  const payload = msg.payload as any;
  const text = payload.text || "";

  // Check if this is a request for NFL weather information
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes("nfl") ||
    lowerText.includes("football") ||
    lowerText.includes("game") ||
    lowerText.includes("weather")
  ) {
    try {
      const games = await getUpcomingGames(0);
      const gamesWithWeather = await Promise.all(
        games.map(async (game) => {
          const weather = await getWeatherForLocation(
            game.location.lat,
            game.location.lon,
            game.date,
            env
          );
          return {
            game,
            weather,
          };
        })
      );

      let response = "Here are the upcoming NFL games with weather:\n\n";
      gamesWithWeather.forEach(({ game, weather }) => {
        response += formatGameInfo(game) + "\n";
        response += formatWeatherInfo(weather, `${game.city}, ${game.state}`) + "\n\n";
      });

      return response.trim();
    } catch (error) {
      return `I encountered an error while fetching NFL weather data: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Check if message contains a request to contact another agent
  if (lowerText.includes("send to") || lowerText.includes("contact agent") || lowerText.includes("talk to")) {
    // Extract agent URL from payload if provided
    const targetAgentUrl = payload.targetAgentUrl;
    if (targetAgentUrl && typeof targetAgentUrl === "string") {
      try {
        const messageId = generateMessageId();
        const chatPayload = createChatPayload(
          `Hello from WeatherBet agent! ${text}`,
          { source: "weatherbet" }
        );
        
        const result = await sendMessageToAgent(
          targetAgentUrl,
          {
            message_id: messageId,
            from: "weatherbet",
            to: targetAgentUrl,
            type: "chat",
            payload: chatPayload,
          },
          env
        );

        if (result.ok) {
          return `Message sent to agent at ${targetAgentUrl}. Response: ${JSON.stringify(result.response)}`;
        } else {
          return `Failed to send message to agent: ${result.error}`;
        }
      } catch (error) {
        return `Error communicating with other agent: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }

  return `I'm the WeatherBet agent. I can provide weather information for upcoming NFL games. Ask me about "NFL games" or "football weather" to get started. I can also send messages to other agents if you provide a targetAgentUrl in the payload.`;
}

/**
 * -----------------------
 * Handle task messages
 * -----------------------
 */
async function handleTaskMessage(
  msg: Partial<A2AMessage>,
  env: { [key: string]: any }
): Promise<any> {
  if (!msg.payload || typeof msg.payload !== "object" || msg.payload === null) {
    return { error: "No task payload found" };
  }

  const payload = msg.payload as any;
  const task = payload.task || "";

  switch (task) {
    case "get_nfl_weather":
    case "get_upcoming_games": {
      const weekOffset = payload.parameters?.weekOffset || 0;
      const games = await getUpcomingGames(weekOffset);
      const gamesWithWeather = await Promise.all(
        games.map(async (game) => {
          const weather = await getWeatherForLocation(
            game.location.lat,
            game.location.lon,
            game.date,
            env
          );
          return {
            game,
            weather,
          };
        })
      );

      return {
        success: true,
        games: gamesWithWeather.map(({ game, weather }) => ({
          gameId: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          date: game.date,
          time: game.time,
          location: `${game.city}, ${game.state}`,
          weather: {
            temperature: weather.temperature,
            condition: weather.condition,
            description: weather.description,
            windSpeed: weather.windSpeed,
            humidity: weather.humidity,
          },
        })),
      };
    }

    case "get_weather_for_location": {
      const { lat, lon, date } = payload.parameters || {};
      if (!lat || !lon || !date) {
        return {
          error: "Missing required parameters: lat, lon, date",
        };
      }

      const weather = await getWeatherForLocation(lat, lon, date, env);
      return {
        success: true,
        weather,
      };
    }

    case "send_message_to_agent": {
      const { targetAgentUrl, messageText, messageType } = payload.parameters || {};
      if (!targetAgentUrl) {
        return {
          error: "Missing required parameter: targetAgentUrl",
        };
      }

      try {
        const messageId = generateMessageId();
        const messageTypeVal = (messageType || "chat") as "chat" | "task" | "event";
        const messagePayload = messageTypeVal === "chat"
          ? createChatPayload(messageText || "Hello from WeatherBet agent")
          : messageTypeVal === "task"
          ? createTaskPayload(messageText || "get_data")
          : { data: messageText || "Event from WeatherBet agent" };

        const result = await sendMessageToAgent(
          targetAgentUrl,
          {
            message_id: messageId,
            from: "weatherbet",
            to: targetAgentUrl,
            type: messageTypeVal,
            payload: messagePayload,
          },
          env
        );

        return {
          success: result.ok,
          result: result.response,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    case "handshake_with_agent": {
      const { targetAgentUrl } = payload.parameters || {};
      if (!targetAgentUrl) {
        return {
          error: "Missing required parameter: targetAgentUrl",
        };
      }

      try {
        const result = await handshakeWithAgent(targetAgentUrl, env);
        return {
          success: result.ok,
          handshake: result.handshake,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    default:
      return {
        error: `Unknown task: ${task}`,
        availableTasks: [
          "get_nfl_weather",
          "get_upcoming_games",
          "get_weather_for_location",
          "send_message_to_agent",
          "handshake_with_agent",
        ],
      };
  }
}

/**
 * -----------------------
 * NFL Games endpoint
 * -----------------------
 */
app.get("/api/nfl/games", async (req, res) => {
  try {
    const weekOffset = parseInt(req.query.weekOffset as string) || 0;
    const games = await getUpcomingGames(weekOffset);
    res.json({
      ok: true,
      games,
      count: games.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * -----------------------
 * NFL Weather endpoint
 * -----------------------
 */
app.get("/api/nfl/weather", async (req, res) => {
  try {
    const weekOffset = parseInt(req.query.weekOffset as string) || 0;
    const env = req.env || {};
    const games = await getUpcomingGames(weekOffset);

    const gamesWithWeather = await Promise.all(
      games.map(async (game) => {
        const weather = await getWeatherForLocation(
          game.location.lat,
          game.location.lon,
          game.date,
          env
        );
        return {
          game,
          weather,
        };
      })
    );

    res.json({
      ok: true,
      games: gamesWithWeather,
      count: gamesWithWeather.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * -----------------------
 * A2A: Respond handling
 * -----------------------
 */
app.post("/api/agent/respond", async (req, res) => {
  const msg = req.body as Partial<A2AMessage>;
  const env = req.env || {};

  // Minimal validation (same as /api/agent/message)
  if (
    !msg.message_id ||
    !msg.from ||
    !msg.to ||
    !msg.type ||
    !msg.timestamp
  ) {
    return res.status(400).json({
      ok: false,
      error: "Invalid A2A message envelope",
      required: [
        "message_id",
        "from",
        "to",
        "type",
        "timestamp",
        "payload",
      ],
    });
  }

  // Process the message and generate a response
  let reply: string;
  if (msg.type === "chat") {
    reply = await handleChatMessage(msg, env);
  } else {
    // Extract a natural-language reply from payload.text if present
    if (
      msg.payload &&
      typeof msg.payload === "object" &&
      msg.payload !== null &&
      "text" in msg.payload &&
      typeof (msg.payload as any).text === "string"
    ) {
      reply = `Received your message: "${(msg.payload as any).text}"`;
    } else {
      reply = "Message received, but no text payload was found.";
    }
  }

  return res.json({
    ok: true,
    reply,
    received: msg,
    at: Date.now(),
  });
});

/**
 * -----------------------
 * Database API Endpoints
 * -----------------------
 */

/**
 * Test endpoint to debug env access
 */
app.get("/api/debug/env", async (req, res) => {
  const reqAny = req as any;
  return res.json({
    hasReqEnv: !!req.env,
    reqEnvKeys: req.env ? Object.keys(req.env) : [],
    hasReqEnvDB: !!req.env?.DB,
    hasWorkerEnv: !!workerEnv,
    hasWorkerEnvDB: !!workerEnv?.DB,
    workerEnvKeys: workerEnv ? Object.keys(workerEnv) : [],
    hasAppLocalsEnv: !!req.app?.locals?.env,
    hasGlobalEnv: !!(globalThis as any).__WORKER_ENV__,
    hasSymbol: !!reqAny[ENV_SYMBOL],
  });
});

/**
 * Get database statistics
 */
app.get("/api/db/stats", async (req, res) => {
  try {
    // Access DB from environment (Cloudflare Workers binding)
    // Try multiple ways to access DB binding (try ALL possible sources)
    const reqAny = req as any;
    const db = (req.env?.DB || workerEnv?.DB || reqAny[ENV_SYMBOL]?.DB || req.app?.locals?.env?.DB || (globalThis as any).__WORKER_ENV__?.DB) as D1Database | undefined;
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database not available. Make sure D1 database is configured. Run 'wrangler d1 create nfl-games-db' and update wrangler.jsonc",
      });
    }

    const stats = await getGameStats(db);
    res.json({
      ok: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get games by date range
 */
app.get("/api/db/games", async (req, res) => {
  try {
    // Try multiple ways to access DB binding (try ALL possible sources)
    const reqAny = req as any;
    const db = (req.env?.DB || workerEnv?.DB || reqAny[ENV_SYMBOL]?.DB || req.app?.locals?.env?.DB || (globalThis as any).__WORKER_ENV__?.DB) as D1Database | undefined;
    
    if (!db) {
      // Return empty array instead of 503 for better UX in development
      return res.json({
        ok: true,
        games: [],
        count: 0,
        warning: "Database not configured. To set up the database, run 'wrangler d1 create nfl-games-db' and update wrangler.jsonc",
        debug: {
          hasReqEnv: !!req.env,
          hasWorkerEnv: !!workerEnv,
        }
      });
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const season = req.query.season ? parseInt(req.query.season as string) : undefined;
    const week = req.query.week ? parseInt(req.query.week as string) : undefined;
    const team = req.query.team as string | undefined;

    let games;
    try {
      if (team) {
        games = await getGamesByTeam(db, team, 100);
      } else if (season && week) {
        games = await getGamesBySeasonWeek(db, season, week);
      } else if (season) {
        games = await getGamesBySeason(db, season);
      } else if (startDate && endDate) {
        games = await getGamesByDateRange(db, startDate, endDate);
      } else {
        return res.status(400).json({
          ok: false,
          error: "Please provide date range (startDate, endDate), season/week, or team parameter",
        });
      }

      res.json({
        ok: true,
        games: games || [],
        count: games?.length || 0,
      });
    } catch (dbError) {
      // Catch database errors specifically
      console.error('Database query error:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      
      // Check if it's a table not found error
      if (errorMessage.includes('no such table') || errorMessage.includes('SQLITE_ERROR')) {
        return res.status(500).json({
          ok: false,
          error: errorMessage,
          hint: "The database table might not exist. Try: wrangler d1 migrations apply nfl-games-db --remote",
        });
      }
      
      // Re-throw to be caught by outer catch
      throw dbError;
    }
  } catch (error) {
    console.error('Error in /api/db/games endpoint:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Populate database with historical games
 */
app.post("/api/db/populate", async (req, res) => {
  try {
    // Try to get DB from multiple sources
    // Try multiple ways to access DB binding (try ALL possible sources)
    const reqAny = req as any;
    const db = (req.env?.DB || workerEnv?.DB || reqAny[ENV_SYMBOL]?.DB || req.app?.locals?.env?.DB || (globalThis as any).__WORKER_ENV__?.DB) as D1Database | undefined;
    if (!db) {
      // Log for debugging
      console.error("DB not available:", {
        hasReqEnv: !!req.env,
        hasReqEnvDB: !!req.env?.DB,
        hasWorkerEnv: !!workerEnv,
        hasWorkerEnvDB: !!workerEnv?.DB,
      });
      return res.status(503).json({
        ok: false,
        error: "Database not available. Make sure D1 database is configured.",
        debug: {
          hasReqEnv: !!req.env,
          hasWorkerEnv: !!workerEnv,
        }
      });
    }

    const { years, season, week } = req.body;

    let result;
    if (years) {
      // Populate last N years
      result = await populateDatabase(db, years, req.env || {});
    } else if (season && week) {
      // Populate specific season and week
      result = await populateWeek(db, season, week, req.env || {});
    } else if (season) {
      // Populate entire season
      result = await populateSeason(db, season, req.env || {});
    } else {
      return res.status(400).json({
        ok: false,
        error: "Please provide 'years', 'season', or 'season' and 'week' in request body",
      });
    }

    res.json({
      ok: true,
      result,
      message: `Database population completed: ${result.success} games inserted, ${result.errors} errors`,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * -----------------------
 * AI Chatbot Endpoint
 * -----------------------
 * Natural language search of historical NFL data
 */
app.post("/api/chat", async (req, res) => {
  try {
    const reqAny = req as any;
    const db = (req.env?.DB || workerEnv?.DB || reqAny[ENV_SYMBOL]?.DB || req.app?.locals?.env?.DB || (globalThis as any).__WORKER_ENV__?.DB) as D1Database | undefined;
    
    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "Database not available. Make sure D1 database is configured.",
      });
    }

    const { message, history } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        ok: false,
        error: "Please provide a 'message' string in the request body",
      });
    }

    // Get OpenAI API key from environment
    const openaiApiKey = req.env?.OPENAI_API_KEY || workerEnv?.OPENAI_API_KEY || '';
    
    const result = await processChat(
      db,
      message,
      openaiApiKey,
      history as ChatMessage[] || []
    );

    res.json({
      ok: true,
      response: result.response,
      games: result.games || [],
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * -----------------------
 * Express → Worker bridge
 * -----------------------
 * Use httpServerHandler with env storage for middleware access
 */
app.listen(3000);

const handler = httpServerHandler({ port: 3000 });

export default {
  fetch: async (request: Request, env: any, ctx: ExecutionContext): Promise<Response> => {
    // Store env - middleware will use this if req.env isn't set
    workerEnv = env;
    // @ts-expect-error - handler.fetch exists
    return handler.fetch(request, env, ctx);
  }
};
