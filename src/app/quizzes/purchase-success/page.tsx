'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function PurchaseSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Flutterwave appends tx_ref, transaction_id, and status to the redirect
  // URL. If the buyer cancelled or the payment failed before completion,
  // transaction_id may be absent - handle that without calling verify.
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');
  const redirectStatus = searchParams.get('status');
  const quizId = searchParams.get('quizId');
  const [status, setStatus] = useState<'verifying' | 'completed' | 'failed'>('verifying');

  useEffect(() => {
    if (!txRef) return;
    if (redirectStatus === 'cancelled' || !transactionId) {
      setStatus('failed');
      return;
    }
    fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txRef, transactionId }),
    })
      .then((res) => res.json())
      .then((data) => setStatus(data.status === 'completed' ? 'completed' : 'failed'))
      .catch(() => setStatus('failed'));
  }, [txRef, transactionId, redirectStatus]);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <Card className="p-8">
        {status === 'verifying' && <p className="text-sm text-ink-500">Confirming your payment…</p>}
        {status === 'completed' && (
          <>
            <p className="font-display text-xl font-semibold text-pulse-600">Payment confirmed!</p>
            <p className="mt-2 text-sm text-ink-500">The quiz is now unlocked.</p>
            <Button className="mt-6" onClick={() => router.push(`/quizzes/${quizId}`)}>
              Go to quiz
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

export default function PurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <Card className="p-8">
            <p className="text-sm text-ink-500">Loading…</p>
          </Card>
        </div>
      }
    >
      <PurchaseSuccessContent />
    </Suspense>
  );
}
