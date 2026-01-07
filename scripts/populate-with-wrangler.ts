/**
 * This script demonstrates how to populate the database
 * Since we need the Worker context for DB bindings, use the API endpoint instead.
 * 
 * Make sure your dev server is running (pnpm run dev or wrangler dev),
 * then call the API endpoint:
 * 
 * curl -X POST http://localhost:8787/api/db/populate \
 *   -H "Content-Type: application/json" \
 *   -d '{"years": 2}'
 */

console.log('To populate the database, use the API endpoint with your dev server running.');

