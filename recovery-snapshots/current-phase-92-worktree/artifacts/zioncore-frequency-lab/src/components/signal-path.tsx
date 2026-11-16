import { useState } from 'react';
import { Activity, ArrowRight, Radio, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import './signal-path.css';

const signalPaths = [
  {
    id: 'listen',
    index: '01',
    title: 'Read the signal',
    description: 'Listen to a sound and explore its measurable frequency pattern.',
    action: 'Open the live listening lab',
    href: '#capture',
    destination: 'anchor',
    icon: Activity,
  },
  {
    id: 'decode',
    index: '02',
    title: 'Decode a message',
    description: 'Turn a short message into sound or decode a ZionCore audio packet.',
    action: 'Enter the message instrument',
    href: '/messages',
    destination: 'route',
    icon: Radio,
  },
  {
    id: 'reflect',
    index: '03',
    title: 'Explore meaning',
    description: 'Shape a personal interpretation around a measured reading and your context.',
    action: 'Shape a personal reading',
    href: '#interpretation',
    destination: 'anchor',
    icon: Sparkles,
  },
] as const;

type SignalPathId = (typeof signalPaths)[number]['id'];

export default function SignalPath() {
  const [selectedPathId, setSelectedPathId] = useState<SignalPathId | null>(null);
  const selectedPath = signalPaths.find(path => path.id === selectedPathId);

  return (
    <section className="zc-signal-path" aria-labelledby="zc-signal-path-title" data-testid="panel-signal-path">
      <div className="zc-signal-path__matrix" aria-hidden="true">
        01&nbsp; ∿&nbsp; 10&nbsp; 01&nbsp; ∆&nbsp; 11&nbsp; ∿&nbsp; 01&nbsp; 10&nbsp; 01&nbsp; ∆&nbsp; 11&nbsp; ∿&nbsp; 01
      </div>
      <div className="zc-signal-path__topline">
        <span><i aria-hidden="true" /> ZIONCORE / SIGNAL PATH</span>
        <span>THREE ROUTES · YOUR CHOICE</span>
      </div>
      <div className="zc-signal-path__intro">
        <div>
          <p className="zc-signal-path__kicker">A product for those who understand life deeply</p>
          <h2 id="zc-signal-path-title">Choose your first signal.</h2>
          <p className="zc-signal-path__description">
            Follow a live tool into sound, communication, or personal meaning. ZionCore will open the next step you choose.
          </p>
        </div>
        <div className="zc-signal-path__index" aria-label={selectedPath ? 'One of three routes selected' : 'Choose a route'}>
          <span>{selectedPath ? '01' : '00'}</span><b>/</b><span>03</span>
          <small>{selectedPath ? 'ROUTE SET' : 'CHOOSE A PATH'}</small>
        </div>
      </div>

      <div className="zc-signal-path__choices" role="group" aria-label="Choose a ZionCore exploration path">
        {signalPaths.map(path => {
          const Icon = path.icon;
          const isSelected = path.id === selectedPathId;
          return (
            <button
              className={`zc-signal-path__choice${isSelected ? ' is-selected' : ''}`}
              type="button"
              key={path.id}
              aria-pressed={isSelected}
              onClick={() => setSelectedPathId(path.id)}
              data-testid={`button-signal-path-${path.id}`}
            >
              <span className="zc-signal-path__choice-meta">
                <span>{path.index} / 03</span>
                <Icon size={16} aria-hidden="true" />
              </span>
              <strong>{path.title}</strong>
              <span className="zc-signal-path__choice-copy">{path.description}</span>
              <span className="zc-signal-path__choice-prompt">{isSelected ? 'PATH SELECTED' : 'SELECT THIS PATH'}</span>
            </button>
          );
        })}
      </div>

      <div className="zc-signal-path__console" aria-live="polite" aria-atomic="true">
        <div className="zc-signal-path__console-status">
          <span className={selectedPath ? 'is-active' : ''} aria-hidden="true" />
          <p role="status" data-testid="status-signal-path">
            {selectedPath
              ? `Sequence aligned · ${selectedPath.index} / 03 · ${selectedPath.title}`
              : 'Choose your next exploration'}
          </p>
        </div>
        {selectedPath ? (
          selectedPath.destination === 'route' ? (
            <Link className="zc-signal-path__continue" href={selectedPath.href} data-testid="link-signal-path-continue">
              {selectedPath.action}<ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <a className="zc-signal-path__continue" href={selectedPath.href} data-testid="link-signal-path-continue">
              {selectedPath.action}<ArrowRight size={14} aria-hidden="true" />
            </a>
          )
        ) : (
          <span className="zc-signal-path__prompt"><Sparkles size={13} aria-hidden="true" /> YOUR CURIOSITY SETS THE COURSE</span>
        )}
      </div>
    </section>
  );
}
