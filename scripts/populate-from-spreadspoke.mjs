/**
 * Script to populate NFL games from Spreadspoke dataset
 * Spreadspoke provides free NFL data with scores, spreads, over/unders, and weather
 * Data available from 1966 to present
 * 
 * Source: https://www.spreadspoke.com/data.html
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Parse spread value (format: "-3.5" or "+7" or "PK" for pick'em)
function parseSpread(spread) {
  if (!spread || spread === 'PK' || spread === '') return null;
  const num = parseFloat(spread);
  return isNaN(num) ? null : num;
}

// Parse over/under
function parseOverUnder(ou) {
  if (!ou || ou === '') return null;
  const num = parseFloat(ou);
  return isNaN(num) ? null : num;
}

// Normalize team names to match our format
const TEAM_NAME_MAP = {
  'Arizona Cardinals': 'Arizona Cardinals',
  'Atlanta Falcons': 'Atlanta Falcons',
  'Baltimore Ravens': 'Baltimore Ravens',
  'Buffalo Bills': 'Buffalo Bills',
  'Carolina Panthers': 'Carolina Panthers',
  'Chicago Bears': 'Chicago Bears',
  'Cincinnati Bengals': 'Cincinnati Bengals',
  'Cleveland Browns': 'Cleveland Browns',
  'Dallas Cowboys': 'Dallas Cowboys',
  'Denver Broncos': 'Denver Broncos',
  'Detroit Lions': 'Detroit Lions',
  'Green Bay Packers': 'Green Bay Packers',
  'Houston Texans': 'Houston Texans',
  'Indianapolis Colts': 'Indianapolis Colts',
  'Jacksonville Jaguars': 'Jacksonville Jaguars',
  'Kansas City Chiefs': 'Kansas City Chiefs',
  'Las Vegas Raiders': 'Las Vegas Raiders',
  'Los Angeles Chargers': 'Los Angeles Chargers',
  'Los Angeles Rams': 'Los Angeles Rams',
  'Miami Dolphins': 'Miami Dolphins',
  'Minnesota Vikings': 'Minnesota Vikings',
  'New England Patriots': 'New England Patriots',
  'New Orleans Saints': 'New Orleans Saints',
  'New York Giants': 'New York Giants',
  'New York Jets': 'New York Jets',
  'Philadelphia Eagles': 'Philadelphia Eagles',
  'Pittsburgh Steelers': 'Pittsburgh Steelers',
  'San Francisco 49ers': 'San Francisco 49ers',
  'Seattle Seahawks': 'Seattle Seahawks',
  'Tampa Bay Buccaneers': 'Tampa Bay Buccaneers',
  'Tennessee Titans': 'Tennessee Titans',
  'Washington Commanders': 'Washington Commanders',
  // Handle variations
  'Oakland Raiders': 'Las Vegas Raiders',
  'San Diego Chargers': 'Los Angeles Chargers',
  'St. Louis Rams': 'Los Angeles Rams',
  'Washington Redskins': 'Washington Commanders',
  'Washington Football Team': 'Washington Commanders',
};

function normalizeTeamName(name) {
  return TEAM_NAME_MAP[name] || name;
}

async function downloadSpreadspokeData() {
  console.log('📥 Downloading Spreadspoke NFL dataset...');
  console.log('   Source: https://www.spreadspoke.com/data.html\n');
  
  try {
    // Spreadspoke provides CSV data - let's try to fetch it
    // The actual URL might need to be verified, but this is a common pattern
    const csvUrl = 'https://www.spreadspoke.com/data/nfl.csv';
    
    console.log(`   Fetching from: ${csvUrl}`);
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log(`   ✅ Downloaded ${(csvText.length / 1024).toFixed(1)} KB of data\n`);
    
    return csvText;
  } catch (error) {
    console.error(`   ❌ Error downloading: ${error.message}`);
    console.log('\n💡 Alternative: You can manually download the CSV from:');
    console.log('   https://www.spreadspoke.com/data.html');
    console.log('   Then save it as nfl.csv in the scripts directory\n');
    throw error;
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  console.log(`📊 CSV headers: ${headers.join(', ')}\n`);
  
  const games = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle CSV parsing more carefully (in case there are commas in quoted fields)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value
    
    if (values.length < headers.length) continue;
    
    const game = {};
    headers.forEach((header, index) => {
      game[header] = values[index] || null;
    });
    
    // Parse Spreadspoke CSV format
    const season = parseInt(game.schedule_season);
    const week = parseInt(game.schedule_week);
    const homeTeam = game.team_home;
    const awayTeam = game.team_away;
    const homeScore = game.score_home ? parseInt(game.score_home) : null;
    const awayScore = game.score_away ? parseInt(game.score_away) : null;
    
    // Parse date (format: M/D/YYYY)
    let gameDate = null;
    if (game.schedule_date) {
      const dateParts = game.schedule_date.split('/');
      if (dateParts.length === 3) {
        const month = dateParts[0].padStart(2, '0');
        const day = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        gameDate = `${year}-${month}-${day}`;
      }
    }
    
    const spread = parseSpread(game.spread_favorite);
    const overUnder = parseOverUnder(game.over_under_line);
    const stadium = game.stadium || null;
    const weatherTemp = game.weather_temperature ? parseInt(game.weather_temperature) : null;
    const weatherWind = game.weather_wind_mph ? parseFloat(game.weather_wind_mph) : null;
    const weatherHumidity = game.weather_humidity ? parseInt(game.weather_humidity) : null;
    const weatherDetail = game.weather_detail || null;
    
    // Only include regular season games (schedule_playoff === FALSE)
    if (season && week && homeTeam && awayTeam && gameDate && 
        homeScore !== null && awayScore !== null &&
        game.schedule_playoff === 'FALSE') {
      games.push({
        id: `spreadspoke_${season}_${week}_${gameDate}_${homeTeam.replace(/[^a-zA-Z0-9]/g, '_')}_${awayTeam.replace(/[^a-zA-Z0-9]/g, '_')}`,
        season_year: season,
        week_number: week,
        game_date: gameDate,
        game_time: '17:00', // Default, can be improved with time parsing if available
        home_team: normalizeTeamName(homeTeam),
        away_team: normalizeTeamName(awayTeam),
        home_score: homeScore,
        away_score: awayScore,
        spread: spread,
        over_under: overUnder,
        stadium: stadium,
        weather_temperature: weatherTemp,
        weather_wind_speed: weatherWind,
        weather_humidity: weatherHumidity,
        weather_description: weatherDetail,
      });
    }
  }
  
  return games;
}

async function insertGame(game) {
  const sql = `
    INSERT OR REPLACE INTO nfl_games (
      id, season_year, week_number, game_date, game_time,
      home_team, away_team, home_score, away_score,
      spread, over_under, stadium,
      weather_temperature, weather_humidity, weather_wind_speed, weather_description,
      created_at, updated_at
    ) VALUES (
      ${escapeSQL(game.id)},
      ${game.season_year},
      ${game.week_number},
      ${escapeSQL(game.game_date)},
      ${escapeSQL(game.game_time)},
      ${escapeSQL(game.home_team)},
      ${escapeSQL(game.away_team)},
      ${game.home_score !== null ? game.home_score : 'NULL'},
      ${game.away_score !== null ? game.away_score : 'NULL'},
      ${game.spread !== null ? game.spread : 'NULL'},
      ${game.over_under !== null ? game.over_under : 'NULL'},
      ${escapeSQL(game.stadium)},
      ${game.weather_temperature !== null ? game.weather_temperature : 'NULL'},
      ${game.weather_humidity !== null ? game.weather_humidity : 'NULL'},
      ${game.weather_wind_speed !== null ? game.weather_wind_speed : 'NULL'},
      ${escapeSQL(game.weather_description)},
      datetime('now'),
      datetime('now')
    );
  `;
  
  try {
    await execAsync(`wrangler d1 execute nfl-games-db --remote --command="${sql.replace(/"/g, '\\"')}"`);
    return true;
  } catch (error) {
    if (!error.message.includes('UNIQUE constraint')) {
      console.error(`   ❌ Error inserting ${game.id}: ${error.message}`);
    }
    return false;
  }
}

async function populateFromSpreadspoke(seasonFilter = null) {
  console.log('🚀 Starting population from Spreadspoke dataset...\n');
  
  let csvText;
  
  // Try to download, or use local file if available
  try {
    csvText = await downloadSpreadspokeData();
  } catch (error) {
    // Try local file
    try {
      csvText = await fs.readFile('scripts/nfl.csv', 'utf-8');
      console.log('✅ Using local nfl.csv file\n');
    } catch (fileError) {
      console.error('❌ Could not download or find local CSV file');
      console.log('\n📝 To use this script:');
      console.log('1. Download NFL data from: https://www.spreadspoke.com/data.html');
      console.log('2. Save it as scripts/nfl.csv');
      console.log('3. Run this script again\n');
      return;
    }
  }
  
  const allGames = parseCSV(csvText);
  console.log(`📊 Parsed ${allGames.length} games from CSV\n`);
  
  // Filter by season if specified
  const seasons = process.argv.slice(2).map(s => parseInt(s)).filter(s => !isNaN(s));
  let gamesToInsert = allGames;
  
  if (seasons.length > 0) {
    gamesToInsert = allGames.filter(g => seasons.includes(g.season_year));
    console.log(`🎯 Filtering to seasons: ${seasons.join(', ')}`);
    console.log(`   Games found: ${gamesToInsert.length}\n`);
  }
  
  console.log(`💾 Inserting ${gamesToInsert.length} games...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < gamesToInsert.length; i++) {
    const game = gamesToInsert[i];
    const success = await insertGame(game);
    
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    if ((i + 1) % 100 === 0 || i === gamesToInsert.length - 1) {
      process.stdout.write(`   ${i + 1}/${gamesToInsert.length} games inserted...\r`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY:');
  console.log(`   Total games processed: ${gamesToInsert.length}`);
  console.log(`   Successfully inserted: ${successCount}`);
  console.log(`   Errors/Skipped: ${errorCount}`);
  console.log('='.repeat(60));
}

const seasons = process.argv.slice(2).map(s => parseInt(s)).filter(s => !isNaN(s));
if (seasons.length > 0) {
  console.log(`🎯 Filtering to seasons: ${seasons.join(', ')}\n`);
} else {
  console.log('💡 Tip: Specify seasons to filter, e.g.,');
  console.log('   node scripts/populate-from-spreadspoke.mjs 2023 2022 2021\n');
}

populateFromSpreadspoke().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

