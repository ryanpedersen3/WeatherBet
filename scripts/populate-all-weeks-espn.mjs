/**
 * Script to populate ALL weeks using ESPN API
 * ESPN API provides complete game data for all weeks
 * FREE - No API key required
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Team name mapping
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
};

function normalizeTeamName(name) {
  // Try direct match first
  if (TEAM_NAME_MAP[name]) return TEAM_NAME_MAP[name];
  
  // Try partial matches
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (name.includes(key.split(' ').pop()) || key.includes(name.split(' ').pop())) {
      return value;
    }
  }
  
  return name;
}

async function fetchWeekGames(season, week) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&season=${season}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WeatherBet-Agent/1.0',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // Week doesn't exist (future week or invalid)
        return [];
      }
      return [];
    }
    
    const data = await response.json();
    const events = data.events || [];
    const games = [];
    
    for (const event of events) {
      const competitions = event.competitions || [];
      for (const competition of competitions) {
        const competitors = competition.competitors || [];
        if (competitors.length >= 2) {
          const homeTeam = competitors.find(c => c.homeAway === 'home');
          const awayTeam = competitors.find(c => c.homeAway === 'away');
          
          // Only include games with scores (completed games)
          if (homeTeam && awayTeam && homeTeam.score !== null && homeTeam.score !== undefined && 
              awayTeam.score !== null && awayTeam.score !== undefined) {
            const homeTeamName = normalizeTeamName(homeTeam.team?.displayName || homeTeam.team?.name || '');
            const awayTeamName = normalizeTeamName(awayTeam.team?.displayName || awayTeam.team?.name || '');
            const homeScore = parseInt(homeTeam.score);
            const awayScore = parseInt(awayTeam.score);
            
            const gameDateTime = new Date(competition.date);
            const gameDate = gameDateTime.toISOString().split('T')[0];
            const gameTime = gameDateTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            
            const gameId = event.id || competition.id || `espn_${season}_${week}_${competition.id}_${Math.random().toString(36).substr(2, 9)}`;
            
            games.push({
              id: gameId,
              season_year: season,
              week_number: week,
              game_date: gameDate,
              game_time: gameTime,
              home_team: homeTeamName,
              away_team: awayTeamName,
              home_score: homeScore,
              away_score: awayScore,
              spread: competition.odds?.[0]?.spread || null,
              over_under: competition.odds?.[0]?.overUnder || null,
              stadium: competition.venue?.fullName || null,
            });
          }
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
  console.log(`\n📅 Fetching ALL weeks for season ${season} from ESPN...`);
  const allGames = [];
  
  // Regular season is weeks 1-18
  for (let week = 1; week <= 18; week++) {
    process.stdout.write(`   Week ${week.toString().padStart(2)}... `);
    const games = await fetchWeekGames(season, week);
    
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
      ${game.spread !== null && game.spread !== undefined ? game.spread : 'NULL'},
      ${game.over_under !== null && game.over_under !== undefined ? game.over_under : 'NULL'},
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
  console.log('🚀 Starting population from ESPN API (ALL WEEKS)...\n');
  console.log(`📅 Seasons: ${seasons.join(', ')}\n`);
  console.log('✅ FREE - No API key required!\n');
  console.log('⏳ This will take a few minutes (rate limiting)...\n');
  
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

console.log('🎯 ESPN API Population (ALL WEEKS)');
console.log(`📅 Seasons: ${seasons.join(', ')}`);
console.log('💡 This uses ESPN\'s public API (FREE, no API key needed!)\n');

populateSeasons(seasons).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


