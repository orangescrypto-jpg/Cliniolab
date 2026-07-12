import { NextResponse } from 'next/server';
import { siteSettingsService } from '@/lib/db';

export async function GET() {
  const setting = await siteSettingsService.getCookieConsentSetting();
  return NextResponse.json({ setting });
}
