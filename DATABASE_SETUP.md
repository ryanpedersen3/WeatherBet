# NFL Games Database Setup Guide

This guide explains how to set up and use the historical NFL games database.

## Database Schema

The database stores the following information for each game:
- **Game Info**: ID, season year, week number, date, time
- **Teams**: Home team, away team
- **Scores**: Home score, away score
- **Betting**: Spread, over/under
- **Location**: Stadium, city, state, coordinates
- **Weather**: Temperature, condition, humidity, wind, precipitation

## Setup Steps

### 1. Create D1 Database

```bash
# Create a new D1 database
wrangler d1 create nfl-games-db
```

This will output a database ID. Copy this ID.

### 2. Update wrangler.jsonc

Update the `d1_databases` section in `wrangler.jsonc` with your database ID:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "nfl-games-db",
    "database_id": "your-actual-database-id-here"
  }
]
```

### 3. Run Migration

```bash
# Apply the database schema
wrangler d1 execute nfl-games-db --file=./migrations/0001_create_nfl_games.sql
```

Or for local development:

```bash
wrangler d1 execute nfl-games-db --local --file=./migrations/0001_create_nfl_games.sql
```

### 4. Populate Database

You can populate the database via API endpoints:

#### Populate Last 10 Years
```bash
curl -X POST http://localhost:8787/api/db/populate \
  -H "Content-Type: application/json" \
  -d '{"years": 10}'
```

#### Populate Specific Season
```bash
curl -X POST http://localhost:8787/api/db/populate \
  -H "Content-Type: application/json" \
  -d '{"season": 2024}'
```

#### Populate Specific Week
```bash
curl -X POST http://localhost:8787/api/db/populate \
  -H "Content-Type: application/json" \
  -d '{"season": 2024, "week": 16}'
```

**Note**: Populating 10 years of data will take a significant amount of time and make many API calls. Consider starting with a single season first.

## API Endpoints

### Get Database Statistics
```bash
GET /api/db/stats
```

Returns:
- Total number of games
- Available seasons
- Date range of stored games

### Query Games

#### By Date Range
```bash
GET /api/db/games?startDate=2024-01-01&endDate=2024-12-31
```

#### By Season
```bash
GET /api/db/games?season=2024
```

#### By Season and Week
```bash
GET /api/db/games?season=2024&week=16
```

#### By Team
```bash
GET /api/db/games?team=Kansas City Chiefs
```

## Database Structure

### Table: `nfl_games`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Unique game identifier |
| season_year | INTEGER | NFL season year |
| week_number | INTEGER | Week number (1-22) |
| game_date | TEXT | Game date (YYYY-MM-DD) |
| game_time | TEXT | Game time |
| home_team | TEXT | Home team name |
| away_team | TEXT | Away team name |
| home_score | INTEGER | Home team final score |
| away_score | INTEGER | Away team final score |
| spread | REAL | Point spread |
| over_under | REAL | Over/under total |
| stadium | TEXT | Stadium name |
| city | TEXT | City |
| state | TEXT | State |
| latitude | REAL | Stadium latitude |
| longitude | REAL | Stadium longitude |
| weather_temperature | INTEGER | Temperature in °F |
| weather_condition | TEXT | Weather condition |
| weather_humidity | INTEGER | Humidity percentage |
| weather_wind_speed | REAL | Wind speed in mph |
| weather_wind_direction | TEXT | Wind direction |
| weather_precipitation | REAL | Precipitation in mm |
| weather_description | TEXT | Weather description |
| created_at | TEXT | Record creation timestamp |
| updated_at | TEXT | Record last update timestamp |

## Usage Examples

### Query all games from 2024 season
```bash
curl http://localhost:8787/api/db/games?season=2024
```

### Query games for a specific team
```bash
curl http://localhost:8787/api/db/games?team=Kansas%20City%20Chiefs
```

### Query games from a date range
```bash
curl "http://localhost:8787/api/db/games?startDate=2024-09-01&endDate=2024-12-31"
```

## Notes

- **Historical Weather Data**: Weather data for past games will use mock data unless you have a weather API that supports historical queries. OpenWeatherMap's free tier doesn't support historical data.

- **Rate Limiting**: When populating the database, the code includes delays to avoid rate limiting. Populating 10 years of data will take several hours.

- **Data Sources**: 
  - Game data: ESPN API
  - Weather data: OpenWeatherMap (current/forecast) or mock data for historical

- **Storage**: D1 databases have storage limits. 10 years of NFL data (approximately 5,000+ games) should fit well within free tier limits.

## Troubleshooting

### Database not available error
- Make sure you've created the D1 database
- Check that the database ID in `wrangler.jsonc` is correct
- For local development, use `--local` flag with wrangler commands

### Population taking too long
- Start with a single season first
- Use the week-specific endpoint to populate incrementally
- Check API rate limits if you're getting errors

