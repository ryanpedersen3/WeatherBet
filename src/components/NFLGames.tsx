import { useState, useEffect } from 'react';

interface GameWeather {
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    date: string;
    time: string;
    stadium: string;
    city: string;
    state: string;
    location: {
      lat: number;
      lon: number;
    };
  };
  weather: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    precipitation: number;
    description: string;
  };
}

export function NFLGames() {
  const [games, setGames] = useState<GameWeather[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    fetchGames();
  }, [weekOffset]);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/nfl/weather?weekOffset=${weekOffset}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.ok && data.games) {
        setGames(data.games);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
      console.error('Error fetching games:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition: string) => {
    const cond = condition.toLowerCase();
    if (cond.includes('clear') || cond.includes('sun')) return '☀️';
    if (cond.includes('cloud')) return '☁️';
    if (cond.includes('rain')) return '🌧️';
    if (cond.includes('snow')) return '❄️';
    if (cond.includes('wind')) return '💨';
    return '🌤️';
  };

  const formatDateWithTime = (dateStr: string, timeStr: string) => {
    // Try to parse as full datetime
    try {
      // First try to parse the full date-time string if it includes timezone info
      let gameDateTime: Date;
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // Try parsing with date and time string
        gameDateTime = new Date(dateStr + ' ' + timeStr);
      } else {
        // Try ISO format
        gameDateTime = new Date(dateStr + 'T' + timeStr);
      }
      
      if (!isNaN(gameDateTime.getTime())) {
        // Format as: "Monday, December 21, 2025 at 1:00 PM EST"
        const datePart = gameDateTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timePart = gameDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        });
        return `${datePart} at ${timePart}`;
      }
    } catch (e) {
      // Fallback if parsing fails
    }
    
    // Fallback: combine date and time strings
    const date = new Date(dateStr);
    const datePart = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `${datePart} at ${timeStr}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading NFL games and weather...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>❌ Error: {error}</p>
        <button onClick={fetchGames}>Retry</button>
      </div>
    );
  }

  return (
    <div className="nfl-games-container">
      <div className="games-header">
        <div className="header-top">
          <h1>🏈 NFL Games & Weather</h1>
          <a href="/historical" className="historical-link">
            📊 View Historical Games
          </a>
        </div>
        <div className="week-selector">
          <button
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
          >
            ← Previous Week
          </button>
          <span className="week-label">
            {weekOffset === 0 ? 'This Week' : `Week +${weekOffset}`}
          </span>
          <button onClick={() => setWeekOffset(weekOffset + 1)}>
            Next Week →
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="no-games">
          <p>No games scheduled for this week.</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map(({ game, weather }) => (
            <div key={game.id} className="game-card">
              <div className="game-header">
                <div className="teams">
                  <div className="team away-team">
                    <span className="team-name">{game.awayTeam}</span>
                  </div>
                  <div className="vs">@</div>
                  <div className="team home-team">
                    <span className="team-name">{game.homeTeam}</span>
                  </div>
                </div>
              </div>

              <div className="game-info">
                <div className="date-time">
                  <span className="date-time-full">🕐 {formatDateWithTime(game.date, game.time)}</span>
                </div>
                <div className="location">
                  📍 {game.stadium}, {game.city}, {game.state}
                </div>
              </div>

              <div className="weather-section">
                <div className="weather-main">
                  <span className="weather-icon">{getWeatherIcon(weather.condition)}</span>
                  <div className="weather-temp">
                    <span className="temperature">{weather.temperature}°F</span>
                    <span className="condition">{weather.description}</span>
                  </div>
                </div>
                <div className="weather-details">
                  <div className="weather-detail">
                    <span className="label">Wind:</span>
                    <span className="value">{weather.windSpeed} mph {weather.windDirection}</span>
                  </div>
                  <div className="weather-detail">
                    <span className="label">Humidity:</span>
                    <span className="value">{weather.humidity}%</span>
                  </div>
                  {weather.precipitation > 0 && (
                    <div className="weather-detail">
                      <span className="label">Precipitation:</span>
                      <span className="value">{weather.precipitation}mm</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
