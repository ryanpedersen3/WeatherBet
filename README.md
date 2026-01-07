# NFL Weather Betting Agent

A full-stack application that tracks NFL games with weather data and maintains a historical database of games, scores, weather conditions, and betting information.

## Features

- 🏈 **Real-time NFL Games**: Display upcoming NFL games with live weather data
- 📊 **Historical Database**: Browse historical NFL games from the past seasons
- 🌤️ **Weather Integration**: Real-time and historical weather data for game locations
- 💾 **Cloudflare D1 Database**: SQLite-based serverless database for historical data
- 🔄 **Agent-to-Agent Communication**: Built-in A2A protocol for inter-agent messaging
- 📱 **Modern UI**: React + TypeScript frontend with responsive design

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Cloudflare Workers with Express.js
- **Database**: Cloudflare D1 (SQLite)
- **APIs**: 
  - ESPN API (NFL games)
  - TheSportsDB API (historical games)
  - OpenWeatherMap API (weather data)

## Quick Start

### Prerequisites

- Node.js and pnpm installed
- Cloudflare account (for deployment)
- OpenWeatherMap API key (free tier available)

### Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

### Configuration

1. **Set up D1 Database:**
   ```bash
   wrangler d1 create nfl-games-db
   ```
   Update `wrangler.jsonc` with the database ID, then run migrations:
   ```bash
   wrangler d1 migrations apply nfl-games-db --remote
   ```

2. **Set Weather API Key:**
   ```bash
   wrangler secret put WEATHER_API_KEY
   ```

### Local Development

```bash
# Start dev server
pnpm run dev
```

### Deployment

```bash
pnpm run deploy
```

## Documentation

- [Setup Guide](SETUP.md) - Initial setup and configuration
- [Database Setup](DATABASE_SETUP.md) - D1 database configuration
- [Populate Database](POPULATE_DATABASE.md) - How to populate historical data
- [API Keys Setup](API_KEYS_SETUP.md) - Setting up API keys
- [Agent Communication](AGENT_README.md) - A2A protocol documentation

## Project Structure

```
weatherbet/
├── worker/           # Cloudflare Worker backend
│   ├── index.ts     # Main worker entry point
│   ├── nfl.ts       # NFL game data fetching
│   ├── weather.ts   # Weather data fetching
│   ├── database.ts  # D1 database utilities
│   └── ...
├── src/             # React frontend
│   ├── components/  # React components
│   └── ...
├── scripts/         # Utility scripts
│   └── populate-all-data.mjs  # Populate weather/location data
└── migrations/      # Database migrations
```

## Database Schema

The `nfl_games` table stores:
- Game information (teams, scores, dates, stadiums)
- Location data (city, state, coordinates)
- Weather data (temperature, condition, humidity, wind, precipitation)
- Betting data (spread, over/under)

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/nfl/games` - Get upcoming NFL games
- `GET /api/nfl/weather` - Get games with weather data
- `GET /api/db/games` - Get historical games from database
- `GET /api/db/stats` - Get database statistics

## License

MIT
