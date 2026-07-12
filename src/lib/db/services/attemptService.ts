import { getDb, generateId, nowIso } from '@/lib/db/client';
import { getQuizById, getQuizQuestions } from '@/lib/db/services/quizService';
import type { AttemptResult, AttemptSubmission, QuizAttempt } from '@/types';

interface AttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number | null;
  counts_for_leaderboard: number;
  started_at: string;
  completed_at: string | null;
}

function mapAttempt(row: AttemptRow): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userId: row.user_id,
    score: row.score,
    totalQuestions: row.total_questions,
    timeTakenSeconds: row.time_taken_seconds,
    countsForLeaderboard: row.counts_for_leaderboard === 1,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export class RetakeNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetakeNotAllowedError';
  }
}

/**
 * Checks whether a user is allowed to attempt a quiz right now, based on
 * the quiz's anti-cheat/retake settings. Throws RetakeNotAllowedError if not.
 */
async function assertRetakeAllowed(quizId: string, userId: string): Promise<void> {
  const quiz = await getQuizById(quizId);
  if (!quiz) throw new Error('Quiz not found');
  if (!quiz.antiCheatEnabled || quiz.retakePolicy === 'unlimited') return;

  const db = getDb();
  const { results } = await db
    .prepare(
      'SELECT started_at FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? ORDER BY started_at DESC'
    )
    .bind(quizId, userId)
    .all<{ started_at: string }>();

  if (results.length === 0) return;

  switch (quiz.retakePolicy) {
    case 'single':
      throw new RetakeNotAllowedError('This quiz allows only one attempt.');
    case 'daily_limit': {
      const limit = quiz.retakeLimit ?? 1;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const attemptsToday = results.filter(
        (r) => new Date(r.started_at).getTime() >= todayStart.getTime()
      ).length;
      if (attemptsToday >= limit) {
        throw new RetakeNotAllowedError(`Daily attempt limit (${limit}) reached for this quiz.`);
      }
      return;
    }
    case 'cooldown': {
      const cooldownSeconds = quiz.retakeLimit ?? 3600;
      const lastAttempt = new Date(results[0].started_at).getTime();
      const elapsedSeconds = (Date.now() - lastAttempt) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        const waitMinutes = Math.ceil((cooldownSeconds - elapsedSeconds) / 60);
        throw new RetakeNotAllowedError(`Please wait ${waitMinutes} more minute(s) before retaking.`);
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Whether a quiz on unlimited retakes already has a recorded (persisted)
 * attempt for this user. Per product rule: for unlimited-retake quizzes,
 * only the FIRST attempt is ever written to quiz_attempts (and therefore
 * counts toward the leaderboard and the dashboard's history/score chart).
 * Every attempt after that is graded and shown to the user, but nothing
 * is persisted for it - this keeps the table from growing unbounded on
 * popular quizzes with no retake limit.
 */
async function hasRecordedAttempt(quizId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? LIMIT 1')
    .bind(quizId, userId)
    .first<{ id: string }>();
  return !!existing;
}

export async function submitAttempt(
  userId: string,
  submission: AttemptSubmission
): Promise<AttemptResult> {
  await assertRetakeAllowed(submission.quizId, userId);

  const quiz = await getQuizById(submission.quizId);
  if (!quiz) throw new Error('Quiz not found');

  const questions = await getQuizQuestions(submission.quizId);
  if (questions.length === 0) throw new Error('Quiz has no questions');

  const answerMap = new Map(submission.answers.map((a) => [a.questionId, a.submittedAnswer]));

  let score = 0;
  const perQuestion = questions.map((q) => {
    const submittedAnswer = answerMap.get(q.id) ?? null;
    const isCorrect =
      submittedAnswer !== null &&
      submittedAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    if (isCorrect) score += 1;
    return {
      questionId: q.id,
      prompt: q.prompt,
      submittedAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const percentage = (score / questions.length) * 100;

  // On unlimited-retake quizzes, only the first attempt is ever persisted.
  // Later attempts are graded and returned to the user but not written to
  // quiz_attempts, so they don't affect the leaderboard or dashboard
  // history, and don't bloat the table with throwaway retries.
  const isUnlimitedRetake = !quiz.antiCheatEnabled || quiz.retakePolicy === 'unlimited';
  if (isUnlimitedRetake) {
    const alreadyRecorded = await hasRecordedAttempt(submission.quizId, userId);
    if (alreadyRecorded) {
      return {
        attemptId: generateId('unrecorded'), // not persisted; id is only for client-side keying
        score,
        totalQuestions: questions.length,
        percentage,
        countedForLeaderboard: false,
        perQuestion,
      };
    }
  }

  const db = getDb();
  const attemptId = generateId('attempt');
  const now = nowIso();

  const attemptStatement = db
    .prepare(
      `INSERT INTO quiz_attempts
        (id, quiz_id, user_id, score, total_questions, time_taken_seconds, counts_for_leaderboard, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      attemptId,
      submission.quizId,
      userId,
      score,
      questions.length,
      submission.timeTakenSeconds,
      1, // this is either the only attempt allowed, or the first (and only recorded) attempt
      now,
      now
    );

  const answerStatements = perQuestion.map((pq) =>
    db
      .prepare(
        `INSERT INTO attempt_answers (id, attempt_id, question_id, submitted_answer, is_correct)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(generateId('ans'), attemptId, pq.questionId, pq.submittedAnswer, pq.isCorrect ? 1 : 0)
  );

  await db.batch([attemptStatement, ...answerStatements]);

  return {
    attemptId,
    score,
    totalQuestions: questions.length,
    percentage,
    countedForLeaderboard: true,
    perQuestion,
  };
}

export async function getAttemptsByUser(userId: string): Promise<QuizAttempt[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY started_at DESC')
    .bind(userId)
    .all<AttemptRow>();
  return results.map(mapAttempt);
}

export async function getAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]> {
  const db = getDb();
  const { results } = await db
    .prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY started_at DESC')
    .bind(quizId)
    .all<AttemptRow>();
  return results.map(mapAttempt);
}
