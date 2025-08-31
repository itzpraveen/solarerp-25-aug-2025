'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

type Task = {
  id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
  job_id: string | null;
};

type Prof = { user_id: string; display_name: string | null; role: string | null };

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1); x.setHours(0,0,0,0);
  return x;
}
function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0); x.setHours(23,59,59,999);
  return x;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0..6 Sun..Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}

export default function CalendarPage() {
  const supabase = supabaseBrowser();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [me, setMe] = useState<{ user_id: string; tenant_id: string } | null>(null);
  const [assignee, setAssignee] = useState<string | 'all' | 'me'>('all');
  const [loading, setLoading] = useState(true);
  const from = useMemo(() => startOfWeek(startOfMonth(month)), [month]);
  const to = useMemo(() => {
    const e = endOfMonth(month);
    const endWeek = startOfWeek(new Date(e.getTime() + 7 * 24 * 3600 * 1000));
    const x = new Date(endWeek); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999);
    return x;
  }, [month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Identify current user + tenant
        const { data: auth } = await supabase.auth.getUser();
        const uid = (auth.user as any)?.id as string | undefined;
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('user_id, tenant_id, display_name, role')
            .eq('user_id', uid)
            .maybeSingle();
          if (prof) setMe({ user_id: (prof as any).user_id, tenant_id: (prof as any).tenant_id });
        }
        // Load technicians/staff as candidate assignees
        const { data: members } = await supabase
          .from('profiles')
          .select('user_id, display_name, role');
        const list = ((members as any[]) || []).filter(
          (p) => ['technician', 'staff', 'manager', 'owner', 'admin'].includes(String(p.role || '')),
        );
        setProfiles(list);

        // Load tasks for calendar range (exclude Done)
        const { data: ts } = await supabase
          .from('tasks')
          .select('id, title, status, due_date, assigned_to, job_id')
          .gte('due_date', from.toISOString().slice(0, 10))
          .lte('due_date', to.toISOString().slice(0, 10))
          .neq('status', 'Done')
          .order('due_date', { ascending: true })
          .limit(500);
        setTasks(((ts as any[]) || []).map((t) => ({ ...t })));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, from, to]);

  const days: Date[] = useMemo(() => {
    const arr: Date[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [from, to]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    const meId = me?.user_id || '';
    for (const t of tasks) {
      const d = (t.due_date || '').slice(0, 10);
      if (!d) continue;
      if (assignee === 'me' && t.assigned_to !== meId) continue;
      if (assignee !== 'all' && assignee !== 'me' && t.assigned_to !== assignee) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return map;
  }, [tasks, assignee, me]);

  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(month);
  const profName = (id: string | null) => {
    if (!id) return 'Unassigned';
    const p = profiles.find((x) => x.user_id === id);
    return p?.display_name || p?.user_id?.slice(0, 6) || 'User';
  };

  async function assignTask(taskId: string, userId: string | null) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch('/api/tasks/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ taskId, userId }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assigned_to: userId } : t)));
    } else {
      const out = await res.json().catch(() => ({}));
      alert(out?.error || 'Failed to assign');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Technician Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm dark:border-gray-700"
            onClick={() => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth()-1); return startOfMonth(d); })}
          >
            Prev
          </button>
          <div className="min-w-[160px] text-center text-sm">{monthLabel}</div>
          <button
            className="rounded border px-2 py-1 text-sm dark:border-gray-700"
            onClick={() => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth()+1); return startOfMonth(d); })}
          >
            Next
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">Assignee</label>
        <select
          className="rounded border px-2 py-1 text-sm dark:border-gray-700"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="me">Me</option>
          {profiles.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.display_name || p.user_id.slice(0, 6)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-7 gap-2 text-sm">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <div key={d} className="px-2 py-1 text-center font-medium text-gray-500">{d}</div>
        ))}
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const list = byDate.get(key) || [];
          const isCurMonth = d.getMonth() === month.getMonth();
          return (
            <div key={key} className={`min-h-[120px] rounded border p-2 ${isCurMonth ? '' : 'opacity-50'} dark:border-gray-700`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">{d.getDate()}</div>
                {list.length > 0 && (
                  <div className="rounded bg-blue-600/10 px-1 text-[10px] text-blue-700 dark:text-blue-300">{list.length}</div>
                )}
              </div>
              <ul className="mt-1 space-y-1">
                {list.slice(0, 4).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <a className="truncate text-blue-600" href={t.job_id ? `/jobs/${t.job_id}?tab=tasks` : '#'}>
                      {t.title || 'Task'}
                    </a>
                    <select
                      className="rounded border px-1 py-0.5 text-[11px] dark:border-gray-700"
                      value={t.assigned_to || ''}
                      onChange={(e) => assignTask(t.id, e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p) => (
                        <option key={p.user_id} value={p.user_id}>
                          {p.display_name || p.user_id.slice(0,6)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
                {list.length > 4 && (
                  <li className="text-[11px] text-gray-500">+{list.length - 4} more…</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      {loading && <div className="text-sm text-gray-600">Loading…</div>}
    </div>
  );
}
