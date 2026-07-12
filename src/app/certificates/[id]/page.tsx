import { notFound } from 'next/navigation';
import { certificateService } from '@/lib/db';
import { PrintButton } from './PrintButton';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function CertificatePage({ params }: RouteParams) {
  const { id } = await params;
  const certificate = await certificateService.getCertificateById(id);
  if (!certificate) notFound();

  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 print:py-0">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="mt-6 rounded-2xl border-4 border-double border-pulse-500 bg-white p-10 text-center shadow-sm print:mt-0 print:border-ink-800 print:shadow-none sm:p-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-pulse-600">Cliniolab</p>
        <h1 className="mt-6 font-display text-3xl font-semibold text-ink-800 sm:text-4xl">
          Certificate of Completion
        </h1>
        <p className="mt-8 text-sm text-ink-400">This certifies that</p>
        <p className="mt-2 font-display text-2xl font-medium text-ink-800">
          {certificate.displayName ?? 'A Cliniolab learner'}
        </p>
        <p className="mt-6 text-sm text-ink-400">has successfully completed</p>
        <p className="mt-2 font-display text-xl font-medium text-ink-800">{certificate.quizTitle}</p>

        <div className="mt-10 flex flex-col items-center gap-1">
          <p className="text-sm text-ink-600">Issued {issuedDate}</p>
          <p className="font-mono text-xs text-ink-300">Certificate ID: {certificate.id}</p>
        </div>
      </div>
    </div>
  );
}
