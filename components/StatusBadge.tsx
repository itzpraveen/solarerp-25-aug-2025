export default function StatusBadge({ status }: { status: string }) {
  const c =
    status.includes('Won') || status.includes('Closed')
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${c}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
