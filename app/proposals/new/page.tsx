import { Suspense } from 'react';
import NewProposalClient from './NewProposalClient';

export default function NewProposalPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="rounded border bg-white p-4">
            <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-24 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-10 w-40 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      }
    >
      <NewProposalClient />
    </Suspense>
  );
}
