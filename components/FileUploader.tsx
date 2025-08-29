'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function FileUploader({
  onUploaded,
}: {
  onUploaded: (signedUrl: string, path: string) => void;
}) {
  const supabase = supabaseBrowser();
  const [file, setFile] = useState<File | null>(null);

  const upload = async () => {
    if (!file) return;
    const { data: u } = await supabase.auth.getUser();
    const uid = (u?.user as any)?.id as string | undefined;
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid as any)
      .maybeSingle();
    const tenantId = (prof as any)?.tenant_id as string | undefined;
    if (!tenantId) return alert('Profile not ready');
    const key = `${tenantId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from('documents')
      .upload(key, file);
    if (!error) {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(key, 60 * 60 * 24 * 7);
      onUploaded(data!.signedUrl, key);
    }
    setFile(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={upload}
        className="rounded bg-blue-600 px-3 py-2 text-white"
      >
        Upload
      </button>
    </div>
  );
}
