'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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

/**
 * Reads any supported spreadsheet (xlsx, xls, ods, csv) with SheetJS and
 * returns the first sheet as a plain grid of strings — same shape the old
 * CSV-only parser produced, so the rest of the pipeline doesn't change.
 */
async function parseSpreadsheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  return grid
    .map((row) => row.map((cell) => (cell ?? '').toString()))
    .filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Checks the header row against the expected columns and returns
 * human-readable warnings for anything missing, misspelled, or extra —
 * this is what lets a quiz maker see exactly what to fix instead of
 * silently getting empty/skipped rows.
 */
function validateHeaders(header: string[]): string[] {
  const warnings: string[] = [];
  const normalized = header.map((h) => h.trim().toLowerCase());
  const required = ['quiz_title', 'subcategory', 'question_type', 'prompt', 'correct_answer'];

  for (const col of required) {
    if (!normalized.includes(col)) {
      warnings.push(`Missing required column "${col}". Add it as a header in row 1.`);
    }
  }

  const known = new Set<string>(CSV_HEADERS);
  const unknown = header.filter((h) => h.trim() && !known.has(h.trim().toLowerCase()));
  if (unknown.length > 0) {
    warnings.push(
      `Unrecognized column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Check for typos — these will be ignored.`
    );
  }

  return warnings;
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
  const warnings: string[] = validateHeaders(header);

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
    const lowerName = file.name.toLowerCase();

    try {
      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const quizzes: QuizInput[] = Array.isArray(data) ? data : data.quizzes;
        if (!Array.isArray(quizzes)) throw new Error('JSON must be an array or { "quizzes": [...] }');
        setParsedQuizzes(quizzes);
        setWarnings([]);
      } else {
        // Handles .xlsx, .xls, .ods, and .csv — all read the same way via SheetJS.
        const rows = await parseSpreadsheet(file);
        if (rows.length < 2) {
          throw new Error(
            'No data rows found. Row 1 must be the column headers, with your questions starting on row 2.'
          );
        }
        const { quizzes, warnings: w } = rowsToQuizInputs(rows, lookup);
        setParsedQuizzes(quizzes);
        setWarnings(w);
      }
    } catch (err) {
      setParsedQuizzes([]);
      setSubmitError(err instanceof Error ? err.message : 'Could not parse file.');
    }
  }

  /** Builds the template as a real .xlsx workbook — easiest format for quiz makers to edit. */
  function downloadTemplate() {
    const rows = CSV_TEMPLATE.split('\n').map((line) => parseTemplateLine(line));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = CSV_HEADERS.map((h) =>
      h === 'prompt' || h === 'explanation' ? { wch: 40 } : { wch: 16 }
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quiz Upload');
    XLSX.writeFile(workbook, 'cliniolab-bulk-quiz-template.xlsx');
  }

  function parseTemplateLine(line: string): string[] {
    // The CSV_TEMPLATE constant is already comma-escaped; reuse the same
    // quoted-comma-aware split so the xlsx template gets clean cells.
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
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
        result.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    result.push(field);
    return result;
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
        Create several quizzes at once from a spreadsheet, instead of building them one by
        one. Download the template, fill it in, upload it — that's it.
      </p>

      {/* Guided walkthrough */}
      <Card className="mt-8 space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-ink-800">How it works</h2>
        <ol className="ml-4 list-decimal space-y-2 text-sm text-ink-600">
          <li>
            Download the template below and open it in Excel, Google Sheets, Numbers, or any
            spreadsheet app. Row 1 (the headers) must stay exactly as it is — don't rename,
            reorder, or delete columns.
          </li>
          <li>
            Each row is one <strong>question</strong>. Start your questions on row 2. Give every
            question for the same quiz the exact same{' '}
            <code className="rounded bg-ink-50 px-1">quiz_title</code> (spelled identically,
            including capitalization) — that's how rows get grouped into one quiz.
          </li>
          <li>
            <code className="rounded bg-ink-50 px-1">question_type</code> must be one of{' '}
            <strong>mcq</strong>, <strong>true_false</strong>, or <strong>fill_blank</strong>.
            For <strong>mcq</strong>, fill in <code className="rounded bg-ink-50 px-1">option_1</code>
            {' '}through <code className="rounded bg-ink-50 px-1">option_4</code> and make{' '}
            <code className="rounded bg-ink-50 px-1">correct_answer</code> match one of them{' '}
            <em>exactly</em>, including punctuation and spacing. For{' '}
            <strong>true_false</strong>, leave the option columns blank and set{' '}
            <code className="rounded bg-ink-50 px-1">correct_answer</code> to "True" or "False".
            For <strong>fill_blank</strong>, leave the option columns blank and put the accepted
            text answer in <code className="rounded bg-ink-50 px-1">correct_answer</code>.
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
          <li>
            <code className="rounded bg-ink-50 px-1">difficulty</code> is optional —{' '}
            <strong>easy</strong>, <strong>medium</strong>, or <strong>hard</strong>. Leave it
            blank and it defaults to medium.{' '}
            <code className="rounded bg-ink-50 px-1">explanation</code> is optional too, and
            shown to the learner after they answer.
          </li>
          <li>
            Save the file and upload it below. You'll get a preview with any problem rows
            called out before anything is published — nothing goes live until you hit Publish.
          </li>
        </ol>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="secondary" onClick={downloadTemplate}>
            Download template (.xlsx)
          </Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Choose file to upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
        <p className="text-xs text-ink-400">
          Accepts <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong>, and{' '}
          <strong>.csv</strong> spreadsheets, or <strong>.json</strong> (an array of quiz
          objects, or <code className="rounded bg-ink-50 px-1">{'{ "quizzes": [...] }'}</code>,
          for anyone exporting from another tool).
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
