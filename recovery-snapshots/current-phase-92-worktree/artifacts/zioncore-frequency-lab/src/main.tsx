import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!, {
  // The boundary owns diagnostics; avoid duplicate logs and raw production
  // error payloads. This also keeps caught failures off the dev overlay.
  onCaughtError: () => {},
}).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </QueryClientProvider>,
);
