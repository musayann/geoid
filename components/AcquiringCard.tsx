import Topbar from './Topbar';

export default function AcquiringCard() {
  return (
    <main className="card">
      <div className="sheet enter">
        <Topbar phase="acquiring" />
        <div className="acquire">
          <div className="pulse">
            <div className="ring" />
            <div className="ring delay" />
            <div className="core" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
            <h1>Finding you…</h1>
            <div className="sub">READING GPS · REFINING FIX</div>
          </div>
          <div className="bars">
            <i style={{ width: '72%' }} />
            <i style={{ width: '54%' }} />
            <i style={{ width: '63%' }} />
          </div>
        </div>
        <div className="fineprint">Usually takes a few seconds outdoors</div>
      </div>
    </main>
  );
}
