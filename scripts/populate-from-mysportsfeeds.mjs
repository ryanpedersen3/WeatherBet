/**
 * Script to populate NFL games from MySportsFeeds API
 * Free tier available with registration
 * Website: https://www.mysportsfeeds.com/
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// API credentials (get from https://www.mysportsfeeds.com/data-feeds/api-docs/)
const API_KEY = process.env.MYSPORTSFEEDS_API_KEY;
const API_PASSWORD = process.env.MYSPORTSFEEDS_API_PASSWORD;

async function fetchGamesFromMySportsFeeds(season, week) {
  if (!API_KEY || !API_PASSWORD) {
    console.warn('⚠️  MYSPORTSFEEDS_API_KEY and MYSPORTSFEEDS_API_PASSWORD not set');
    console.warn('   Get them from: https://www.mysportsfeeds.com/data-feeds/api-docs/');
    return [];
  }

  try {
    // MySportsFeeds API v2.0 endpoint
    const url = `https://api.mysportsfeeds.com/v2.0/pull/nfl/${season}-regular/week/${week}/games.json`;
    
    const auth = Buffer.from(`${API_KEY}:${API_PASSWORD}`).toString('base64');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Authentication failed. Check your API credentials.');
      } else if (response.status === 404) {
        // No games for this week
        return [];
      } else {
        console.warn(`⚠️  API error: ${response.status} ${response.statusText}`);
      }
      return [];
    }
    
    const data = await response.json();
    
    // Parse MySportsFeeds response format
    const games = [];
    const gameData = data.games || [];
    
    for (const game of gameData) {
      const schedule = game.schedule || {};
      const score = game.score || {};
      
      const homeTeam = schedule.homeTeam?.abbreviation || schedule.homeTeam?.name || '';
      const awayTeam = schedule.awayTeam?.abbreviation || schedule.awayTeam?.name || '';
      const homeScore = score.homeScoreTotal || null;
      const awayScore = score.awayScoreTotal || null;
      const gameDate = schedule.startTime?.split('T')[0] || schedule.playedStatus?.date || '';
      const gameTime = schedule.startTime?.split('T')[1]?.substring(0, 5) || '17:00';
      const venue = schedule.venue?.name || null;
      
      if (homeTeam && awayTeam && gameDate) {
        games.push({
          id: `msf_${season}_${week}_${schedule.id || Date.now()}`,
          season_year: season,
          week_number: week,
          game_date: gameDate,
          game_time: gameTime,
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: homeScore,
          away_score: awayScore,
          spread: null, // MySportsFeeds free tier may not include this
          over_under: null,
          stadium: venue,
        });
      }
    }
    
    return games;
  } catch (error) {
    console.error(`❌ Error fetching week ${week}: ${error.message}`);
    return [];
  }
}

async function fetchAllWeeksForSeason(season) {
  console.log(`\n📅 Fetching ALL weeks for season ${season}...`);
  const allGames = [];
  
  // Regular season is weeks 1-18
  for (let week = 1; week <= 18; week++) {
    process.stdout.write(`   Week ${week.toString().padStart(2)}... `);
    const games = await fetchGamesFromMySportsFeeds(season, week);
    
    if (games.length > 0) {
      allGames.push(...games);
      console.log(`✅ ${games.length} games`);
    } else {
      console.log(`⚪ no games`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`   📊 Total games for ${season}: ${allGames.length}`);
  return allGames;
}

async function insertGame(game) {
  const sql = `
    INSERT OR REPLACE INTO nfl_games (
      id, season_year, week_number, game_date, game_time,
      home_team, away_team, home_score, away_score,
      spread, over_under, stadium,
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
      NULL,
      NULL,
      ${escapeSQL(game.stadium)},
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

async function populateSeasons(seasons) {
  if (!API_KEY || !API_PASSWORD) {
    console.log('❌ API credentials not set!\n');
    console.log('📝 To get free API access:');
    console.log('1. Go to: https://www.mysportsfeeds.com/data-feeds/api-docs/');
    console.log('2. Sign up for a free account');
    console.log('3. Get your API key and password');
    console.log('4. Set environment variables:');
    console.log('   export MYSPORTSFEEDS_API_KEY=your_key');
    console.log('   export MYSPORTSFEEDS_API_PASSWORD=your_password');
    console.log('5. Run this script again\n');
    return;
  }

  console.log('🚀 Starting population from MySportsFeeds...\n');
  console.log(`📅 Seasons: ${seasons.join(', ')}\n`);
  
  let totalGames = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (const season of seasons) {
    const games = await fetchAllWeeksForSeason(season);
    
    if (games.length === 0) {
      console.log(`   ⚠️  No games found for ${season}\n`);
      continue;
    }
    
    totalGames += games.length;
    
    console.log(`\n💾 Inserting ${games.length} games from ${season}...`);
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const success = await insertGame(game);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      if ((i + 1) % 20 === 0 || i === games.length - 1) {
        process.stdout.write(`   ${i + 1}/${games.length} games inserted...\r`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    console.log(`   ✅ Completed ${season}: ${successCount} games inserted`);
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('📊 FINAL SUMMARY:');
  console.log(`   Total games fetched: ${totalGames}`);
  console.log(`   Successfully inserted: ${successCount}`);
  console.log(`   Errors/Skipped: ${errorCount}`);
  console.log('='.repeat(60));
}

// Get seasons from command line arguments
const args = process.argv.slice(2);
let seasons;

if (args.length > 0) {
  seasons = args.map(s => parseInt(s)).filter(s => !isNaN(s));
} else {
  // Default: 2023
  seasons = [2023];
}

console.log('🎯 MySportsFeeds API Population');
console.log(`📅 Seasons: ${seasons.join(', ')}`);
console.log('💡 Tip: Get free API credentials at https://www.mysportsfeeds.com/data-feeds/api-docs/\n');

populateSeasons(seasons).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


