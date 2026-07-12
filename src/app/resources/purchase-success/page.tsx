'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function ResourcePurchaseSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');
  const redirectStatus = searchParams.get('status');
  const resourceId = searchParams.get('resourceId');
  const [status, setStatus] = useState<'verifying' | 'confirmed' | 'failed'>('verifying');

  useEffect(() => {
    if (!txRef || !resourceId) return;
    if (redirectStatus === 'cancelled' || !transactionId) {
      setStatus('failed');
      return;
    }
    fetch(`/api/resources/${resourceId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txRef, transactionId }),
    })
      .then((res) => res.json())
      .then((data) => setStatus(data.status === 'confirmed' ? 'confirmed' : 'failed'))
      .catch(() => setStatus('failed'));
  }, [txRef, transactionId, redirectStatus, resourceId]);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <Card className="p-8">
        {status === 'verifying' && <p className="text-sm text-ink-500">Confirming your payment…</p>}
        {status === 'confirmed' && (
          <>
            <p className="font-display text-xl font-semibold text-pulse-600">Payment confirmed!</p>
            <p className="mt-2 text-sm text-ink-500">The resource is now unlocked for download.</p>
            <Button className="mt-6" onClick={() => router.push('/resources')}>
              Go to resources
            </Button>
          </>
        )}
        {status === 'failed' && (
          <>
            <p className="font-display text-xl font-semibold text-critical-500">Payment not confirmed</p>
            <p className="mt-2 text-sm text-ink-500">
              If you were charged, please contact support with your reference: {txRef}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
