/**
 * Weather API utility
 * Fetches weather information for game locations
 */

export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  description: string;
  icon?: string;
}

export interface GameWeatherInfo {
  gameId: string;
  location: string;
  date: string;
  currentWeather?: WeatherData;
  forecastWeather?: WeatherData;
}

/**
 * Fetches weather data for a specific location and date
 * Uses OpenWeatherMap API (requires API key in environment)
 */
// Track if we've already warned about missing API key to avoid spam
let apiKeyWarningShown = false;

export async function getWeatherForLocation(
  lat: number,
  lon: number,
  date: string,
  env: { WEATHER_API_KEY?: string }
): Promise<WeatherData> {
  const apiKey = env.WEATHER_API_KEY;
  
  if (!apiKey) {
    // Fallback to mock data if no API key (only warn once)
    if (!apiKeyWarningShown) {
      console.warn("No WEATHER_API_KEY found, using mock weather data. Set WEATHER_API_KEY for real weather data.");
      apiKeyWarningShown = true;
    }
    return getMockWeatherData(lat, lon, date);
  }

  try {
    // For current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    
    // For forecast (if date is in the future)
    const targetDate = new Date(date);
    const now = new Date();
    const isFuture = targetDate > now;
    
    if (isFuture) {
      // Use forecast API
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
      const forecastResponse = await fetch(forecastUrl);
      
      if (!forecastResponse.ok) {
        throw new Error(`Weather API error: ${forecastResponse.statusText}`);
      }
      
      const forecastData = await forecastResponse.json() as any;
      
      // Find the closest forecast to the target date
      const targetTime = targetDate.getTime();
      const closestForecast = forecastData.list.reduce((prev: any, curr: any) => {
        const prevDiff = Math.abs(new Date(prev.dt * 1000).getTime() - targetTime);
        const currDiff = Math.abs(new Date(curr.dt * 1000).getTime() - targetTime);
        return currDiff < prevDiff ? curr : prev;
      });
      
      return formatWeatherData(closestForecast);
    } else {
      // Use current weather API
      const currentResponse = await fetch(currentUrl);
      
      if (!currentResponse.ok) {
        throw new Error(`Weather API error: ${currentResponse.statusText}`);
      }
      
      const currentData = await currentResponse.json();
      return formatWeatherData(currentData);
    }
  } catch (error) {
    console.error("Error fetching weather:", error);
    // Fallback to mock data on error
    return getMockWeatherData(lat, lon, date);
  }
}

/**
 * Formats OpenWeatherMap API response to our WeatherData format
 */
function formatWeatherData(data: any): WeatherData {
  return {
    temperature: Math.round(data.main?.temp || 0),
    condition: data.weather?.[0]?.main || "Unknown",
    humidity: data.main?.humidity || 0,
    windSpeed: data.wind?.speed || 0,
    windDirection: getWindDirection(data.wind?.deg || 0),
    precipitation: data.rain?.["3h"] || data.snow?.["3h"] || 0,
    description: data.weather?.[0]?.description || "No description",
    icon: data.weather?.[0]?.icon || undefined,
  };
}

/**
 * Converts wind direction in degrees to cardinal direction
 */
function getWindDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || "N";
}

/**
 * Mock weather data for development/testing
 */
function getMockWeatherData(_lat: number, _lon: number, date: string): WeatherData {
  // Simple mock based on approximate location
  const month = new Date(date).getMonth();
  const isWinter = month >= 11 || month <= 2;
  const isSummer = month >= 5 && month <= 8;
  
  return {
    temperature: isWinter ? 35 : isSummer ? 85 : 65,
    condition: isWinter ? "Clear" : isSummer ? "Partly Cloudy" : "Cloudy",
    humidity: 60,
    windSpeed: 8,
    windDirection: "SW",
    precipitation: 0,
    description: isWinter ? "Clear and cold" : isSummer ? "Warm and partly cloudy" : "Mild with clouds",
  };
}

/**
 * Formats weather information for display
 */
export function formatWeatherInfo(weather: WeatherData, location: string): string {
  return `Weather for ${location}:\n` +
    `Temperature: ${weather.temperature}°F\n` +
    `Condition: ${weather.condition} (${weather.description})\n` +
    `Humidity: ${weather.humidity}%\n` +
    `Wind: ${weather.windSpeed} mph ${weather.windDirection}\n` +
    `Precipitation: ${weather.precipitation}mm`;
}
