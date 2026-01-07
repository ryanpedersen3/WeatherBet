/**
 * Script to populate multiple seasons of historical NFL data
 * Fetches all games from specified seasons using TheSportsDB API
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Calculate week number from date
function calculateWeekNumber(gameDate, season) {
  // NFL regular season starts first Thursday of September
  const seasonStart = new Date(`${season}-09-01`);
  const thursdayOffset = (4 - seasonStart.getDay() + 7) % 7;
  seasonStart.setDate(seasonStart.getDate() + thursdayOffset);
  
  const date = new Date(gameDate);
  const daysSinceStart = Math.floor((date - seasonStart) / (1000 * 60 * 60 * 24));
  const week = Math.floor(daysSinceStart / 7) + 1;
  
  // Week 0 is preseason, weeks 1-18 are regular season, 19+ is playoffs
  return Math.max(1, Math.min(18, week));
}

async function fetchSeasonGames(season) {
  console.log(`📡 Fetching season ${season} from TheSportsDB...`);
  
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
      e.strAwayTeam
    );
    
    console.log(`   Found ${completedGames.length} completed games`);
    
    const games = [];
    for (const event of completedGames) {
      const gameDate = event.dateEvent;
      const weekNumber = calculateWeekNumber(gameDate, season);
      
      // Only include regular season games (weeks 1-18)
      if (weekNumber >= 1 && weekNumber <= 18) {
        games.push({
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
    
    return games;
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
    console.error(`❌ Error inserting game ${game.id}:`, error.message);
    return false;
  }
}

async function populateSeasons(seasons) {
  console.log('🚀 Starting historical data population...\n');
  console.log(`📅 Seasons to populate: ${seasons.join(', ')}\n`);
  
  let totalGames = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (const season of seasons) {
    const games = await fetchSeasonGames(season);
    totalGames += games.length;
    
    console.log(`\n💾 Inserting ${games.length} games from ${season}...`);
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const success = await insertGame(game);
      
      if (success) {
        successCount++;
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`   ${i + 1}/${games.length} games inserted...\r`);
        }
      } else {
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`   ✅ Completed ${season}: ${games.length} games`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Population Summary:');
  console.log(`   Total games fetched: ${totalGames}`);
  console.log(`   Successfully inserted: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('='.repeat(50));
}

// Get seasons from command line arguments or use defaults
const args = process.argv.slice(2);
let seasons;

if (args.length > 0) {
  // Parse arguments as seasons
  seasons = args.map(s => parseInt(s)).filter(s => !isNaN(s));
} else {
  // Default: last 3 seasons (2024, 2023, 2022)
  const currentYear = new Date().getFullYear();
  seasons = [currentYear, currentYear - 1, currentYear - 2];
}

console.log('🎯 Populating seasons:', seasons.join(', '));
console.log('💡 Tip: You can specify seasons as arguments, e.g.,');
console.log('   node scripts/populate-more-seasons.mjs 2024 2023 2022 2021 2020\n');

populateSeasons(seasons).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


