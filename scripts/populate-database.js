/**
 * Standalone script to populate the database
 * Run with: node scripts/populate-database.js [years] [season] [week]
 * 
 * Examples:
 *   node scripts/populate-database.js 10        # Populate last 10 years
 *   node scripts/populate-database.js 2024     # Populate 2024 season
 *   node scripts/populate-database.js 2024 16  # Populate 2024 season, week 16
 */

import { populateDatabase, populateSeason, populateWeek } from '../worker/populate-db.js';

// This script would need to be run in a Cloudflare Workers environment
// or adapted to work with wrangler d1 execute commands
console.log('Database population script');
console.log('Note: This script needs to be run in a Cloudflare Workers context');
console.log('Use the API endpoint /api/db/populate instead, or use wrangler d1 execute');

