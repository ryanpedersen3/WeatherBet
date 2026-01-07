-- Create NFL games historical database table
-- Stores games from the last 10 years with teams, scores, weather, and spread

CREATE TABLE IF NOT EXISTS nfl_games (
  id TEXT PRIMARY KEY,
  season_year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  game_date TEXT NOT NULL,
  game_time TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  spread REAL,
  over_under REAL,
  stadium TEXT,
  city TEXT,
  state TEXT,
  latitude REAL,
  longitude REAL,
  weather_temperature INTEGER,
  weather_condition TEXT,
  weather_humidity INTEGER,
  weather_wind_speed REAL,
  weather_wind_direction TEXT,
  weather_precipitation REAL,
  weather_description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_game_date ON nfl_games(game_date);
CREATE INDEX IF NOT EXISTS idx_season_week ON nfl_games(season_year, week_number);
CREATE INDEX IF NOT EXISTS idx_home_team ON nfl_games(home_team);
CREATE INDEX IF NOT EXISTS idx_away_team ON nfl_games(away_team);
CREATE INDEX IF NOT EXISTS idx_teams ON nfl_games(home_team, away_team);

