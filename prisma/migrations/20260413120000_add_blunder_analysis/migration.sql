-- Blunder Analysis cache table
CREATE TABLE IF NOT EXISTS blunder_analyses (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  game_id INT NOT NULL REFERENCES chess_games(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  move_played TEXT NOT NULL,
  move_played_lan TEXT NOT NULL,
  best_move_lan TEXT,
  eval_before DOUBLE PRECISION,
  eval_after DOUBLE PRECISION,
  prob_drop DOUBLE PRECISION NOT NULL,
  white TEXT NOT NULL,
  black TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blunder_player ON blunder_analyses(player_name);
CREATE INDEX IF NOT EXISTS idx_blunder_game ON blunder_analyses(game_id);

-- Blunder Scan tracking table
CREATE TABLE IF NOT EXISTS blunder_scan_logs (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  games_scanned INT NOT NULL,
  total_games INT NOT NULL,
  last_game_id INT,
  scanned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_player ON blunder_scan_logs(player_name);
