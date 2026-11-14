import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SignalCardStudio from '../components/signal-card-studio';
import { fixtureCapture, fixtureReport } from './signal-card-fixtures';
import '../index.css';

if (!import.meta.env.DEV) throw new Error('The isolated Signal Card fixture is development-only.');

function Harness() {
  const [account, setAccount] = useState('fixture-a');
  const [available, setAvailable] = useState(true);
  const [capture, setCapture] = useState(fixtureCapture);
  return <main className="page-wrap">
    <h1>Isolated Signal Card test</h1>
    <p>Synthetic data only. This fixture does not authenticate accounts, contact a provider, or create charges. It is not a production entry point.</p>
    <label>Fixture account <select data-testid="fixture-account" value={account} onChange={event => setAccount(event.target.value)}>
      <option value="fixture-a">Fixture A</option><option value="fixture-b">Fixture B</option><option value="">Signed out</option>
    </select></label>
    <label><input data-testid="fixture-reading" type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} />Completed fixture reading available</label>
    <button type="button" data-testid="fixture-new-reading" onClick={() => {
      setAvailable(true);
      setCapture({ ...fixtureCapture, id: `card-${crypto.randomUUID()}` });
    }}>New fixture reading</button>
    <SignalCardStudio key={account} userId={account || null} explanation={available ? fixtureReport : null} capture={available ? capture : null} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
