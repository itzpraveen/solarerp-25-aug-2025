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
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .maybeSingle();
    if (!prof?.tenant_id) return alert('Profile not ready');
    const key = `${prof.tenant_id}/${crypto.randomUUID()}-${file.name}`;
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
