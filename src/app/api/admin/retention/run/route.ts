import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { retentionService } from '@/lib/db';
import { runOrphanSweep } from '@/lib/storage/orphanSweep';

/**
 * Manual "run it now" for the admin Storage page, in case the cron did not
 * fire. Runs the exact same code as the cron routes.
 *
 * Body: { action: 'retention' | 'orphans-preview' | 'orphans-delete' }
 *  - retention:      purge data past the configured windows
 *  - orphans-preview: report orphaned images WITHOUT deleting anything
 *  - orphans-delete:  delete orphaned images
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    switch (body.action) {
      case 'retention':
        return NextResponse.json({ action: 'retention', result: await retentionService.runRetention() });
      case 'orphans-preview':
        return NextResponse.json({ action: 'orphans-preview', result: await runOrphanSweep({ dryRun: true }) });
      case 'orphans-delete':
        return NextResponse.json({ action: 'orphans-delete', result: await runOrphanSweep({ dryRun: false }) });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Manual storage cleanup failed:', err);
    return NextResponse.json({ error: 'Cleanup failed. Check the server logs.' }, { status: 500 });
  }
}
