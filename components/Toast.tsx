export default function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}
