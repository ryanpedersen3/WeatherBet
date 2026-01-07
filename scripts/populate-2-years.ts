/**
 * Script to populate the database with 2 years of historical NFL data
 * Run with: npx tsx scripts/populate-2-years.ts
 */

import { populateDatabase } from '../worker/populate-db.js';

// This script needs to be run in the context of a Cloudflare Worker
// For now, we'll use the API endpoint approach instead
// To use this, start your dev server first: pnpm run dev
// Then in another terminal: curl -X POST http://localhost:8787/api/db/populate -H "Content-Type: application/json" -d '{"years": 2}'

console.log(`
To populate the database with 2 years of data:

1. Start your dev server in one terminal:
   pnpm run dev

2. In another terminal, run:
   curl -X POST http://localhost:8787/api/db/populate \\
     -H "Content-Type: application/json" \\
     -d '{"years": 2}'

Or use the populate-direct script with wrangler.
`);

