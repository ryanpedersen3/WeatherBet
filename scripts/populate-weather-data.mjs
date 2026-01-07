/**
 * Script to populate weather data and city/state for existing games
 * Uses OpenWeatherMap API for weather and stadium lookup for location
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Stadium to city/state mapping (common NFL stadiums)
const STADIUM_LOCATIONS = {
  'Tom Benson Hall of Fame Stadium': { city: 'Canton', state: 'OH' },
  'Gillette Stadium': { city: 'Foxborough', state: 'MA' },
  'Lumen Field': { city: 'Seattle', state: 'WA' },
  'Hard Rock Stadium': { city: 'Miami Gardens', state: 'FL' },
  'Ford Field': { city: 'Detroit', state: 'MI' },
  'Raymond James Stadium': { city: 'Tampa', state: 'FL' },
  'Paycor Stadium': { city: 'Cincinnati', state: 'OH' },
  'Cleveland Browns Stadium': { city: 'Cleveland', state: 'OH' },
  'State Farm Stadium': { city: 'Glendale', state: 'AZ' },
  'Highmark Stadium': { city: 'Orchard Park', state: 'NY' },
  'Soldier Field': { city: 'Chicago', state: 'IL' },
  'Bank of America Stadium': { city: 'Charlotte', state: 'NC' },
  'AT&T Stadium': { city: 'Arlington', state: 'TX' },
  'M&T Bank Stadium': { city: 'Baltimore', state: 'MD' },
  'SoFi Stadium': { city: 'Inglewood', state: 'CA' },
};

// Stadium coordinates (approximate)
const STADIUM_COORDS = {
  'Tom Benson Hall of Fame Stadium': { lat: 40.8078, lon: -81.3978 },
  'Gillette Stadium': { lat: 42.0939, lon: -71.2642 },
  'Lumen Field': { lat: 47.5952, lon: -122.3316 },
  'Hard Rock Stadium': { lat: 25.9580, lon: -80.2389 },
  'Ford Field': { lat: 42.3400, lon: -83.0456 },
  'Raymond James Stadium': { lat: 27.9756, lon: -82.5033 },
  'Paycor Stadium': { lat: 39.0950, lon: -84.5160 },
  'Cleveland Browns Stadium': { lat: 41.5061, lon: -81.6996 },
  'State Farm Stadium': { lat: 33.5275, lon: -112.2625 },
  'Highmark Stadium': { lat: 42.7738, lon: -78.7869 },
  'Soldier Field': { lat: 41.8625, lon: -87.6167 },
  'Bank of America Stadium': { lat: 35.2258, lon: -80.8528 },
  'AT&T Stadium': { lat: 32.7473, lon: -97.0945 },
  'M&T Bank Stadium': { lat: 39.2780, lon: -76.6227 },
  'SoFi Stadium': { lat: 33.9533, lon: -118.3387 },
};

async function getWeatherForDate(lat, lon, date, apiKey) {
  if (!apiKey) {
    console.warn('No WEATHER_API_KEY found, skipping weather data');
    return null;
  }

  try {
    // Use historical weather API (requires paid plan) or current weather for demo
    // For now, we'll use current weather as a placeholder
    // In production, you'd use OpenWeatherMap Historical API
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Weather API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
      windDirection: getWindDirection(data.wind?.deg),
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      description: data.weather[0].description,
    };
  } catch (error) {
    console.error(`Error fetching weather: ${error.message}`);
    return null;
  }
}

function getWindDirection(degrees) {
  if (degrees === undefined || degrees === null) return null;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

async function updateGameWeather(gameId, weather, location, coords) {
  const updates = [];
  
  if (location) {
    updates.push(`city = '${location.city.replace(/'/g, "''")}'`);
    updates.push(`state = '${location.state.replace(/'/g, "''")}'`);
  }
  
  if (coords) {
    updates.push(`latitude = ${coords.lat}`);
    updates.push(`longitude = ${coords.lon}`);
  }
  
  if (weather) {
    if (weather.temperature !== null) updates.push(`weather_temperature = ${weather.temperature}`);
    if (weather.condition) updates.push(`weather_condition = '${weather.condition.replace(/'/g, "''")}'`);
    if (weather.humidity !== null) updates.push(`weather_humidity = ${weather.humidity}`);
    if (weather.windSpeed !== null) updates.push(`weather_wind_speed = ${weather.windSpeed}`);
    if (weather.windDirection) updates.push(`weather_wind_direction = '${weather.windDirection}'`);
    if (weather.precipitation !== null) updates.push(`weather_precipitation = ${weather.precipitation}`);
    if (weather.description) updates.push(`weather_description = '${weather.description.replace(/'/g, "''")}'`);
  }
  
  updates.push(`updated_at = datetime('now')`);
  
  if (updates.length === 0) return;
  
  const sql = `UPDATE nfl_games SET ${updates.join(', ')} WHERE id = '${gameId}';`;
  
  try {
    await execAsync(`wrangler d1 execute nfl-games-db --remote --command="${sql.replace(/"/g, '\\"')}"`);
    console.log(`✅ Updated game ${gameId}`);
  } catch (error) {
    console.error(`❌ Error updating game ${gameId}:`, error.message);
  }
}

async function populateWeatherData() {
  console.log('🌤️  Starting weather data population...\n');
  
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  WEATHER_API_KEY not set. Set it with: export WEATHER_API_KEY=your_key');
    console.warn('   Continuing with city/state population only...\n');
  }
  
  // Get all games
  try {
    const result = await execAsync('wrangler d1 execute nfl-games-db --remote --command="SELECT id, stadium, game_date, latitude, longitude FROM nfl_games;"');
    const output = result.stdout;
    
    // Parse JSON from wrangler output
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Could not parse games from database');
      return;
    }
    
    const results = JSON.parse(jsonMatch[0]);
    const games = results[0]?.results || [];
    
    console.log(`Found ${games.length} games to update\n`);
    
    for (const game of games) {
      const stadium = game.stadium;
      const location = STADIUM_LOCATIONS[stadium];
      const coords = STADIUM_COORDS[stadium];
      
      if (!location || !coords) {
        console.warn(`⚠️  Unknown stadium: ${stadium}`);
        continue;
      }
      
      let weather = null;
      if (apiKey) {
        // Use game date if available, otherwise use current date
        const gameDate = game.game_date || new Date().toISOString().split('T')[0];
        weather = await getWeatherForDate(coords.lat, coords.lon, gameDate, apiKey);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      await updateGameWeather(game.id, weather, location, coords);
    }
    
    console.log('\n✅ Weather data population complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

populateWeatherData();

