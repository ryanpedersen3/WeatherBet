/**
 * Database population utilities
 * Functions to populate the database with historical NFL game data
 */

import { upsertGame } from './database.js';
import { fetchLastNYears, fetchSeasonGames, fetchHistoricalGames } from './historical-nfl.js';

/**
 * Populates the database with games from the last N years
 */
export async function populateDatabase(
  db: D1Database,
  years: number,
  env: { [key: string]: any } = {}
): Promise<{ total: number; success: number; errors: number }> {
  console.log(`Starting database population for last ${years} years...`);
  
  let success = 0;
  let errors = 0;
  
  try {
    const games = await fetchLastNYears(years, env);
    console.log(`Fetched ${games.length} games from API`);
    
    for (const game of games) {
      try {
        await upsertGame(db, game);
        success++;
        if (success % 10 === 0) {
          console.log(`Inserted ${success} games...`);
        }
      } catch (error) {
        console.error(`Error inserting game ${game.id}:`, error);
        errors++;
      }
    }
    
    console.log(`Database population complete: ${success} successful, ${errors} errors`);
    return { total: games.length, success, errors };
  } catch (error) {
    console.error('Error populating database:', error);
    return { total: 0, success, errors: errors + 1 };
  }
}

/**
 * Populates the database with games from a specific season
 */
export async function populateSeason(
  db: D1Database,
  season: number,
  env: { [key: string]: any } = {}
): Promise<{ total: number; success: number; errors: number }> {
  console.log(`Populating database for season ${season}...`);
  
  let success = 0;
  let errors = 0;
  
  try {
    const games = await fetchSeasonGames(season, env);
    console.log(`Fetched ${games.length} games for season ${season}`);
    
    for (const game of games) {
      try {
        await upsertGame(db, game);
        success++;
      } catch (error) {
        console.error(`Error inserting game ${game.id}:`, error);
        errors++;
      }
    }
    
    return { total: games.length, success, errors };
  } catch (error) {
    console.error(`Error populating season ${season}:`, error);
    return { total: 0, success, errors: errors + 1 };
  }
}

/**
 * Populates the database with games from a specific season and week
 */
export async function populateWeek(
  db: D1Database,
  season: number,
  week: number,
  env: { [key: string]: any } = {}
): Promise<{ total: number; success: number; errors: number }> {
  console.log(`Populating database for season ${season}, week ${week}...`);
  
  let success = 0;
  let errors = 0;
  
  try {
    const games = await fetchHistoricalGames(season, week, env);
    console.log(`Fetched ${games.length} games for season ${season}, week ${week}`);
    
    for (const game of games) {
      try {
        await upsertGame(db, game);
        success++;
      } catch (error) {
        console.error(`Error inserting game ${game.id}:`, error);
        errors++;
      }
    }
    
    return { total: games.length, success, errors };
  } catch (error) {
    console.error(`Error populating season ${season}, week ${week}:`, error);
    return { total: 0, success, errors: errors + 1 };
  }
}

