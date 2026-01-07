# Free NFL API Options for Complete Historical Data

## ✅ Recommended Free Options

### 1. **Spreadspoke** (CSV Dataset)
- **Website**: https://www.spreadspoke.com/data.html
- **Data**: Complete NFL data from 1966 to present
- **Includes**: Scores, spreads, over/unders, stadiums, weather
- **Format**: CSV file (manual download)
- **How to use**:
  1. Download the CSV from the website
  2. Save as `scripts/nfl.csv`
  3. Run: `node scripts/populate-from-spreadspoke.mjs`

### 2. **Pro Football Reference** (Unofficial API)
- **Website**: https://www.pro-football-reference.com/
- **Data**: Complete historical NFL data
- **Note**: Scraping required (check robots.txt and terms of service)
- **Alternative**: Use their export features

### 3. **NFL.com Official JSON** ⚠️ Limited
- **Endpoint**: https://www.nfl.com/ajax/scorestrip
- **Status**: Returns HTML instead of JSON (endpoint format may have changed)
- **Data**: Would provide schedules and scores
- **Note**: Endpoint appears to be deprecated or requires different format

### 3a. **ESPN API** ⚠️ Current Games Only
- **Endpoint**: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
- **Status**: Works, but only returns CURRENT/UPCOMING games
- **Limitation**: Does NOT provide historical game data
- **Data**: Current week games only

### 4. **MySportsFeeds**
- **Website**: https://www.mysportsfeeds.com/
- **Free Tier**: Limited but includes historical data
- **Requires**: Registration
- **API**: RESTful API access

### 5. **OpenDataBay Dataset**
- **Website**: https://www.opendatabay.com/
- **Dataset**: "NFL Scores and Betting Trends"
- **Data**: 1966 to present with betting info
- **Format**: Downloadable dataset

## 📝 Implementation

Scripts have been created for:
- ✅ Spreadspoke CSV import (`scripts/populate-from-spreadspoke.mjs`)
- ⏳ Other APIs (can be added as needed)

## 🚀 Quick Start (Spreadspoke)

1. **Download the data**:
   - Visit: https://www.spreadspoke.com/data.html
   - Download the NFL CSV file
   - Save it as `scripts/nfl.csv`

2. **Populate database**:
   ```bash
   # All seasons in CSV
   node scripts/populate-from-spreadspoke.mjs
   
   # Specific seasons
   node scripts/populate-from-spreadspoke.mjs 2023 2022 2021
   ```

## 📊 What You Get

- ✅ All weeks of regular season (not just 15 games)
- ✅ Spread and over/under data
- ✅ Weather information
- ✅ Complete scores and dates
- ✅ Multiple years of data

