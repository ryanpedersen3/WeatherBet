/**
 * Historical NFL game data fetcher
 * Fetches games from the last 10 years with scores, weather, and spread data
 */

import type { NFLGameRecord } from './database.js';
import { getStadiumLocation } from './nfl.js';
import { getWeatherForLocation } from './weather.js';

/**
 * Fetches historical NFL games from ESPN API for a specific season and week
 */
export async function fetchHistoricalGames(
  season: number,
  week: number,
  env: { [key: string]: any } = {}
): Promise<NFLGameRecord[]> {
  try {
    // ESPN API endpoint for historical games by season and week
    // Note: ESPN API structure may vary, this is an approximation
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&season=${season}`;
    
    const response = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'WeatherBet-Agent/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const events = data.events || [];

    const games: NFLGameRecord[] = [];

    for (const event of events) {
      const competitions = event.competitions || [];
      for (const competition of competitions) {
        const competitors = competition.competitors || [];
        if (competitors.length >= 2) {
          const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

          if (homeTeam && awayTeam) {
            const homeTeamName = homeTeam.team?.displayName || '';
            const awayTeamName = awayTeam.team?.displayName || '';
            
            // Get scores
            const homeScore = homeTeam.score ? parseInt(homeTeam.score) : undefined;
            const awayScore = awayTeam.score ? parseInt(awayTeam.score) : undefined;

            // Get spread and over/under from odds
            let spread: number | undefined;
            let overUnder: number | undefined;
            if (competition.odds && competition.odds.length > 0) {
              const odds = competition.odds[0];
              spread = odds.spread;
              overUnder = odds.overUnder;
            }

            // Get stadium location
            const stadium = competition.venue?.fullName || '';
            const stadiumLocation = getStadiumLocation(homeTeamName);

            // Parse date and time
            const gameDateTime = new Date(competition.date);
            const gameDate = gameDateTime.toISOString().split('T')[0];
            const gameTime = gameDateTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            });

            // Get weather data if location is available
            let weatherData: any = {};
            if (stadiumLocation) {
              try {
                const weather = await getWeatherForLocation(
                  stadiumLocation.lat,
                  stadiumLocation.lon,
                  gameDate,
                  env
                );
                weatherData = {
                  weather_temperature: weather.temperature,
                  weather_condition: weather.condition,
                  weather_humidity: weather.humidity,
                  weather_wind_speed: weather.windSpeed,
                  weather_wind_direction: weather.windDirection,
                  weather_precipitation: weather.precipitation,
                  weather_description: weather.description,
                };
              } catch (error) {
                console.warn(`Failed to get weather for ${homeTeamName} game:`, error);
              }
            }

            const gameRecord: NFLGameRecord = {
              id: event.id || competition.id || `game_${season}_${week}_${Date.now()}`,
              season_year: season,
              week_number: week,
              game_date: gameDate,
              game_time: gameTime,
              home_team: homeTeamName,
              away_team: awayTeamName,
              home_score: homeScore,
              away_score: awayScore,
              spread: spread,
              over_under: overUnder,
              stadium: stadium || stadiumLocation?.name,
              city: stadiumLocation?.city,
              state: stadiumLocation?.state,
              latitude: stadiumLocation?.lat,
              longitude: stadiumLocation?.lon,
              ...weatherData,
            };

            games.push(gameRecord);
          }
        }
      }
    }

    return games;
  } catch (error) {
    console.error(`Error fetching historical games for season ${season}, week ${week}:`, error);
    return [];
  }
}

/**
 * Fetches all games for a complete season
 */
export async function fetchSeasonGames(
  season: number,
  env: { [key: string]: any } = {}
): Promise<NFLGameRecord[]> {
  const allGames: NFLGameRecord[] = [];
  
  // NFL regular season is typically weeks 1-18
  // Plus playoffs weeks 19-22
  const weeks = Array.from({ length: 22 }, (_, i) => i + 1);
  
  for (const week of weeks) {
    console.log(`Fetching season ${season}, week ${week}...`);
    const games = await fetchHistoricalGames(season, week, env);
    allGames.push(...games);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return allGames;
}

/**
 * Fetches games for the last N years
 */
export async function fetchLastNYears(
  years: number,
  env: { [key: string]: any } = {}
): Promise<NFLGameRecord[]> {
  const currentYear = new Date().getFullYear();
  const allGames: NFLGameRecord[] = [];
  
  for (let i = 0; i < years; i++) {
    const season = currentYear - i;
    console.log(`Fetching games for season ${season}...`);
    const seasonGames = await fetchSeasonGames(season, env);
    allGames.push(...seasonGames);
  }
  
  return allGames;
}

