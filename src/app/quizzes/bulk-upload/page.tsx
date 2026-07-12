'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { QuizInput, QuizMode, QuizDifficulty, QuestionType, QuestionOption } from '@/types';

// ---------------------------------------------------------------------------
// CSV shape: one row per QUESTION. Rows sharing the same quiz_title are
// grouped into a single quiz. Quiz-level columns (mode, time limit, etc.)
// are read from the first row seen for that title — repeat them on every
// row for that quiz so the sheet stays easy to skim in a spreadsheet.
//
// Columns:
//   quiz_title, subcategory, mode, difficulty, time_limit_minutes,
//   question_type, prompt, option_1, option_2, option_3, option_4,
//   correct_answer, explanation
//
// - mode: study | quiz | exam
// - question_type: mcq | true_false | fill_blank
// - For mcq: correct_answer must exactly match the text of one of the
//   option_N columns for that row.
// - For true_false: correct_answer is "True" or "False"; option columns
//   are ignored.
// - For fill_blank: correct_answer is the accepted text answer; option
//   columns are ignored.
// - time_limit_minutes: leave blank for no timer. Required for exam mode.
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  'quiz_title',
  'subcategory',
  'mode',
  'difficulty',
  'time_limit_minutes',
  'question_type',
  'prompt',
  'option_1',
  'option_2',
  'option_3',
  'option_4',
  'correct_answer',
  'explanation',
];

const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  [
    'Cardiac Basics', 'Cardiology', 'quiz', 'medium', '10',
    'mcq', 'Which chamber pumps blood to the lungs?',
    'Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle',
    'Right ventricle', 'The right ventricle pumps deoxygenated blood to the lungs.',
  ].map(csvEscape).join(','),
  [
    'Cardiac Basics', 'Cardiology', 'quiz', 'medium', '10',
    'true_false', 'The mitral valve is on the right side of the heart.',
    '', '', '', '',
    'False', 'The mitral valve is on the left side, between atrium and ventricle.',
  ].map(csvEscape).join(','),
  [
    'NCLEX Mock Exam A', 'Exam Prep', 'exam', 'hard', '30',
    'fill_blank', 'The normal adult resting heart rate range is ___ to ___ bpm.',
    '', '', '', '',
    '60-100', 'Normal sinus rhythm for adults is generally 60-100 beats per minute.',
  ].map(csvEscape).join(','),
].join('\n');

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Minimal RFC-4180-ish CSV line splitter that handles quoted commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function buildQuestionInput(cols: Record<string, string>): {
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
} {
  const type = (cols.question_type || 'mcq').trim() as QuestionType;
  const prompt = (cols.prompt || '').trim();
  const correctAnswer = (cols.correct_answer || '').trim();
  const explanation = cols.explanation?.trim() || undefined;

  if (type === 'mcq') {
    const options: QuestionOption[] = ['option_1', 'option_2', 'option_3', 'option_4']
      .map((key) => cols[key]?.trim())
      .filter((text): text is string => !!text)
      .map((text) => ({ id: crypto.randomUUID(), text }));

    const matched = options.find((o) => o.text === correctAnswer);
    return {
      type,
      prompt,
      options,
      correctAnswer: matched ? matched.id : correctAnswer,
      explanation,
    };
  }

  return { type, prompt, correctAnswer, explanation };
}

/** Groups flat CSV rows into per-quiz QuizInput objects, in first-seen order. */
function rowsToQuizInputs(
  rows: string[][],
  subcategoryLookup: Map<string, string>
): { quizzes: QuizInput[]; warnings: string[] } {
  const [header, ...body] = rows;
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const warnings: string[] = [];

  const colIndex: Record<string, number> = {};
  for (const h of CSV_HEADERS) colIndex[h] = idx(h);

  const grouped = new Map<string, { meta: Record<string, string>; rows: Record<string, string>[] }>();

  body.forEach((row, i) => {
    const cols: Record<string, string> = {};
    for (const h of CSV_HEADERS) {
      const at = colIndex[h];
      cols[h] = at >= 0 ? (row[at] ?? '') : '';
    }
    const title = cols.quiz_title.trim();
    if (!title) {
      warnings.push(`Row ${i + 2}: missing quiz_title, skipped.`);
      return;
    }
    if (!grouped.has(title)) grouped.set(title, { meta: cols, rows: [] });
    grouped.get(title)!.rows.push(cols);
  });

  const quizzes: QuizInput[] = [];
  for (const [title, { meta, rows: qRows }] of grouped) {
    const subcategoryName = meta.subcategory.trim();
    const subcategoryId = subcategoryLookup.get(subcategoryName.toLowerCase());
    if (!subcategoryId) {
      warnings.push(`Quiz "${title}": subcategory "${subcategoryName}" not recognized, skipped.`);
      continue;
    }

    const mode = (meta.mode.trim() || 'quiz') as QuizMode;
    const minutesRaw = meta.time_limit_minutes.trim();
    const minutes = minutesRaw ? Number(minutesRaw) : undefined;
    const timeLimitSeconds = minutes && minutes > 0 ? minutes * 60 : undefined;

    if (mode === 'exam' && !timeLimitSeconds) {
      warnings.push(`Quiz "${title}": exam mode requires time_limit_minutes, skipped.`);
      continue;
    }

    quizzes.push({
      subcategoryId,
      title,
      mode,
      difficulty: (meta.difficulty.trim() || 'medium') as QuizDifficulty,
      visibility: 'public',
      timeLimitSeconds,
      antiCheatEnabled: false,
      retakePolicy: 'unlimited',
      pricing: 'free',
      questions: qRows.map(buildQuestionInput),
    });
  }

  return { quizzes, warnings };
}

export default function BulkUploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuizzes, setParsedQuizzes] = useState<QuizInput[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] = useState<{ name: string; id: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);

  const subcategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subcategoryOptions) map.set(s.name.toLowerCase(), s.id);
    return map;
  }, [subcategoryOptions]);

  async function ensureSubcategoriesLoaded() {
    if (subcategoryOptions.length > 0) return subcategoryLookup;
    const res = await fetch('/api/categories');
    const data = await res.json();
    const options = (data.subcategories ?? []).map((s: { id: string; name: string }) => ({
      id: s.id,
      name: s.name,
    }));
    setSubcategoryOptions(options);
    const map = new Map<string, string>();
    for (const s of options) map.set(s.name.toLowerCase(), s.id);
    return map;
  }

  async function handleFile(file: File) {
    setSubmitError(null);
    setSubmittedCount(null);
    setFileName(file.name);
    const lookup = await ensureSubcategoriesLoaded();
    const text = await file.text();

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const data = JSON.parse(text);
        const quizzes: QuizInput[] = Array.isArray(data) ? data : data.quizzes;
        if (!Array.isArray(quizzes)) throw new Error('JSON must be an array or { "quizzes": [...] }');
        setParsedQuizzes(quizzes);
        setWarnings([]);
      } else {
        const rows = parseCsv(text);
        if (rows.length < 2) throw new Error('CSV has no data rows.');
        const { quizzes, warnings: w } = rowsToQuizInputs(rows, lookup);
        setParsedQuizzes(quizzes);
        setWarnings(w);
      }
    } catch (err) {
      setParsedQuizzes([]);
      setSubmitError(err instanceof Error ? err.message : 'Could not parse file.');
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cliniolab-bulk-quiz-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit() {
    if (parsedQuizzes.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/quizzes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizzes: parsedQuizzes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Upload failed');
        return;
      }
      setSubmittedCount(data.quizzes?.length ?? parsedQuizzes.length);
      setParsedQuizzes([]);
      setFileName(null);
    } catch {
      setSubmitError('Network error while uploading. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
        <p className="mt-2 text-ink-500">You need an account to upload quizzes.</p>
        <Button className="mt-6" onClick={() => router.push('/login')}>Log in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-ink-800">Upload many quizzes</h1>
      <p className="mt-2 text-ink-500">
        Create several quizzes at once from a spreadsheet or JSON file, instead of building
        them one by one.
      </p>

      {/* Guided walkthrough */}
      <Card className="mt-8 space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">How it works</h2>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
          <li>
            Download the CSV template below and open it in Excel, Google Sheets, or Numbers.
          </li>
          <li>
            Each row is one <strong>question</strong>. Give every question for the same quiz the
            same <code className="rounded bg-ink-50 px-1">quiz_title</code> — that's how rows get
            grouped into one quiz.
          </li>
          <li>
            Set <code className="rounded bg-ink-50 px-1">mode</code> per quiz to{' '}
            <strong>study</strong> (see answers immediately), <strong>quiz</strong>{' '}
            (untimed by default, or timed for speed-drills), or <strong>exam</strong>{' '}
            (always timed, CBT-style). All three are supported in the same upload.
          </li>
          <li>
            Set <code className="rounded bg-ink-50 px-1">time_limit_minutes</code> if you want a
            timer — required for exam mode, optional for quiz mode, ignored for study mode.
          </li>
          <li>
            Fill <code className="rounded bg-ink-50 px-1">subcategory</code> with an exact
            category name from Cliniolab (e.g. "Cardiology", "Exam Prep"). Rows with an unknown
            subcategory are skipped and listed as a warning before you upload.
          </li>
          <li>Save as CSV, come back here, and upload the file. Review the preview, then publish.</li>
        </ol>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="secondary" onClick={downloadTemplate}>
            Download CSV template
          </Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Choose file to upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
        <p className="text-xs text-ink-400">
          Accepts <strong>.csv</strong> (recommended, spreadsheet-friendly) or{' '}
          <strong>.json</strong> (an array of quiz objects, or{' '}
          <code className="rounded bg-ink-50 px-1">{'{ "quizzes": [...] }'}</code>, for anyone
          exporting from another tool).
        </p>
      </Card>

      {fileName && (
        <p className="mt-6 text-sm text-ink-500">
          Selected file: <span className="font-medium text-ink-700">{fileName}</span>
        </p>
      )}

      {warnings.length > 0 && (
        <Card className="mt-4 border-flag-200 bg-flag-50 p-4">
          <p className="text-sm font-medium text-flag-700">Some rows were skipped</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-flag-700">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {parsedQuizzes.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Preview — {parsedQuizzes.length} quiz{parsedQuizzes.length === 1 ? '' : 'zes'} ready to
            upload
          </h2>
          <div className="mt-4 space-y-3">
            {parsedQuizzes.map((q, i) => (
              <div key={i} className="rounded-md border border-ink-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink-800">{q.title}</p>
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                    {q.mode}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {q.questions.length} question{q.questions.length === 1 ? '' : 's'}
                  {q.timeLimitSeconds ? ` · ${Math.round(q.timeLimitSeconds / 60)} min timer` : ' · no timer'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Publishing…' : `Publish ${parsedQuizzes.length} quizzes`}
            </Button>
            <Button variant="secondary" onClick={() => { setParsedQuizzes([]); setFileName(null); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {submitError && <p className="mt-4 text-sm text-critical-500">{submitError}</p>}

      {submittedCount !== null && (
        <Card className="mt-6 border-pulse-200 bg-pulse-50 p-4">
          <p className="text-sm font-medium text-pulse-700">
            {submittedCount} quiz{submittedCount === 1 ? '' : 'zes'} published successfully.
          </p>
          <Button className="mt-3" size="sm" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
