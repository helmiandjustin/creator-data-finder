import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast';

export default function Toaster() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = subscribeToast(next => {
      setMessage(next);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 2400);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={message}>
      {message}
    </div>
  );
}
