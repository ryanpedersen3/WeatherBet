import { useState, useEffect } from 'react';

interface GameRecord {
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
  created_at?: string;
  updated_at?: string;
}

export function HistoricalGames() {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default to 2023 since that's where our data is
  const [season, setSeason] = useState<number>(2023);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('game_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchGames();
  }, [season, filterTeam]);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/db/games?season=${season}`;
      if (filterTeam) {
        url = `/api/db/games?team=${encodeURIComponent(filterTeam)}`;
      }
      // Add cache-busting parameter to prevent stale error responses
      url += `&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.games)) {
        setGames(data.games);
        // Always clear error if we got valid data with games
        setError(null);
        // Only show warning if there's a warning AND no games
        if (data.warning && data.games.length === 0) {
          setError(data.warning);
        }
      } else {
        console.error('Invalid response format:', data);
        throw new Error(data.error || 'Invalid response format: expected games array');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
      console.error('Error fetching games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedGames = [...games].sort((a, b) => {
    let aVal: any = a[sortBy as keyof GameRecord];
    let bVal: any = b[sortBy as keyof GameRecord];
    
    // Handle date sorting
    if (sortBy === 'game_date') {
      try {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } catch (e) {
        aVal = 0;
        bVal = 0;
      }
    }
    
    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';
    
    // Handle numeric sorting
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Handle string sorting
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return sortOrder === 'asc' 
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading historical games...</p>
      </div>
    );
  }

  if (error) {
    const isDatabaseError = error.includes('Database not configured') || error.includes('Database not available');
    
    return (
      <div className="error-container">
        <div className="error-content">
          <p className="error-icon">❌</p>
          <h2>Database Error</h2>
          <p className="error-message">{error}</p>
          {isDatabaseError && (
            <div className="database-setup-instructions">
              <h3>To set up the database:</h3>
              <ol>
                <li>Create a D1 database: <code>wrangler d1 create nfl-games-db</code></li>
                <li>Update <code>wrangler.jsonc</code> with the database ID</li>
                <li>Run migrations: <code>wrangler d1 migrations apply nfl-games-db</code></li>
                <li>Restart your dev server</li>
              </ol>
              <p className="note">Note: The database is optional. You can still use the app to view current games without it.</p>
            </div>
          )}
          <button onClick={fetchGames}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="historical-games-container">
      <div className="historical-header">
        <h1>📊 Historical NFL Games Database</h1>
        <div className="filters">
          <div className="filter-group">
            <label>Season:</label>
            <select 
              value={season} 
              onChange={(e) => setSeason(parseInt(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Filter by Team:</label>
            <input
              type="text"
              placeholder="Team name..."
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            />
          </div>
          <button onClick={fetchGames}>Apply Filters</button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="no-games">
          {error && error.includes('Database not configured') ? (
            <div className="database-setup-instructions">
              <h3>📊 Database Not Configured</h3>
              <p>{error}</p>
              <h4>To set up the database:</h4>
              <ol>
                <li>Create a D1 database: <code>wrangler d1 create nfl-games-db</code></li>
                <li>Update <code>wrangler.jsonc</code> with the database ID from the command output</li>
                <li>Run migrations: <code>wrangler d1 migrations apply nfl-games-db</code></li>
                <li>Restart your dev server</li>
              </ol>
              <p className="note">Note: The database is optional. You can still use the app to view current games without it.</p>
            </div>
          ) : (
            <p>No games found. The database may be empty. Use /api/db/populate to add games.</p>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="games-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('season_year')} className="sortable">
                  Season {sortBy === 'season_year' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('week_number')} className="sortable">
                  Week {sortBy === 'week_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('game_date')} className="sortable">
                  Date {sortBy === 'game_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('away_team')} className="sortable">
                  Away Team {sortBy === 'away_team' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('home_team')} className="sortable">
                  Home Team {sortBy === 'home_team' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('away_score')} className="sortable">
                  Away Score {sortBy === 'away_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('home_score')} className="sortable">
                  Home Score {sortBy === 'home_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('spread')} className="sortable">
                  Spread {sortBy === 'spread' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('over_under')} className="sortable">
                  O/U {sortBy === 'over_under' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('stadium')} className="sortable">
                  Stadium {sortBy === 'stadium' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('city')} className="sortable">
                  City {sortBy === 'city' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('state')} className="sortable">
                  State {sortBy === 'state' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_temperature')} className="sortable">
                  Temp {sortBy === 'weather_temperature' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_condition')} className="sortable">
                  Condition {sortBy === 'weather_condition' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_humidity')} className="sortable">
                  Humidity {sortBy === 'weather_humidity' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_wind_speed')} className="sortable">
                  Wind Speed {sortBy === 'weather_wind_speed' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_wind_direction')} className="sortable">
                  Wind Dir {sortBy === 'weather_wind_direction' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_precipitation')} className="sortable">
                  Precip {sortBy === 'weather_precipitation' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('weather_description')} className="sortable">
                  Description {sortBy === 'weather_description' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game) => (
                <tr key={game.id}>
                  <td>{game.season_year ?? '—'}</td>
                  <td>{game.week_number ?? '—'}</td>
                  <td>
                    {game.game_date ? (
                      new Date(game.game_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    ) : (
                      '—'
                    )}
                    {game.game_time && game.game_time !== '00:00:00' && (
                      <div className="game-time">
                        {game.game_time.includes(':') ? game.game_time.substring(0, 5) : game.game_time}
                      </div>
                    )}
                  </td>
                  <td>{game.away_team}</td>
                  <td className="home-team">{game.home_team}</td>
                  <td className="score">{game.away_score ?? '—'}</td>
                  <td className="score">{game.home_score ?? '—'}</td>
                  <td className="empty-cell">{game.spread !== null && game.spread !== undefined ? (game.spread > 0 ? `+${game.spread}` : game.spread) : '—'}</td>
                  <td className="empty-cell">{game.over_under !== null && game.over_under !== undefined ? game.over_under : '—'}</td>
                  <td className="empty-cell">{game.stadium || '—'}</td>
                  <td className="empty-cell">{game.city || '—'}</td>
                  <td className="empty-cell">{game.state || '—'}</td>
                  <td className="empty-cell">{game.weather_temperature !== null && game.weather_temperature !== undefined ? `${game.weather_temperature}°F` : '—'}</td>
                  <td className="empty-cell">{game.weather_condition || '—'}</td>
                  <td className="empty-cell">{game.weather_humidity !== null && game.weather_humidity !== undefined ? `${game.weather_humidity}%` : '—'}</td>
                  <td className="empty-cell">{game.weather_wind_speed !== null && game.weather_wind_speed !== undefined ? `${game.weather_wind_speed} mph` : '—'}</td>
                  <td className="empty-cell">{game.weather_wind_direction || '—'}</td>
                  <td className="empty-cell">{game.weather_precipitation !== null && game.weather_precipitation !== undefined ? `${game.weather_precipitation} in` : '—'}</td>
                  <td className="empty-cell">{game.weather_description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <p>Showing {games.length} games</p>
            <p className="data-note">
              Note: Spread, Over/Under, Weather, and Location data will appear for regular season games with complete data.
              Current data shows preseason games which may not include all fields.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

