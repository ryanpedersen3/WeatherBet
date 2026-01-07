# How to Populate the Database with 2 Years of Data

The database has been created and configured, but there's an issue with accessing the D1 binding in the dev environment with Express/Node.js compatibility mode.

## Option 1: Deploy and Populate (Recommended)

1. **Deploy your worker:**
   ```bash
   pnpm run deploy
   ```

2. **Get your deployed worker URL** (it will be shown after deployment, or check Cloudflare dashboard)

3. **Populate the database via the deployed worker:**
   ```bash
   curl -X POST https://your-worker-url.workers.dev/api/db/populate \
     -H "Content-Type: application/json" \
     -d '{"years": 2}'
   ```

## Option 2: Manual Population via Wrangler (Advanced)

If you want to populate locally, you'll need to manually insert data or fix the env binding issue in the Worker code.

## Current Status

- ✅ Database created: `nfl-games-db`
- ✅ Database ID: `b216031a-5ee9-4ddd-9412-8f8de06db7a4`
- ✅ Migrations applied (local and remote)
- ⚠️ Database binding not accessible in dev mode due to Express/Node.js compatibility layer

The database is ready and waiting for data. Once populated, the historical games table will display the data.

