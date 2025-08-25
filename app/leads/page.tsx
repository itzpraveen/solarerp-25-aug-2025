"use client";
import React, { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import Card from '~/components/ui/Card';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import EmptyState from '~/components/ui/EmptyState';
import { isPhone, required } from '@/lib/validation';

export default function LeadsPage() {
  const supabase = supabaseBrowser();
  const [leads, setLeads] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<any>({ address: '', system_type: 'On-grid', capacity_kw: 1, location: '', roof_type: '' });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('"date"', { ascending: false });
    if (error) {
      // Surface server-side error details in dev tools to diagnose 500s
      console.error('Failed to load leads:', error);
    }
    setLeads(data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(null);
    if (!required(name)) return setErr('Name is required');
    if (!isPhone(phone)) return setErr('Valid phone required');
    const { data: prof, error: pErr } = await supabase.from('profiles').select('tenant_id').single();
    if (pErr || !prof?.tenant_id) return setErr('Profile not ready');
    const { error } = await supabase.from('leads').insert({ tenant_id: prof!.tenant_id, date: new Date().toISOString().slice(0,10), name, phone, interested_capacity_kw: capacity, status: 'New' });
    if (error) return setErr(error.message);
    setName(''); setPhone(''); setCapacity(1);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
      </div>
      {err && <div className="rounded border bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      <Card>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input type="number" min={0} step={0.1} placeholder="Capacity kW" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          <div className="flex gap-2">
            <Button onClick={add}>Add Lead</Button>
            <a
              className="rounded border px-3 py-2 text-sm"
              href={'data:text/csv;charset=utf-8,' + encodeURIComponent('Date,Name,Phone,Capacity,Status\n' + leads.map(l => [l.date || '', l.name || '', l.phone || '', l.interested_capacity_kw || '', l.status || ''].join(',')).join('\n'))}
              download="leads.csv"
            >Export CSV</a>
          </div>
        </div>
      </Card>
      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Capture interested customers so you can follow-up and convert." />
      ) : (
        <div className="rounded border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
              <th className="p-2"><input type="checkbox" onChange={(e) => {
                const v = e.target.checked; const map: Record<string, boolean> = {}; (leads || []).forEach((l) => map[l.id] = v); setSelected(map);
              }} /></th>
              <th className="p-2">Date</th>
              <th className="p-2">Name</th>
              <th className="p-2">Phone</th>
                <th className="p-2">Capacity (kW)</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <React.Fragment key={l.id}>
                <tr className="border-b">
                  <td className="p-2"><input type="checkbox" checked={!!selected[l.id]} onChange={(e) => setSelected({ ...selected, [l.id]: e.target.checked })} /></td>
                  <td className="p-2">{l.date || '—'}</td>
                  {editing === l.id ? (
                    <>
                      <td className="p-2"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                      <td className="p-2"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                      <td className="p-2"><Input type="number" value={editForm.interested_capacity_kw || 0} onChange={(e) => setEditForm({ ...editForm, interested_capacity_kw: Number(e.target.value) })} /></td>
                      <td className="p-2 text-xs text-gray-600">{l.status || '—'}</td>
                      <td className="p-2 whitespace-nowrap">
                        <Button size="sm" onClick={async () => { await supabase.from('leads').update({ name: editForm.name, phone: editForm.phone, interested_capacity_kw: editForm.interested_capacity_kw }).eq('id', l.id); setEditing(null); load(); }}>Save</Button>
                        <Button variant="outline" size="sm" className="ml-2" onClick={() => setEditing(null)}>Cancel</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{l.name || '—'}</td>
                      <td className="p-2">{l.phone || '—'}</td>
                      <td className="p-2">{l.interested_capacity_kw ?? '—'}</td>
                      <td className="p-2 text-xs text-gray-600">{l.status || '—'}</td>
                      <td className="p-2 whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => { setEditing(l.id); setEditForm(l); }}>Edit</Button>
                        <Button size="sm" className="ml-2" onClick={() => { if (!confirm('Convert this lead to a Job?')) return; setConvertingId(l.id); setConvertForm({ address: '', system_type: 'On-grid', capacity_kw: l.interested_capacity_kw || 1, location: '', roof_type: '' }); }}>Convert</Button>
                      </td>
                </>
                  )}
                </tr>
                {convertingId === l.id && (
                  <tr className="bg-gray-50" key={`${l.id}-convert`}>
                    <td className="p-2" colSpan={7}>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <Input className="md:col-span-2" placeholder="Address" value={convertForm.address} onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })} />
                        <select className="rounded border px-3 py-2" value={convertForm.system_type} onChange={(e) => setConvertForm({ ...convertForm, system_type: e.target.value })}>
                          <option>On-grid</option>
                          <option>Hybrid</option>
                          <option>Off-grid</option>
                          <option>Inverter & Battery</option>
                          <option>Solar Water Heater</option>
                        </select>
                        <Input type="number" placeholder="Capacity kW" value={convertForm.capacity_kw} onChange={(e) => setConvertForm({ ...convertForm, capacity_kw: Number(e.target.value) })} />
                        <Input placeholder="Location/Place" value={convertForm.location} onChange={(e) => setConvertForm({ ...convertForm, location: e.target.value })} />
                        <Input placeholder="Roof Type" value={convertForm.roof_type} onChange={(e) => setConvertForm({ ...convertForm, roof_type: e.target.value })} />
                        <div className="md:col-span-6 flex gap-2">
                          <Button size="sm" onClick={async () => {
                            const { data: prof } = await supabase.from('profiles').select('tenant_id').single();
                            const { data: cust } = await supabase.from('customers').insert({ tenant_id: prof!.tenant_id, name: l.name, phone: l.phone, address: convertForm.address }).select('id').single();
                            const { data: job } = await supabase
                              .from('jobs')
                              .insert({ tenant_id: prof!.tenant_id, customer_id: cust!.id, system_type: convertForm.system_type, status: 'Lead', capacity_kw: convertForm.capacity_kw, location: convertForm.location, roof_type: convertForm.roof_type })
                              .select('id')
                              .single();
                            await supabase.from('leads').update({ status: 'Converted' }).eq('id', l.id);
                            window.location.href = `/jobs/${job!.id}`;
                          }}>Create</Button>
                          <Button variant="outline" size="sm" onClick={() => setConvertingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {Object.values(selected).some(Boolean) && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={async () => {
              const ids = Object.keys(selected).filter((k) => selected[k]);
              await supabase.from('leads').update({ status: 'Closed' }).in('id', ids);
              setSelected({});
              load();
            }}>Mark selected Closed</Button>
          </div>
        )}
      )}
    </div>
  );
}
