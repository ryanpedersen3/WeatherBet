# API Keys Setup Guide

## ✅ Completed
- **City/State data**: ✅ Populated for all 15 games (no API key needed)

## 📋 To Add Weather Data

### Step 1: Get OpenWeatherMap API Key (Free)

1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. After signing up, go to your API keys page: https://home.openweathermap.org/api_keys
4. Copy your API key (it may take a few minutes to activate)

### Step 2: Set the API Key

**For local testing:**
```bash
export WEATHER_API_KEY=your_openweathermap_api_key_here
```

**For production (Cloudflare Worker):**
```bash
wrangler secret put WEATHER_API_KEY
# When prompted, paste your API key
```

### Step 3: Run the Population Script

```bash
node scripts/populate-all-data.mjs
```

**Note:** The free OpenWeatherMap plan provides current weather data. For historical weather data (specific to game dates), you'll need a paid plan ($40/month). The script will use current weather as a placeholder for historical games.

## 📋 To Add Betting Data (Spread/Over-Under)

**Important:** Historical betting odds (spread and over/under) typically require **paid API subscriptions**. Free APIs usually only provide current/upcoming games, not historical data.

### Option 1: The Odds API
- Website: https://the-odds-api.com/
- Pricing: Free tier available but limited
- Historical data: Requires paid plan
- API Key: Get from https://the-odds-api.com/liveapi/guides/get-access-keys.html

```bash
export BETTING_API_KEY=your_odds_api_key_here
```

### Option 2: SportsDataIO
- Website: https://sportsdata.io/
- Pricing: Paid plans only (starts at $10/month)
- Historical data: Available with paid plans

### Option 3: Skip Betting Data
If you don't want to pay for betting APIs, the spread and over/under columns will remain empty. This is fine for most use cases - the weather and location data are the most valuable additions.

## 🚀 Quick Start (Weather Data Only)

If you just want to add weather data:

```bash
# 1. Get your free OpenWeatherMap API key from https://openweathermap.org/api
# 2. Set it:
export WEATHER_API_KEY=your_key_here

# 3. Run the script:
node scripts/populate-all-data.mjs
```

The script will:
- ✅ Update city/state (already done)
- ✅ Update coordinates (already done)
- ✅ Add current weather data (if API key provided)
- ⚠️ Betting data skipped (requires paid API)

## 📊 Current Status

After running the script with a weather API key, you'll have:
- ✅ Teams, Scores, Stadium, Date, Week
- ✅ City, State, Coordinates
- ✅ Weather Temperature, Condition, Humidity, Wind Speed/Direction, Precipitation
- ⚠️ Spread, Over/Under (requires paid betting API)

