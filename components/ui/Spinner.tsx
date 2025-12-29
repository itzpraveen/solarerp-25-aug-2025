export default function Spinner({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--primary-500)] ${className || ''}`}
      style={{ width: px, height: px }}
    />
  );
}
