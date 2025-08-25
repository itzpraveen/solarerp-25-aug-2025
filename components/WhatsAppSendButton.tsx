"use client";
import { useState } from 'react';

export default function WhatsAppSendButton({ to, templateName, variables }: { to: string; templateName: string; variables: string[] }) {
  const [loading, setLoading] = useState(false);
  const [msgId, setMsgId] = useState<string | null>(null);
  const send = async () => {
    setLoading(true);
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, templateName, variables }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) setMsgId(data.id);
  };
  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={send} disabled={loading} className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50">Send on WhatsApp</button>
      {msgId && <span className="text-xs text-gray-600">Sent: {msgId}</span>}
    </div>
  );
}

