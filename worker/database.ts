/**
 * Database utilities for NFL games historical data
 * Uses Cloudflare D1 (SQLite) database
 */

export interface NFLGameRecord {
  id: string;
  season_year: number;
  week_number: number;
  game_date: string;
  game_time?: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  spread?: number;
  over_under?: number;
  stadium?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  weather_temperature?: number;
  weather_condition?: string;
  weather_humidity?: number;
  weather_wind_speed?: number;
  weather_wind_direction?: string;
  weather_precipitation?: number;
  weather_description?: string;
}

/**
 * Inserts or updates an NFL game record in the database
 */
export async function upsertGame(
  db: D1Database,
  game: NFLGameRecord
): Promise<void> {
  const query = `
    INSERT INTO nfl_games (
      id, season_year, week_number, game_date, game_time,
      home_team, away_team, home_score, away_score,
      spread, over_under, stadium, city, state,
      latitude, longitude,
      weather_temperature, weather_condition, weather_humidity,
      weather_wind_speed, weather_wind_direction, weather_precipitation,
      weather_description, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      season_year = excluded.season_year,
      week_number = excluded.week_number,
      game_date = excluded.game_date,
      game_time = excluded.game_time,
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      spread = excluded.spread,
      over_under = excluded.over_under,
      stadium = excluded.stadium,
      city = excluded.city,
      state = excluded.state,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      weather_temperature = excluded.weather_temperature,
      weather_condition = excluded.weather_condition,
      weather_humidity = excluded.weather_humidity,
      weather_wind_speed = excluded.weather_wind_speed,
      weather_wind_direction = excluded.weather_wind_direction,
      weather_precipitation = excluded.weather_precipitation,
      weather_description = excluded.weather_description,
      updated_at = datetime('now')
  `;

  await db.prepare(query).bind(
    game.id,
    game.season_year,
    game.week_number,
    game.game_date,
    game.game_time || null,
    game.home_team,
    game.away_team,
    game.home_score || null,
    game.away_score || null,
    game.spread || null,
    game.over_under || null,
    game.stadium || null,
    game.city || null,
    game.state || null,
    game.latitude || null,
    game.longitude || null,
    game.weather_temperature || null,
    game.weather_condition || null,
    game.weather_humidity || null,
    game.weather_wind_speed || null,
    game.weather_wind_direction || null,
    game.weather_precipitation || null,
    game.weather_description || null
  ).run();
}

/**
 * Gets games from the database by date range
 */
export async function getGamesByDateRange(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<NFLGameRecord[]> {
  const query = `
    SELECT * FROM nfl_games
    WHERE game_date >= ? AND game_date <= ?
    ORDER BY game_date, game_time
  `;

  const result = await db.prepare(query).bind(startDate, endDate).all();
  return result.results as unknown as NFLGameRecord[];
}

/**
 * Gets games by season and week
 */
export async function getGamesBySeasonWeek(
  db: D1Database,
  season: number,
  week: number
): Promise<NFLGameRecord[]> {
  const query = `
    SELECT * FROM nfl_games
    WHERE season_year = ? AND week_number = ?
    ORDER BY game_date, game_time
  `;

  const result = await db.prepare(query).bind(season, week).all();
  return result.results as unknown as NFLGameRecord[];
}

/**
 * Gets games by team
 */
export async function getGamesByTeam(
  db: D1Database,
  teamName: string,
  limit: number = 100
): Promise<NFLGameRecord[]> {
  const query = `
    SELECT * FROM nfl_games
    WHERE home_team = ? OR away_team = ?
    ORDER BY game_date DESC
    LIMIT ?
  `;

  const result = await db.prepare(query).bind(teamName, teamName, limit).all();
  return result.results as unknown as NFLGameRecord[];
}

/**
 * Gets all games from a specific season
 */
export async function getGamesBySeason(
  db: D1Database,
  season: number
): Promise<NFLGameRecord[]> {
  try {
    // First verify the table exists
    try {
      const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nfl_games'").first();
      if (!tableCheck) {
        throw new Error('Table nfl_games does not exist. Run: wrangler d1 migrations apply nfl-games-db --remote');
      }
    } catch (checkError) {
      console.error('Table check failed:', checkError);
      throw checkError;
    }

    const query = `
      SELECT * FROM nfl_games
      WHERE season_year = ?
      ORDER BY week_number, game_date, game_time
    `;

    const result = await db.prepare(query).bind(season).all();
    return result.results as unknown as NFLGameRecord[];
  } catch (error) {
    console.error(`Error fetching games for season ${season}:`, error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    // If it's a table not found error, provide helpful message
    if (errorMsg.includes('no such table') || errorMsg.includes('SQLITE_ERROR')) {
      throw new Error(`Database table 'nfl_games' does not exist. Please run: wrangler d1 migrations apply nfl-games-db --remote`);
    }
    // Re-throw with more context
    throw new Error(`Database error fetching season ${season}: ${errorMsg}`);
  }
}

/**
 * Gets game statistics
 */
export async function getGameStats(
  db: D1Database
): Promise<{
  totalGames: number;
  seasons: number[];
  dateRange: { start: string; end: string };
}> {
  const totalResult = await db.prepare('SELECT COUNT(*) as count FROM nfl_games').first();
  const seasonsResult = await db.prepare('SELECT DISTINCT season_year FROM nfl_games ORDER BY season_year').all();
  const dateRangeResult = await db.prepare('SELECT MIN(game_date) as start, MAX(game_date) as end FROM nfl_games').first();

  return {
    totalGames: (totalResult as any)?.count || 0,
    seasons: (seasonsResult.results as any[]).map((r: any) => r.season_year),
    dateRange: {
      start: (dateRangeResult as any)?.start || '',
      end: (dateRangeResult as any)?.end || '',
    },
  };
}

