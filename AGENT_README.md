# WeatherBet Agent - NFL Weather Agent

This agent provides weather information for upcoming NFL football games and can communicate with other agents using the A2A (Agent-to-Agent) protocol.

## Features

### 1. NFL Game Weather Information
- Fetches upcoming NFL games
- Gets weather forecasts for game locations
- Provides detailed weather information including temperature, conditions, wind, and humidity

### 2. Agent Communication
- Can send messages to other agents
- Supports handshake protocol for discovering agent capabilities
- Handles chat, task, and event message types

## API Endpoints

### Agent Endpoints

#### `GET /api/agent/handshake`
Returns agent capabilities and metadata.

#### `POST /api/agent/message`
Receives messages from other agents. Supports:
- `chat`: Natural language messages
- `task`: Structured task requests
- `event`: Event notifications

#### `POST /api/agent/respond`
Alternative endpoint for agent responses.

### NFL Weather Endpoints

#### `GET /api/nfl/games?weekOffset=0`
Returns upcoming NFL games. The `weekOffset` parameter specifies how many weeks ahead (0 = this week).

#### `GET /api/nfl/weather?weekOffset=0`
Returns upcoming NFL games with weather information.

## Usage Examples

### Chat Messages

Send a chat message to request NFL weather:

```json
{
  "message_id": "msg_123",
  "from": "another-agent",
  "to": "weatherbet",
  "type": "chat",
  "timestamp": 1234567890,
  "payload": {
    "text": "What's the weather for upcoming NFL games?"
  }
}
```

### Task Messages

Request NFL weather data as a task:

```json
{
  "message_id": "msg_124",
  "from": "another-agent",
  "to": "weatherbet",
  "type": "task",
  "timestamp": 1234567890,
  "payload": {
    "task": "get_nfl_weather",
    "parameters": {
      "weekOffset": 0
    }
  }
}
```

### Sending Messages to Other Agents

You can send messages to other agents using the task message format:

```json
{
  "message_id": "msg_125",
  "from": "weatherbet",
  "to": "weatherbet",
  "type": "task",
  "timestamp": 1234567890,
  "payload": {
    "task": "send_message_to_agent",
    "parameters": {
      "targetAgentUrl": "https://other-agent.example.com",
      "messageText": "Hello from WeatherBet!",
      "messageType": "chat"
    }
  }
}
```

### Handshaking with Other Agents

Discover capabilities of another agent:

```json
{
  "message_id": "msg_126",
  "from": "weatherbet",
  "to": "weatherbet",
  "type": "task",
  "timestamp": 1234567890,
  "payload": {
    "task": "handshake_with_agent",
    "parameters": {
      "targetAgentUrl": "https://other-agent.example.com"
    }
  }
}
```

## Available Tasks

- `get_nfl_weather` / `get_upcoming_games`: Get NFL games with weather
- `get_weather_for_location`: Get weather for a specific location (requires lat, lon, date)
- `send_message_to_agent`: Send a message to another agent
- `handshake_with_agent`: Perform handshake with another agent

## Configuration

### Environment Variables

**NFL Data:** No configuration needed! Uses public APIs (ESPN and TheSportsDB).

**Weather Data:** Optional - set `WEATHER_API_KEY` for real weather data:

```bash
# Set as a Cloudflare Worker secret (recommended for production)
wrangler secret put WEATHER_API_KEY
```

Or for local development, add to `wrangler.jsonc`:
```jsonc
"vars": {
  "WEATHER_API_KEY": "your-api-key-here"
}
```

See [SETUP.md](./SETUP.md) for detailed setup instructions.

If no API key is provided, the agent will use mock weather data.

## Integration Notes

### NFL Games Data

✅ **The agent now uses real NFL game data!**

The agent integrates with:
- **ESPN API** (primary) - Public endpoint, no API key needed
- **TheSportsDB API** (fallback) - Public endpoint, no API key needed  
- **Mock data** (final fallback) - Used if APIs are unavailable

The integration automatically:
- Fetches upcoming games from ESPN's public scoreboard API
- Maps team abbreviations to full team names
- Extracts game dates, times, and locations
- Falls back to alternative APIs or mock data if needed

No configuration required for NFL data!

### Weather Data

The agent supports OpenWeatherMap API. To use it:

1. Sign up at https://openweathermap.org/api
2. Get your API key
3. Set `WEATHER_API_KEY` as an environment variable or secret in Cloudflare Workers

## Agent Capabilities

The agent advertises these capabilities:

- `accepts`: ["chat", "task", "event"]
- `provides`: ["nfl_game_weather", "upcoming_games", "weather_forecast", "agent_communication"]

## Development

Build the project:
```bash
pnpm run build
```

Run development server:
```bash
pnpm run dev
```

Deploy to Cloudflare Workers:
```bash
pnpm run deploy
```

## Testing

### Quick Test Script

Use the provided test script to verify agent functionality:

```bash
# Using bash script (requires jq)
./test-agent.sh

# Or using Node.js script
node test-agent-comm.js http://localhost:8787

# Test agent-to-agent communication (requires another agent)
node test-agent-comm.js http://localhost:8787 http://other-agent.example.com
```

The test scripts verify:
- Health check endpoint
- Agent handshake
- NFL games retrieval
- Weather data retrieval
- Chat message handling
- Task message handling
- Agent-to-agent communication (if target agent provided)

## Files Structure

- `worker/index.ts`: Main agent handler with Express routes
- `worker/nfl.ts`: NFL games data and utilities
- `worker/weather.ts`: Weather API integration
- `worker/agent-comm.ts`: Agent-to-agent communication utilities
