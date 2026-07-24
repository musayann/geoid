import MessageCard from './MessageCard';

export default function DeniedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <MessageCard
      phase="denied"
      compass="N·E·S·W"
      title="We can’t see where you are."
      body="Where Am I only works with your location. It stays on your device — nothing is stored on a server or sent anywhere."
      action={{ label: 'Allow location access', onClick: onRetry }}
      fineprint="Enable location for this site in your browser settings, then retry"
    />
  );
}
