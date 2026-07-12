import { NextResponse } from 'next/server';
import { featureFlagService } from '@/lib/db';
import type { FeatureFlagKey } from '@/types';

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { key } = await params;
  const enabled = await featureFlagService.isFeatureEnabled(key as FeatureFlagKey);
  return NextResponse.json({ enabled });
}
