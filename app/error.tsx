"use client";
import Button from "~/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded border bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-semibold">Page error</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        We hit a snag loading this page. {error?.message || ''}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={reset}>Retry</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/overview")}>Home</Button>
      </div>
    </div>
  );
}

