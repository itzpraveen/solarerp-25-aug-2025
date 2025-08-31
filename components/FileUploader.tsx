'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { ensureProfileIfMissing } from '@/lib/ensureProfileClient';

export default function FileUploader({
  onUploaded,
}: {
  onUploaded: (signedUrl: string, path: string) => void;
}) {
  const supabase = supabaseBrowser();
  const [file, setFile] = useState<File | null>(null);

  const upload = async () => {
    if (!file) return;
    const tenantId = await ensureProfileIfMissing(supabase as any);
    if (!tenantId)
      return alert(
        'Profile not ready — ask an admin to invite you from Settings → Team, then sign out and sign in again.',
      );
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
