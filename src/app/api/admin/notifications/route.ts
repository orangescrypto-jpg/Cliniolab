import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { getVapidSetting, setVapidSetting } from '@/lib/push/vapidConfig';
import { getCronSecret, setCronSecret } from '@/lib/push/cronSecretConfig';

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 6) return '••••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const vapid = await getVapidSetting();
  const cronSecret = await getCronSecret();

  return NextResponse.json({
    vapid: {
      publicKey: vapid.publicKey,
      // Never send the raw private key back to the client once saved —
      // only whether one is configured, masked for confirmation.
      privateKeyConfigured: Boolean(vapid.privateKey),
      privateKeyMasked: maskSecret(vapid.privateKey),
      subject: vapid.subject,
    },
    cron: {
      secretConfigured: Boolean(cronSecret),
      secretMasked: maskSecret(cronSecret),
    },
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: {
    vapid?: { publicKey?: string; privateKey?: string; subject?: string };
    cronSecret?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.vapid) {
    const current = await getVapidSetting();
    await setVapidSetting({
      publicKey: body.vapid.publicKey?.trim() ?? current.publicKey,
      // Only overwrite the private key if a new non-empty value was sent,
      // so re-saving the public key or subject doesn't blank it out.
      privateKey: body.vapid.privateKey?.trim() || current.privateKey,
      subject: body.vapid.subject?.trim() || current.subject,
    });
  }

  if (typeof body.cronSecret === 'string' && body.cronSecret.trim()) {
    await setCronSecret(body.cronSecret.trim());
  }

  const vapid = await getVapidSetting();
  const cronSecret = await getCronSecret();
  return NextResponse.json({
    vapid: {
      publicKey: vapid.publicKey,
      privateKeyConfigured: Boolean(vapid.privateKey),
      privateKeyMasked: maskSecret(vapid.privateKey),
      subject: vapid.subject,
    },
    cron: {
      secretConfigured: Boolean(cronSecret),
      secretMasked: maskSecret(cronSecret),
    },
  });
}
