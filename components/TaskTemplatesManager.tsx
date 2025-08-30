"use client";
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Button from '~/components/ui/Button';
import { JOB_STATUSES, statusLabel } from '@/lib/status';
import { ensureDefaultTaskTemplates } from '@/lib/taskTemplates';
import { useToast } from '~/components/ui/ToastProvider';
import { useConfirm } from '~/components/ui/ConfirmProvider';

type Tpl = any;

export default function TaskTemplatesManager({ tenantId }: { tenantId?: string }) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [depsByCode, setDepsByCode] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState<any>({
    code: '',
    label: '',
    milestone: '',
    at_stage_trigger: 'Won',
    due_days: 2,
    role: 'Ops',
    required: true,
    loan_only: false,
    program_required: '',
    gates_stage: '',
  });

  const canUse = Boolean(tenantId);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [{ data: t }, { data: d }] = await Promise.all([
        sb
          .from('task_templates')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('at_stage_trigger', { ascending: true })
          .order('label', { ascending: true }),
        sb
          .from('task_dependencies')
          .select('*')
          .eq('tenant_id', tenantId),
      ]);
      setTemplates((t as any[]) || []);
      const by: Record<string, string[]> = {};
      for (const dep of ((d as any[]) || [])) {
        const c = String((dep as any).template_code);
        if (!by[c]) by[c] = [];
        by[c].push(String((dep as any).depends_on));
      }
      setDepsByCode(by);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const codes = useMemo(
    () => new Set(templates.map((t) => String(t.code))),
    [templates],
  );

  const startEdit = (tpl: Tpl) => {
    setEditing(tpl.code as string);
    setEdit({ ...tpl });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEdit({});
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const patch: any = { ...edit };
      delete patch.tenant_id;
      delete patch.id;
      const { error } = await sb
        .from('task_templates')
        .update(patch)
        .eq('tenant_id', tenantId as string)
        .eq('code', editing);
      if (error) throw error;
      toast({ title: 'Template saved', variant: 'success' });
      cancelEdit();
      await load();
    } catch (e: any) {
      toast({ title: 'Save failed', description: String(e?.message || e), variant: 'error' });
    }
  };

  const addTemplate = async () => {
    if (!tenantId) return;
    if (!add.code.trim() || !add.label.trim()) {
      toast({ title: 'Code and Label are required', variant: 'error' });
      return;
    }
    if (codes.has(add.code)) {
      toast({ title: 'Code already exists', variant: 'error' });
      return;
    }
    setAdding(true);
    try {
      const row = {
        tenant_id: tenantId,
        code: add.code.trim(),
        label: add.label.trim(),
        milestone: add.milestone?.trim() || 'General',
        at_stage_trigger: add.at_stage_trigger,
        due_days: Number(add.due_days || 0),
        role: add.role?.trim() || 'Ops',
        loan_only: Boolean(add.loan_only),
        required: Boolean(add.required),
        program_required: add.program_required?.trim() || null,
        gates_stage: add.gates_stage || null,
      } as any;
      const { error } = await sb.from('task_templates').insert(row);
      if (error) throw error;
      setAdd({
        code: '',
        label: '',
        milestone: '',
        at_stage_trigger: 'Won',
        due_days: 2,
        role: 'Ops',
        required: true,
        loan_only: false,
        program_required: '',
        gates_stage: '',
      });
      await load();
      toast({ title: 'Template added', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Add failed', description: String(e?.message || e), variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const deleteTemplate = async (code: string) => {
    const ok = await confirm({
      title: 'Delete template',
      description: 'Existing tasks remain; only the template is removed.',
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await sb.from('task_templates').delete().eq('tenant_id', tenantId as string).eq('code', code);
      await sb.from('task_dependencies').delete().eq('tenant_id', tenantId as string).eq('template_code', code);
      await load();
      toast({ title: 'Template deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: String(e?.message || e), variant: 'error' });
    }
  };

  const addDependency = async (code: string, dependsOn: string) => {
    if (!dependsOn || dependsOn === code) return;
    try {
      const { error } = await sb.from('task_dependencies').upsert(
        [{ tenant_id: tenantId, template_code: code, depends_on: dependsOn }],
        { onConflict: 'tenant_id,template_code,depends_on' } as any,
      );
      if (error) throw error;
      await load();
    } catch (e: any) {
      toast({ title: 'Update failed', description: String(e?.message || e), variant: 'error' });
    }
  };

  const removeDependency = async (code: string, dependsOn: string) => {
    try {
      await sb
        .from('task_dependencies')
        .delete()
        .eq('tenant_id', tenantId as string)
        .eq('template_code', code)
        .eq('depends_on', dependsOn);
      await load();
    } catch (e: any) {
      toast({ title: 'Update failed', description: String(e?.message || e), variant: 'error' });
    }
  };

  return (
    <div className="rounded border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Task Templates</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canUse}
            onClick={async () => {
              try {
                await ensureDefaultTaskTemplates(sb as any, tenantId as string);
                await load();
                toast({ title: 'Default templates seeded' });
              } catch (e: any) {
                toast({ title: 'Seed failed', description: String(e?.message || e), variant: 'error' });
              }
            }}
          >
            Seed defaults
          </Button>
          {!canUse && (
            <span className="text-xs text-gray-600">Profile loading…</span>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Define default tasks for each job status. These are used when you click
        "Prefill defaults" on a job or when a job moves into a status.
      </p>

      {/* Add new template */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
        <input
          className="rounded border px-2 py-2 text-sm"
          placeholder="Code (unique)"
          value={add.code}
          onChange={(e) => setAdd({ ...add, code: e.target.value })}
        />
        <input
          className="md:col-span-2 rounded border px-2 py-2 text-sm"
          placeholder="Label"
          value={add.label}
          onChange={(e) => setAdd({ ...add, label: e.target.value })}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={add.at_stage_trigger}
          onChange={(e) => setAdd({ ...add, at_stage_trigger: e.target.value })}
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s as any)}
            </option>
          ))}
        </select>
        <input
          className="rounded border px-2 py-2 text-sm"
          type="number"
          min={0}
          placeholder="Due (days)"
          value={add.due_days}
          onChange={(e) => setAdd({ ...add, due_days: Number(e.target.value) })}
        />
        <input
          className="rounded border px-2 py-2 text-sm"
          placeholder="Role (e.g., Sales/Ops)"
          value={add.role}
          onChange={(e) => setAdd({ ...add, role: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(add.required)}
            onChange={(e) => setAdd({ ...add, required: e.target.checked })}
          />
          Required
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(add.loan_only)}
            onChange={(e) => setAdd({ ...add, loan_only: e.target.checked })}
          />
          Loan-only
        </label>
        <select
          className="rounded border px-2 py-1 text-sm"
          value={add.gates_stage}
          onChange={(e) => setAdd({ ...add, gates_stage: e.target.value })}
        >
          <option value="">No stage gate</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              Gate: {statusLabel(s as any)}
            </option>
          ))}
        </select>
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="Program required (optional)"
          value={add.program_required}
          onChange={(e) => setAdd({ ...add, program_required: e.target.value })}
        />
        <Button onClick={addTemplate} loading={adding} disabled={!canUse}>
          Add Template
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="p-2">Code</th>
              <th className="p-2">Label</th>
              <th className="p-2">Trigger</th>
              <th className="p-2">Due</th>
              <th className="p-2">Role</th>
              <th className="p-2">Flags</th>
              <th className="p-2">Stage Gate</th>
              <th className="p-2">Depends On</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const isEditing = editing === t.code;
              const deps = depsByCode[t.code] || [];
              return (
                <tr key={t.code} className="border-t align-top">
                  <td className="p-2 font-mono text-xs">{t.code}</td>
                  <td className="p-2">
                    {!isEditing ? (
                      <span>{t.label}</span>
                    ) : (
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={edit.label ?? t.label}
                        onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {!isEditing ? (
                      <span>{statusLabel(t.at_stage_trigger)}</span>
                    ) : (
                      <select
                        className="rounded border px-2 py-1"
                        value={edit.at_stage_trigger ?? t.at_stage_trigger}
                        onChange={(e) => setEdit({ ...edit, at_stage_trigger: e.target.value })}
                      >
                        {JOB_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s as any)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2 w-24">
                    {!isEditing ? (
                      <span>{t.due_days ?? 0} d</span>
                    ) : (
                      <input
                        className="w-full rounded border px-2 py-1"
                        type="number"
                        value={edit.due_days ?? t.due_days ?? 0}
                        onChange={(e) => setEdit({ ...edit, due_days: Number(e.target.value) })}
                      />
                    )}
                  </td>
                  <td className="p-2 w-32">
                    {!isEditing ? (
                      <span>{t.role}</span>
                    ) : (
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={edit.role ?? t.role}
                        onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    {!isEditing ? (
                      <span className="text-gray-700">
                        {t.required ? 'Required' : 'Optional'}
                        {t.loan_only ? ' • Loan-only' : ''}
                        {t.program_required ? ` • Program:${t.program_required}` : ''}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={Boolean(edit.required ?? t.required)}
                            onChange={(e) => setEdit({ ...edit, required: e.target.checked })}
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={Boolean(edit.loan_only ?? t.loan_only)}
                            onChange={(e) => setEdit({ ...edit, loan_only: e.target.checked })}
                          />
                          Loan-only
                        </label>
                        <input
                          className="rounded border px-2 py-1"
                          placeholder="Program (optional)"
                          value={edit.program_required ?? t.program_required ?? ''}
                          onChange={(e) => setEdit({ ...edit, program_required: e.target.value })}
                        />
                      </div>
                    )}
                  </td>
                  <td className="p-2 w-40">
                    {!isEditing ? (
                      <span>
                        {t.gates_stage ? `Gate: ${statusLabel(t.gates_stage)}` : '—'}
                      </span>
                    ) : (
                      <select
                        className="rounded border px-2 py-1"
                        value={edit.gates_stage ?? t.gates_stage ?? ''}
                        onChange={(e) => setEdit({ ...edit, gates_stage: e.target.value || null })}
                      >
                        <option value="">No stage gate</option>
                        {JOB_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s as any)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {deps.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                        >
                          {d}
                          <button
                            className="text-red-600"
                            onClick={() => removeDependency(t.code as string, d)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-1">
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) addDependency(t.code as string, val);
                          e.currentTarget.value = '';
                        }}
                      >
                        <option value="">Add dependency…</option>
                        {templates
                          .filter((x) => x.code !== t.code && !deps.includes(x.code))
                          .map((x) => (
                            <option key={x.code} value={x.code}>
                              {x.code}
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>
                  <td className="p-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteTemplate(t.code as string)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {templates.length === 0 && !loading && (
              <tr>
                <td className="p-2 text-sm text-gray-500" colSpan={9}>
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
