export default function JobCard({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <a className="block rounded border bg-white p-3 shadow-sm hover:shadow" href={href}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-gray-600">{subtitle}</div>
    </a>
  );
}

