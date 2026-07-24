import MessageCard from './MessageCard';

export default function UnsupportedCard() {
  return (
    <MessageCard
      phase="unsupported"
      compass="N·E·S·W"
      title="Location isn’t available here."
      body="This browser doesn’t support geolocation. Try a modern mobile browser over HTTPS."
    />
  );
}
