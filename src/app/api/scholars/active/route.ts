import { NextResponse } from 'next/server';
import { scholarService } from '@/lib/db';

export async function GET() {
  const scholar = await scholarService.getActiveScholar();
  return NextResponse.json({ scholar });
}
