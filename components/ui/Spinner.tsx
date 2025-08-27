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
      className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400 ${className || ''}`}
      style={{ width: px, height: px }}
    />
  );
}
