import { Suspense } from 'react';
import NewProposalClient from './NewProposalClient';

export default function NewProposalPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NewProposalClient />
    </Suspense>
  );
}
