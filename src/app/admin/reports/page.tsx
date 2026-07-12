'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { QuestionReportWithContext } from '@/types';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<QuestionReportWithContext[]>([]);

  function load() {
    fetch('/api/admin/reports')
      .then((res) => res.json())
      .then((data) => setReports(data.reports ?? []));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: 'reviewed' | 'dismissed') {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Question reports</h1>
      <div className="mt-6 space-y-3">
        {reports.map((report) => (
          <Card key={report.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-flag-600">{report.quizTitle}</p>
              <p className="mt-1 text-sm font-medium text-ink-800">{report.questionPrompt}</p>
              {report.reason && <p className="mt-1 text-sm text-ink-700">{report.reason}</p>}
              <p className="mt-1 text-xs text-ink-400">
                {new Date(report.createdAt).toLocaleDateString()}
                {report.reporterName && ` · flagged by ${report.reporterName}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => updateStatus(report.id, 'reviewed')}>
                Mark reviewed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus(report.id, 'dismissed')}>
                Dismiss
              </Button>
            </div>
          </Card>
        ))}
        {reports.length === 0 && <p className="text-sm text-ink-400">No open reports.</p>}
      </div>
    </div>
  );
}
