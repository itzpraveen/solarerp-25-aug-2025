export default function MoneyCard({ title, amount, currency = 'INR' }: { title: string; amount?: number | null; currency?: string }) {
  const fmt = (v?: number | null) => (typeof v === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v) : '—');
  return (
    <div className="rounded border bg-white p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-xl font-semibold">{fmt(amount || 0)}</div>
    </div>
  );
}

