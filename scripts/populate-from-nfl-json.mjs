/**
 * Script to populate NFL games from NFL.com official JSON endpoints
 * FREE - No API key required!
 * 
 * Uses NFL.com's public JSON endpoints:
 * - Schedule: https://www.nfl.com/ajax/scorestrip?season={year}&seasonType=REG&week={week}
 * - Game details: https://www.nfl.com/liveupdate/game-center/{gameId}/{gameId}_gtd.json
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Team name mapping from NFL abbreviations to full names
const TEAM_MAP = {
  'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots',
  'NO': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders',
};

function getFullTeamName(abbrev) {
  return TEAM_MAP[abbrev] || abbrev;
}

async function fetchWeekSchedule(season, week) {
  try {
    const url = `https://www.nfl.com/ajax/scorestrip?season=${season}&seasonType=REG&week=${week}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WeatherBet-Agent/1.0',
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const text = await response.text();
    
    // Parse XML response (NFL.com returns XML)
    const games = [];
    const gameMatches = text.matchAll(/<g[^>]*>([^<]*)<\/g>/g);
    
    for (const match of gameMatches) {
      const gameData = match[1];
      const parts = gameData.split(',');
      
      if (parts.length >= 13) {
        const gameId = parts[0];
        const gameDay = parts[1];
        const gameTime = parts[2];
        const awayTeam = parts[4];
        const homeTeam = parts[6];
        const awayScore = parts[8] ? parseInt(parts[8]) : null;
        const homeScore = parts[10] ? parseInt(parts[10]) : null;
        
        // Only include completed games
        if (awayScore !== null && homeScore !== null) {
          // Parse date
          const year = parseInt(gameId.substring(0, 4));
          const month = parseInt(gameId.substring(4, 6));
          const day = parseInt(gameId.substring(6, 8));
          const gameDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          games.push({
            id: gameId,
            season_year: season,
            week_number: week,
            game_date: gameDate,
            game_time: gameTime || '17:00',
            home_team: getFullTeamName(homeTeam),
            away_team: getFullTeamName(awayTeam),
            home_score: homeScore,
            away_score: awayScore,
            spread: null,
            over_under: null,
            stadium: null,
          });
        }
      }
    }
    
    return games;
  } catch (error) {
    console.warn(`   ⚠️  Week ${week} error: ${error.message}`);
    return [];
  }
}

async function fetchAllWeeksForSeason(season) {
  console.log(`\n📅 Fetching ALL weeks for season ${season} from NFL.com...`);
  const allGames = [];
  
  // Regular season is weeks 1-18
  for (let week = 1; week <= 18; week++) {
    process.stdout.write(`   Week ${week.toString().padStart(2)}... `);
    const games = await fetchWeekSchedule(season, week);
    
    if (games.length > 0) {
      allGames.push(...games);
      console.log(`✅ ${games.length} games`);
    } else {
      console.log(`⚪ no games`);
    }
    
    // Rate limiting - be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
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
  console.log('🚀 Starting population from NFL.com official JSON...\n');
  console.log(`📅 Seasons: ${seasons.join(', ')}\n`);
  console.log('✅ FREE - No API key required!\n');
  
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

console.log('🎯 NFL.com Official JSON API Population');
console.log(`📅 Seasons: ${seasons.join(', ')}`);
console.log('💡 This uses NFL.com\'s public JSON endpoints (FREE, no API key needed!)\n');

populateSeasons(seasons).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


