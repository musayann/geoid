'use client';

import { useCallback, useRef, useState } from 'react';

/* ============================================================
   useToast — a transient status message plus clipboard helper.

   `copy` writes to the clipboard (with an execCommand fallback for
   browsers without the async API) and confirms with a toast.
   ============================================================ */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else throw new Error('no clipboard');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        ta.remove();
      }
      showToast(`Copied — ${label}`);
    },
    [showToast],
  );

  return { toast, showToast, copy };
}
