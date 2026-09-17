-- One row per completed run through a flashcard set - i.e. the user
-- flipped/marked their way through every card and reached the end.
-- Mirrors quiz_attempts in spirit (a row = "this was actually finished"),
-- but far simpler: no score/anti-cheat/retake-policy concept for
-- flashcards, so every completed session is recorded, one row each,
-- unlike quiz_attempts which sometimes only persists the first try.
-- Powers the "X attempts" stat shown on flashcard set cards, matching
-- the equivalent quiz stat.
CREATE TABLE flashcard_attempts (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES flashcard_sets(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_flashcard_attempts_set ON flashcard_attempts(set_id);
CREATE INDEX idx_flashcard_attempts_user ON flashcard_attempts(user_id);
