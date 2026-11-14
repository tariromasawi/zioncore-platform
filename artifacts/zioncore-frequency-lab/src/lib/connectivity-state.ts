export type ConnectivityState = { offline: boolean; restored: boolean };
export type ConnectivityAction = 'offline' | 'online' | 'dismiss';

export function connectivityState(offline: boolean): ConnectivityState {
  return { offline, restored: false };
}

export function reduceConnectivity(state: ConnectivityState, action: ConnectivityAction): ConnectivityState {
  if (action === 'offline') return { offline: true, restored: false };
  if (action === 'online') return state.offline ? { offline: false, restored: true } : state;
  return state.offline ? state : { offline: false, restored: false };
}
