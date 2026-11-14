import { useEffect, useReducer } from 'react';
import { connectivityState, reduceConnectivity } from '@/lib/connectivity-state';

export default function ConnectivityNotice() {
  const [state, dispatch] = useReducer(reduceConnectivity,
    typeof navigator !== 'undefined' && navigator.onLine === false, connectivityState);
  useEffect(() => {
    const offline = () => dispatch('offline');
    const online = () => dispatch('online');
    const syncVisibility = () => {
      if (document.visibilityState === 'visible') dispatch(navigator.onLine === false ? 'offline' : 'online');
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);
  if (!state.offline && !state.restored) return null;
  return <aside className="zc-connection-notice" role="status" aria-live="polite" aria-atomic="true" data-testid="status-connectivity">
    <div>
      <strong>{state.offline ? 'Your browser reports that you are offline.' : 'Your browser is online again.'}</strong>
      <p>{state.offline
        ? 'Local listening tools can still work. Account access, cloud saves, purchases and ZionCore interpretations need a connection.'
        : 'Check the status of your previous action before retrying a purchase or paid reading. No new purchase is started by this notice.'}</p>
    </div>
    {state.restored && <button className="btn btn-subtle" type="button" onClick={() => dispatch('dismiss')} aria-label="Dismiss connection notice" data-testid="button-dismiss-connectivity">Dismiss</button>}
  </aside>;
}
