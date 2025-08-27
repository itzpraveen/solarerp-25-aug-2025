'use client';
import { useState } from 'react';
import Input from '~/components/ui/Input';
import Button from '~/components/ui/Button';
import Modal from '~/components/ui/Modal';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { useToast } from '~/components/ui/ToastProvider';

export default function CustomerQuickCreate({
  open,
  onClose,
  onCreated,
  initialName = '',
  initialPhone = '',
  initialAddress = '',
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string, address?: string | null) => void;
  initialName?: string;
  initialPhone?: string;
  initialAddress?: string;
}) {
  const supabase = supabaseBrowser();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('tenant_id')
        .maybeSingle();
      if (!prof?.tenant_id) throw new Error('Profile not ready');
      const { data } = await supabase
        .from('customers')
        .insert({
          tenant_id: (prof as any).tenant_id,
          name: name.trim(),
          phone: phone || null,
          address: address || null,
        })
        .select('id,name')
        .single();
      toast({ title: 'Customer created', variant: 'success' });
      onCreated(
        (data as any).id as string,
        (data as any).name as string,
        (data as any).address || null,
      );
      setName('');
      setPhone('');
      setAddress('');
      onClose();
    } catch (e: any) {
      toast({
        title: 'Create failed',
        description: String(e?.message || e),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Customer"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} loading={saving} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
    </Modal>
  );
}
