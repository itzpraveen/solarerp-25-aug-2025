"use client";
import { useEffect, useMemo, useState } from "react";
import Card from "~/components/ui/Card";
import Button from "~/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Task = {
  id: string;
  title: string | null;
  status: "Open" | "InProgress" | "Blocked" | "Done" | null;
  due_date: string | null;
  priority: "Low" | "Medium" | "High" | "Urgent" | null;
  assigned_to: string | null;
};

export default function NextActionCard({ jobId }: { jobId: string }) {
  const supabase = supabaseBrowser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [me, setMe] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("job_id", jobId);
    const { data: user } = await supabase.auth.getUser();
    setMe(((user?.user as any)?.id as string) || "");
    setTasks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const next = useMemo(() => {
    const rankPriority = (p?: string | null) =>
      p === "Urgent" ? 0 : p === "High" ? 1 : p === "Medium" ? 2 : 3;
    const openish = tasks.filter((t) => t.status !== "Done");
    openish.sort((a, b) => {
      const aOver = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bOver = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (aOver !== bOver) return aOver - bOver;
      const p = rankPriority(a.priority) - rankPriority(b.priority);
      if (p !== 0) return p;
      const sa = a.status === "InProgress" ? 0 : a.status === "Blocked" ? 1 : 2;
      const sb = b.status === "InProgress" ? 0 : b.status === "Blocked" ? 1 : 2;
      return sa - sb;
    });
    return openish.slice(0, 3);
  }, [tasks]);

  const act = async (id: string, patch: Partial<Task>) => {
    await supabase.from("tasks").update(patch).eq("id", id);
    await load();
  };

  if (loading) return <Card title="Next Actions">Loading…</Card>;

  return (
    <Card
      title="Next Actions"
      actions={<a className="text-xs text-blue-600" href={`#tasks`}>View all</a>}
    >
      {next.length === 0 ? (
        <div className="text-sm text-gray-600">No open tasks. You're clear.</div>
      ) : (
        <ul className="space-y-2">
          {next.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.title || "—"}</div>
                <div className="text-xs text-gray-600">
                  {(t.due_date && `Due ${t.due_date}`) || "No due date"} • {t.priority || "Medium"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {t.status !== "InProgress" && t.status !== "Done" && (
                  <Button size="xs" variant="outline" onClick={() => act(t.id, { status: "InProgress" })}>Start</Button>
                )}
                {t.status !== "Done" && (
                  <Button size="xs" onClick={() => act(t.id, { status: "Done" })}>Done</Button>
                )}
                {me && (!t.assigned_to || t.assigned_to === "") && (
                  <Button size="xs" variant="outline" onClick={() => act(t.id, { assigned_to: me })}>Assign me</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

