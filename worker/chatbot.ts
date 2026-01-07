/**
 * NFL Data Chatbot - OpenAI-powered natural language search
 */

// Types for OpenAI API
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

// System prompt that explains the database schema and capabilities
const SYSTEM_PROMPT = `You are an NFL data analyst assistant. You help users query and analyze historical NFL game data.

You have access to a database with HISTORICAL NFL game data containing:
- season_year: The NFL season year (e.g., 2023, 2024, 2025)
- week_number: The week of the season (1-18 for regular season)
- game_date: The date of the game
- home_team: Home team name
- away_team: Away team name
- home_score: Home team's final score
- away_score: Away team's final score
- spread: The betting spread (negative means home team favored)
- over_under: The over/under betting line
- stadium: Stadium name
- weather_temperature: Temperature in Fahrenheit
- weather_humidity: Humidity percentage
- weather_wind_speed: Wind speed in mph
- weather_description: Weather conditions (e.g., "indoor", "clear", "rain")

The database contains COMPLETED games from multiple seasons (2019-2025) with scores, weather, and betting data.

When answering questions:
1. Be concise and direct
2. Use the actual data provided to you
3. Format numbers nicely (scores, percentages, etc.)
4. If data is missing or unavailable, say so
5. Highlight interesting patterns or insights
6. Suggest follow-up questions users might find interesting

Remember: This is HISTORICAL data with final scores, not current/upcoming games.`;

// Function to generate SQL query from natural language
function generateSQLFromQuery(userQuery: string): string {
  const query = userQuery.toLowerCase();
  
  // Database statistics queries
  if (query.includes('how many') || query.includes('total games') || query.includes('count')) {
    return `SELECT COUNT(*) as total, 
            MIN(season_year) as first_season, 
            MAX(season_year) as last_season,
            COUNT(DISTINCT season_year) as seasons
            FROM nfl_games`;
  }
  
  // Common patterns and their SQL translations
  if (query.includes('highest scoring') || query.includes('most points') || query.includes('high score')) {
    return `SELECT *, (home_score + away_score) as total_points 
            FROM nfl_games 
            WHERE home_score IS NOT NULL AND away_score IS NOT NULL
            ORDER BY total_points DESC LIMIT 15`;
  }
  
  if (query.includes('biggest upset') || query.includes('largest upset')) {
    return `SELECT *, ABS(home_score - away_score) as margin, spread
            FROM nfl_games 
            WHERE spread IS NOT NULL AND home_score IS NOT NULL
            ORDER BY ABS((home_score - away_score) + spread) DESC LIMIT 10`;
  }
  
  if (query.includes('coldest') || query.includes('cold weather')) {
    return `SELECT * FROM nfl_games 
            WHERE weather_temperature IS NOT NULL 
            ORDER BY weather_temperature ASC LIMIT 10`;
  }
  
  if (query.includes('hottest') || query.includes('hot weather')) {
    return `SELECT * FROM nfl_games 
            WHERE weather_temperature IS NOT NULL 
            ORDER BY weather_temperature DESC LIMIT 10`;
  }
  
  if (query.includes('overtime') || query.includes('tied')) {
    return `SELECT * FROM nfl_games 
            WHERE home_score = away_score AND home_score IS NOT NULL
            LIMIT 20`;
  }
  
  if (query.includes('blowout') || query.includes('biggest win')) {
    return `SELECT *, ABS(home_score - away_score) as margin 
            FROM nfl_games 
            WHERE home_score IS NOT NULL
            ORDER BY margin DESC LIMIT 10`;
  }
  
  // Week and season specific queries (check first before season-only)
  const weekMatch = query.match(/week\s*(\d+)/i);
  const yearMatch = query.match(/20\d{2}/);
  
  if (weekMatch && yearMatch) {
    // Both week and year specified
    const week = weekMatch[1];
    const year = yearMatch[0];
    return `SELECT * FROM nfl_games 
            WHERE week_number = ${week} AND season_year = ${year}
            ORDER BY game_date LIMIT 50`;
  }
  
  if (weekMatch) {
    // Just week specified
    const week = weekMatch[1];
    return `SELECT * FROM nfl_games 
            WHERE week_number = ${week}
            ORDER BY season_year DESC, game_date LIMIT 50`;
  }
  
  // Team-specific queries
  const teams = [
    'chiefs', 'eagles', 'bills', 'cowboys', 'ravens', '49ers', 'niners',
    'dolphins', 'lions', 'packers', 'jets', 'giants', 'patriots', 'bengals',
    'browns', 'steelers', 'raiders', 'chargers', 'broncos', 'texans', 'colts',
    'titans', 'jaguars', 'seahawks', 'cardinals', 'rams', 'saints', 'falcons',
    'panthers', 'buccaneers', 'bucs', 'bears', 'vikings', 'commanders', 'washington'
  ];
  
  for (const team of teams) {
    if (query.includes(team)) {
      const teamPattern = `%${team}%`;
      return `SELECT * FROM nfl_games 
              WHERE LOWER(home_team) LIKE '${teamPattern}' OR LOWER(away_team) LIKE '${teamPattern}'
              ORDER BY game_date DESC LIMIT 20`;
    }
  }
  
  // Season-specific queries (only if no week mentioned)
  if (yearMatch) {
    const year = yearMatch[0];
    return `SELECT * FROM nfl_games 
            WHERE season_year = ${year}
            ORDER BY week_number, game_date LIMIT 50`;
  }
  
  // Default: show games from all seasons
  return `SELECT * FROM nfl_games 
          ORDER BY season_year DESC, week_number DESC, game_date DESC LIMIT 50`;
}

// Format game data for display
function formatGameData(games: any[]): string {
  if (!games || games.length === 0) {
    return 'No games found matching your query.';
  }
  
  // Check if this is a COUNT query result
  if (games.length === 1 && 'total' in games[0]) {
    const stats = games[0];
    return `Database Statistics:
- Total games: ${stats.total}
- Seasons: ${stats.first_season} to ${stats.last_season} (${stats.seasons} seasons)`;
  }
  
  const formatted = games.slice(0, 10).map((g, i) => {
    const date = g.game_date ? new Date(g.game_date).toLocaleDateString() : 'Unknown date';
    const score = g.home_score !== null ? `${g.away_score}-${g.home_score}` : 'TBD';
    const season = g.season_year ? `${g.season_year}` : '';
    const week = g.week_number ? `Week ${g.week_number}` : '';
    const weather = g.weather_temperature ? `${g.weather_temperature}°F` : '';
    const spread = g.spread ? `spread: ${g.spread > 0 ? '+' : ''}${g.spread}` : '';
    const totalPoints = g.total_points ? `Total: ${g.total_points}` : '';
    const margin = g.margin ? `Margin: ${g.margin}` : '';
    
    const extras = [season, week, totalPoints, margin, weather, spread].filter(x => x).join(' | ');
    
    return `${i + 1}. ${g.away_team} @ ${g.home_team}: ${score} - ${date}${extras ? ' | ' + extras : ''}`.trim();
  }).join('\n');
  
  const moreGames = games.length > 10 ? `\n\n...and ${games.length - 10} more games` : '';
  
  return formatted + moreGames;
}

// Main chat function
export async function processChat(
  db: D1Database,
  userMessage: string,
  openaiApiKey: string,
  conversationHistory: ChatMessage[] = []
): Promise<{ response: string; games?: any[] }> {
  
  if (!openaiApiKey) {
    return {
      response: "⚠️ OpenAI API key not configured. Please set the OPENAI_API_KEY secret:\n\n```\nwrangler secret put OPENAI_API_KEY\n```\n\nFor now, I can still help with basic queries using pattern matching."
    };
  }
  
  try {
    // First, query the database based on the user's question
    const sql = generateSQLFromQuery(userMessage);
    const result = await db.prepare(sql).all();
    const games = result.results || [];
    
    // Get database statistics for context
    const statsResult = await db.prepare(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT season_year) as seasons,
             MIN(season_year) as first_season,
             MAX(season_year) as last_season,
             COUNT(DISTINCT CASE WHEN season_year = 2025 THEN week_number END) as weeks_2025
      FROM nfl_games
    `).first();
    
    const dbStats = statsResult || { total: 0, seasons: 0, first_season: 0, last_season: 0, weeks_2025: 0 };
    
    // Format the data for the AI
    const dataContext = games.length > 0 
      ? `\n\nDatabase contains: ${dbStats.total} total games from ${dbStats.first_season}-${dbStats.last_season} (${dbStats.seasons} seasons). 2025 season has all ${dbStats.weeks_2025} weeks of data.\n\nHere is the relevant data from your query:\n${formatGameData(games)}\n\nTotal matching games: ${games.length}`
      : '\n\nNo matching data found in the database.';
    
    // Build messages for OpenAI
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + dataContext },
      ...conversationHistory.slice(-6), // Keep last 6 messages for context
      { role: 'user', content: userMessage }
    ];
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });
    
    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      
      // Fallback to pattern-based response
      return {
        response: `Here's what I found:\n\n${formatGameData(games)}\n\n(AI analysis unavailable - using basic data display)`,
        games: games as any[]
      };
    }
    
    const aiData = await openaiResponse.json() as OpenAIResponse;
    const aiResponse = aiData.choices?.[0]?.message?.content || 'Unable to generate response.';
    
    return {
      response: aiResponse,
      games: games as any[]
    };
    
  } catch (error) {
    console.error('Chat processing error:', error);
    
    // Try to still provide some data even if AI fails
    try {
      const sql = generateSQLFromQuery(userMessage);
      const result = await db.prepare(sql).all();
      const games = result.results || [];
      
      return {
        response: `I encountered an error with the AI, but here's the data I found:\n\n${formatGameData(games)}`,
        games: games as any[]
      };
    } catch (dbError) {
      return {
        response: `Sorry, I encountered an error processing your request. Please try again.`
      };
    }
  }
}

// Export types for use in routes
export type { ChatMessage };

