/**
 * Direct script to populate D1 database using wrangler
 * This uses wrangler's remote execution capability
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function populateDatabase() {
  console.log('🚀 Starting database population with 2 years of data...');
  console.log('📡 This will call your Worker API endpoint...\n');

  // We need the worker to be running or deployed
  // For local development, we'll use localhost
  const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';
  
  try {
    console.log(`📞 Calling ${workerUrl}/api/db/populate...\n`);
    
    const response = await fetch(`${workerUrl}/api/db/populate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ years: 2 }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Database population completed!');
      console.log(`📊 Result:`, data);
      if (data.result) {
        console.log(`   - Total games: ${data.result.total || data.result.success || 'unknown'}`);
        console.log(`   - Successfully inserted: ${data.result.success || 'unknown'}`);
        console.log(`   - Errors: ${data.result.errors || 0}`);
      }
    } else {
      console.error('❌ Error populating database:', data.error || data.message);
      console.log('\n💡 Make sure your dev server is running: pnpm run dev');
    }
  } catch (error) {
    console.error('❌ Failed to call populate endpoint:', error.message);
    console.log('\n💡 Make sure your dev server is running: pnpm run dev');
    console.log('   Or deploy your worker and set WORKER_URL environment variable');
  }
}

populateDatabase();

