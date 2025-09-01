"use client";
import { useMemo } from "react";

type Props = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  sms?: boolean;
  className?: string;
  messageTemplate?: string; // used for WA/SMS prefill
};

function sanitizePhone(p?: string | null) {
  if (!p) return null;
  const digits = (p || "").replace(/\D+/g, "");
  if (!digits) return null;
  return digits;
}

export default function QuickContact({
  phone,
  email,
  address,
  sms = true,
  className,
  messageTemplate,
}: Props) {
  const phoneDigits = useMemo(() => sanitizePhone(phone), [phone]);

  const waHref = useMemo(() => {
    if (!phoneDigits) return null;
    // WhatsApp requires country code. If 10 digits (common in India), prefix 91.
    const withCc = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
    const text = messageTemplate ? encodeURIComponent(messageTemplate) : "";
    return `https://wa.me/${withCc}${text ? `?text=${text}` : ""}`;
  }, [phoneDigits, messageTemplate]);

  const smsHref = useMemo(() => {
    if (!phoneDigits || !sms) return null;
    const text = messageTemplate ? encodeURIComponent(messageTemplate) : "";
    return `sms:${phoneDigits}${text ? `?&body=${text}` : ""}`;
  }, [phoneDigits, sms, messageTemplate]);

  const telHref = useMemo(() => (phoneDigits ? `tel:${phoneDigits}` : null), [
    phoneDigits,
  ]);

  const mailHref = useMemo(() => (email ? `mailto:${email}` : null), [email]);

  const mapHref = useMemo(
    () => (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null),
    [address],
  );

  if (!phoneDigits && !email && !address) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
      {telHref && (
        <a
          href={telHref}
          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Call"
        >
          Call
        </a>
      )}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          title="WhatsApp"
        >
          WhatsApp
        </a>
      )}
      {smsHref && (
        <a
          href={smsHref}
          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          title="SMS"
        >
          SMS
        </a>
      )}
      {mailHref && (
        <a
          href={mailHref}
          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Email"
        >
          Email
        </a>
      )}
      {mapHref && (
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Open in Maps"
        >
          Map
        </a>
      )}
    </div>
  );
}

