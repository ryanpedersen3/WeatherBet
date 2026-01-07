/**
 * Script to populate ALL weeks of NFL seasons
 * Uses TheSportsDB to fetch all games, then organizes by week
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Calculate week number from date (NFL regular season starts first Thursday of September)
function calculateWeekNumber(gameDate, season) {
  const seasonStart = new Date(`${season}-09-01`);
  const thursdayOffset = (4 - seasonStart.getDay() + 7) % 7;
  seasonStart.setDate(seasonStart.getDate() + thursdayOffset);
  
  const date = new Date(gameDate);
  const daysSinceStart = Math.floor((date - seasonStart) / (1000 * 60 * 60 * 24));
  let week = Math.floor(daysSinceStart / 7) + 1;
  
  // Clamp to valid weeks (1-18 for regular season)
  return Math.max(1, Math.min(18, week));
}

async function fetchAllSeasonGames(season) {
  console.log(`📡 Fetching ALL games for season ${season} from TheSportsDB...`);
  
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4391&s=${season}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch season ${season}: ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    const events = data.events || [];
    
    // Filter for completed games with scores
    const completedGames = events.filter(e => 
      e.intHomeScore !== null && 
      e.intAwayScore !== null &&
      e.strHomeTeam &&
      e.strAwayTeam &&
      e.dateEvent
    );
    
    console.log(`   Found ${completedGames.length} completed games`);
    
    const gamesByWeek = {};
    
    for (const event of completedGames) {
      const gameDate = event.dateEvent;
      const weekNumber = calculateWeekNumber(gameDate, season);
      
      // Only include regular season games (weeks 1-18)
      if (weekNumber >= 1 && weekNumber <= 18) {
        if (!gamesByWeek[weekNumber]) {
          gamesByWeek[weekNumber] = [];
        }
        
        gamesByWeek[weekNumber].push({
          id: event.idEvent || `game_${season}_${weekNumber}_${gameDate}_${Math.random().toString(36).substr(2, 9)}`,
          season_year: season,
          week_number: weekNumber,
          game_date: gameDate,
          game_time: event.strTime || '17:00',
          home_team: event.strHomeTeam,
          away_team: event.strAwayTeam,
          home_score: parseInt(event.intHomeScore),
          away_score: parseInt(event.intAwayScore),
          spread: null,
          over_under: null,
          stadium: event.strVenue || null,
        });
      }
    }
    
    // Flatten and sort by week
    const allGames = [];
    const weeks = Object.keys(gamesByWeek).map(w => parseInt(w)).sort((a, b) => a - b);
    
    for (const week of weeks) {
      allGames.push(...gamesByWeek[week]);
      console.log(`   Week ${week.toString().padStart(2)}: ${gamesByWeek[week].length} games`);
    }
    
    console.log(`   📊 Total regular season games: ${allGames.length} across ${weeks.length} weeks`);
    return allGames;
  } catch (error) {
    console.error(`❌ Error fetching season ${season}:`, error.message);
    return [];
  }
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
      ${game.home_score},
      ${game.away_score},
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
    // Ignore duplicate key errors
    if (!error.message.includes('UNIQUE constraint')) {
      console.error(`   ❌ Error inserting ${game.id}: ${error.message}`);
    }
    return false;
  }
}

async function populateSeasons(seasons) {
  console.log('🚀 Starting complete season population (ALL WEEKS)...\n');
  console.log(`📅 Seasons: ${seasons.join(', ')}\n`);
  
  let totalGames = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (const season of seasons) {
    const games = await fetchAllSeasonGames(season);
    
    if (games.length === 0) {
      console.log(`   ⚠️  No games found for ${season}, skipping...\n`);
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
      
      // Progress indicator
      if ((i + 1) % 20 === 0 || i === games.length - 1) {
        process.stdout.write(`   ${i + 1}/${games.length} games inserted...\r`);
      }
      
      // Small delay to avoid overwhelming the database
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

console.log('🎯 Seasons to populate (ALL WEEKS):', seasons.join(', '));
console.log('💡 Tip: Specify multiple seasons, e.g.,');
console.log('   node scripts/populate-all-weeks.mjs 2023 2022 2021 2020\n');

populateSeasons(seasons).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
