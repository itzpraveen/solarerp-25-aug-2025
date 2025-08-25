"use client";
import PipelineBoard from 'components/PipelineBoard';
import Button from '~/components/ui/Button';

export default function JobsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => (window.location.href = '/customers')}>Customers</Button>
          <Button size="sm" onClick={() => (window.location.href = '/leads')}>Leads</Button>
        </div>
      </div>
      <PipelineBoard />
    </div>
  );
}
