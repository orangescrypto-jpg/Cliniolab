-- One row per completed Study Mode session (the user reached the
-- "Finish studying" summary screen). Mirrors flashcard_attempts in
-- spirit: no score/anti-cheat/retake-policy concept, since Study Mode
-- intentionally never touches quiz_attempts, the leaderboard, or the
-- dashboard history (see StudyModeRunner.tsx). Every finished session
-- is its own row. Powers an "X study attempts" stat on quiz
-- cards/detail pages, separate from the CBT/Exam attemptCount which
-- reads from quiz_attempts.
CREATE TABLE study_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_study_attempts_quiz ON study_attempts(quiz_id);
CREATE INDEX idx_study_attempts_user ON study_attempts(user_id);
