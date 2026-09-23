import { NextResponse } from 'next/server';
import { isValidCronSecret } from '@/lib/push/cronSecretConfig';
import { runOrphanSweep } from '@/lib/storage/orphanSweep';

/**
 * Weekly R2 orphan sweep: deletes stored images that no database row
 * references (left behind by failed deletes, abandoned uploads, or replaced
 * covers). Same shared-secret auth as the other cron routes.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || !(await isValidCronSecret(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runOrphanSweep({ dryRun: false });
  return NextResponse.json(result);
}
