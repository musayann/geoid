'use client';

import { useRef } from 'react';

const PULL_THRESHOLD = 60;

/* ============================================================
   usePullToRefresh — a drag-down-to-refresh gesture for the sheet.

   Spread the returned `handlers` onto the draggable sheet and attach
   `sheetRef`/`hintRef` to the sheet and its pull hint. When `enabled`
   is false the handlers are no-ops (e.g. the offline view).
   ============================================================ */
export function usePullToRefresh(onRefresh: () => void, enabled: boolean) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const pull = useRef<{ startY: number | null; dy: number }>({ startY: null, dy: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    pull.current = { startY: e.clientY, dy: 0 };
    sheetRef.current?.classList.add('dragging');
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pull.current;
    if (p.startY == null) return;
    p.dy = Math.max(0, e.clientY - p.startY);
    const y = Math.min(96, p.dy * 0.5);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${y}px)`;
    const h = hintRef.current;
    if (h) {
      h.style.opacity = y > 6 ? '1' : '0';
      h.textContent = y > PULL_THRESHOLD ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH';
    }
  };
  const onPointerEnd = () => {
    const p = pull.current;
    if (p.startY == null) return;
    const trigger = Math.min(96, p.dy * 0.5) > PULL_THRESHOLD;
    pull.current = { startY: null, dy: 0 };
    sheetRef.current?.classList.remove('dragging');
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (hintRef.current) hintRef.current.style.opacity = '0';
    if (trigger) onRefresh();
  };

  const handlers = enabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        onPointerLeave: onPointerEnd,
      }
    : {};

  return { sheetRef, hintRef, handlers };
}
