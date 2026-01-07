/**
 * Direct database population script
 * Fetches NFL data and populates D1 database using wrangler d1 execute
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Simple SQL escaping
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function fetchHistoricalGames(season, week) {
  // Try TheSportsDB API first (more reliable for historical data)
  try {
    // TheSportsDB API for NFL season (league ID 4391 is NFL)
    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4391&s=${season}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      const events = data.events || [];
      
      // Filter events for completed games (have scores)
      const completedGames = events.filter(e => e.intHomeScore !== null && e.intAwayScore !== null);
      
      // Estimate week number based on date (rough approximation)
      // NFL regular season typically starts first Thursday of September
      const seasonStart = new Date(`${season}-09-01`);
      const thursdayOffset = (4 - seasonStart.getDay() + 7) % 7;
      seasonStart.setDate(seasonStart.getDate() + thursdayOffset);
      
      const games = [];
      for (const event of completedGames) {
        const eventDate = new Date(event.dateEvent);
        const daysSinceStart = Math.floor((eventDate - seasonStart) / (1000 * 60 * 60 * 24));
        const estimatedWeek = Math.floor(daysSinceStart / 7) + 1;
        
        // Only include games from the requested week (or close to it)
        if (Math.abs(estimatedWeek - week) <= 1) {
          const homeTeam = event.strHomeTeam || '';
          const awayTeam = event.strAwayTeam || '';
          const homeScore = event.intHomeScore ? parseInt(event.intHomeScore) : null;
          const awayScore = event.intAwayScore ? parseInt(event.intAwayScore) : null;
          
          const gameDate = event.dateEvent;
          const gameTime = event.strTime || '12:00';
          
          games.push({
            id: event.idEvent || `game_${season}_${week}_${event.dateEvent}`,
            season_year: season,
            week_number: estimatedWeek,
            game_date: gameDate,
            game_time: gameTime,
            home_team: homeTeam,
            away_team: awayTeam,
            home_score: homeScore,
            away_score: awayScore,
            spread: null, // TheSportsDB doesn't provide spread
            over_under: null,
            stadium: event.strVenue || null,
          });
        }
      }
      
      if (games.length > 0) {
        return games;
      }
    }
  } catch (error) {
    console.warn(`TheSportsDB API failed for season ${season}:`, error.message);
  }
  
  // Fallback: Try ESPN API
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&season=${season}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'WeatherBet-Agent/1.0' },
    });
    
    if (response.ok) {
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
            
            if (homeTeam && awayTeam) {
              const homeTeamName = homeTeam.team?.displayName || '';
              const awayTeamName = awayTeam.team?.displayName || '';
              const homeScore = homeTeam.score ? parseInt(homeTeam.score) : null;
              const awayScore = awayTeam.score ? parseInt(awayTeam.score) : null;
              
              const gameDateTime = new Date(competition.date);
              const gameDate = gameDateTime.toISOString().split('T')[0];
              const gameTime = gameDateTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short',
              });
              
              const gameId = event.id || competition.id || `game_${season}_${week}_${Date.now()}`;
              
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
    }
  } catch (error) {
    console.warn(`ESPN API failed for season ${season} week ${week}:`, error.message);
  }
  
  return [];
}

async function fetchSeasonGames(season) {
  console.log(`Fetching season ${season}...`);
  const allGames = [];
  
  // Try ESPN API for each week (regular season weeks 1-18)
  // ESPN API seems more reliable for recent seasons
  for (let week = 1; week <= 18; week++) {
    try {
      console.log(`  Trying week ${week}...`);
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&season=${season}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WeatherBet-Agent/1.0' },
      });
      
      if (response.ok) {
        const data = await response.json();
        const events = data.events || [];
        
        for (const event of events) {
          const competitions = event.competitions || [];
          for (const competition of competitions) {
            const competitors = competition.competitors || [];
            if (competitors.length >= 2) {
              const homeTeam = competitors.find(c => c.homeAway === 'home');
              const awayTeam = competitors.find(c => c.homeAway === 'away');
              
              if (homeTeam && awayTeam && homeTeam.score && awayTeam.score) {
                const homeTeamName = homeTeam.team?.displayName || '';
                const awayTeamName = awayTeam.team?.displayName || '';
                const homeScore = parseInt(homeTeam.score);
                const awayScore = parseInt(awayTeam.score);
                
                const gameDateTime = new Date(competition.date);
                const gameDate = gameDateTime.toISOString().split('T')[0];
                const gameTime = gameDateTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZoneName: 'short',
                });
                
                const gameId = event.id || competition.id || `game_${season}_${week}_${Date.now()}`;
                
                allGames.push({
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
        
        if (events.length > 0) {
          console.log(`    ✓ Week ${week}: Found ${events.length} games`);
        }
      }
    } catch (error) {
      console.warn(`    ✗ Week ${week} failed: ${error.message}`);
    }
    
    // Rate limiting - small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`  Total games fetched: ${allGames.length}`);
  return allGames;
}

async function generateSQL(games) {
  const statements = games.map(game => {
    const values = [
      escapeSQL(game.id),
      game.season_year,
      game.week_number,
      escapeSQL(game.game_date),
      escapeSQL(game.game_time),
      escapeSQL(game.home_team),
      escapeSQL(game.away_team),
      game.home_score !== null ? game.home_score : 'NULL',
      game.away_score !== null ? game.away_score : 'NULL',
      game.spread !== null ? game.spread : 'NULL',
      game.over_under !== null ? game.over_under : 'NULL',
      escapeSQL(game.stadium),
      'NULL', // city
      'NULL', // state
      'NULL', // latitude
      'NULL', // longitude
      'NULL', // weather_temperature
      'NULL', // weather_condition
      'NULL', // weather_humidity
      'NULL', // weather_wind_speed
      'NULL', // weather_wind_direction
      'NULL', // weather_precipitation
      'NULL', // weather_description
    ].join(', ');
    
    return `INSERT OR REPLACE INTO nfl_games (
      id, season_year, week_number, game_date, game_time,
      home_team, away_team, home_score, away_score,
      spread, over_under, stadium, city, state,
      latitude, longitude,
      weather_temperature, weather_condition, weather_humidity,
      weather_wind_speed, weather_wind_direction, weather_precipitation, weather_description,
      created_at, updated_at
    ) VALUES (${values}, datetime('now'), datetime('now'));`;
  });
  
  return statements.join('\n');
}

async function populateOneYear() {
  // Use 2024 season (most recent complete season)
  const season = 2024;
  
  console.log(`🚀 Starting population for season ${season}...`);
  
  const games = await fetchSeasonGames(season);
  console.log(`\n✅ Fetched ${games.length} games`);
  
  if (games.length === 0) {
    console.log('❌ No games found. Exiting.');
    return;
  }
  
  console.log('📝 Generating SQL...');
  const sql = await generateSQL(games);
  
  const sqlFile = 'populate-temp.sql';
  await fs.writeFile(sqlFile, sql);
  console.log(`💾 SQL written to ${sqlFile}`);
  
  console.log('🗄️  Executing SQL via wrangler...');
  try {
    const { stdout, stderr } = await execAsync(
      `wrangler d1 execute nfl-games-db --remote --file=${sqlFile}`
    );
    
    console.log('✅ Database populated successfully!');
    console.log(stdout);
    
    if (stderr) {
      console.warn('Warnings:', stderr);
    }
    
    // Clean up
    await fs.unlink(sqlFile);
    console.log(`🧹 Cleaned up ${sqlFile}`);
  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    console.log(`💡 SQL file saved as ${sqlFile} for manual execution`);
    throw error;
  }
}

populateOneYear().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

