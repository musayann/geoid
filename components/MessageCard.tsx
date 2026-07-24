import type { ReactNode } from 'react';
import type { Phase } from '@/lib/types';
import Topbar from './Topbar';

interface Props {
  phase: Phase;
  compass: string;
  title: ReactNode;
  body: ReactNode;
  action?: { label: string; onClick: () => void };
  fineprint?: ReactNode;
}

/* ============================================================
   MessageCard — the shared `.message` layout used by the denied,
   unsupported and error states: a compass glyph, headline, body
   copy, and an optional primary action + fineprint.
   ============================================================ */
export default function MessageCard({ phase, compass, title, body, action, fineprint }: Props) {
  return (
    <main className="card">
      <div className="sheet enter">
        <Topbar phase={phase} />
        <div className="message">
          <div className="compass">{compass}</div>
          <h1>{title}</h1>
          <p>{body}</p>
          {action && (
            <button className="btn-primary" style={{ marginTop: 10 }} onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {fineprint && <div className="fineprint">{fineprint}</div>}
        </div>
      </div>
    </main>
  );
}
