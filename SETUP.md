# Setup Guide for WeatherBet Agent

## Prerequisites

- Node.js and pnpm installed
- Cloudflare account (for deployment)
- (Optional) OpenWeatherMap API key for real weather data

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build the project:
```bash
pnpm run build
```

## Configuration

### Weather API Key (Optional)

To get real weather data instead of mock data, you'll need an OpenWeatherMap API key:

1. **Sign up for OpenWeatherMap API:**
   - Go to https://openweathermap.org/api
   - Sign up for a free account
   - Get your API key from the dashboard

2. **Set the API key as a Cloudflare Worker secret:**
   
   For production/staging:
   ```bash
   wrangler secret put WEATHER_API_KEY
   # When prompted, paste your OpenWeatherMap API key
   ```
   
   For local development, you can also set it in `wrangler.jsonc` (not recommended for production):
   ```jsonc
   "vars": {
     "WEATHER_API_KEY": "your-api-key-here"
   }
   ```

**Note:** If no API key is set, the agent will use mock weather data for development purposes.

## Local Development

Run the development server:
```bash
pnpm run dev
```

The agent will be available at `http://localhost:8787`

## Deployment

Deploy to Cloudflare Workers:
```bash
pnpm run deploy
```

Or using wrangler directly:
```bash
wrangler deploy
```

## Testing

See `TEST_AGENT.md` for instructions on testing agent communication.

## Environment Variables Summary

| Variable | Required | Description | How to Set |
|----------|----------|-------------|------------|
| `WEATHER_API_KEY` | No | OpenWeatherMap API key for real weather data | `wrangler secret put WEATHER_API_KEY` |

## NFL API Integration

The agent now uses real NFL data from:
- ESPN API (primary) - Public endpoint, no API key needed
- TheSportsDB API (fallback) - Public endpoint, no API key needed
- Mock data (final fallback) - Used if APIs are unavailable

No configuration needed for NFL data!
