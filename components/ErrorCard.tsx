import MessageCard from './MessageCard';

interface Props {
  error: string;
  onRetry: () => void;
}

export default function ErrorCard({ error, onRetry }: Props) {
  return (
    <MessageCard
      phase="error"
      compass="·?·"
      title="Couldn’t get a fix."
      body={error || 'Something went wrong while locating you.'}
      action={{ label: 'Try again', onClick: onRetry }}
    />
  );
}
