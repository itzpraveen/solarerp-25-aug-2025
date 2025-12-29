"use client";
import Button from "~/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="mx-auto mt-16 max-w-lg rounded border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-sm shadow-[var(--shadow-sm)]">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            An unexpected error occurred. Please try again. {error?.digest ? `(ref: ${error.digest})` : ''}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/overview")}>Go to Overview</Button>
          </div>
        </div>
      </body>
    </html>
  );
}
