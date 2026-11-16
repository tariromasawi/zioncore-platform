import { useState } from 'react';
import { getLocalAIEnvironment } from '@/lib/local-discovery-ai';

export default function LocalAISetup({ availability, busy, onRecheck }: {
  availability: string; busy: boolean; onRecheck: () => void;
}) {
  const environment = getLocalAIEnvironment();
  const [copyStatus, setCopyStatus] = useState('');
  const copySettings = async () => {
    try {
      await navigator.clipboard.writeText('chrome://settings/ai');
      setCopyStatus('Settings address copied. Paste it into Chrome’s address bar.');
    } catch { setCopyStatus('Select and copy chrome://settings/ai, then paste it into Chrome’s address bar.'); }
  };
  return <div className="zc-local-ai-setup">
    <button type="button" className="btn btn-subtle" disabled={busy || availability === 'checking'} onClick={onRecheck} data-testid="button-recheck-local-ai">Check browser AI again</button>
    <p className="zc-fx-note">{!environment.secure
      ? 'Browser AI requires a secure HTTPS page. Your local rules-based report is still available.'
      : environment.embedded
        ? 'This page is embedded. Its parent must permit the language-model feature; opening the lab directly can avoid that restriction.'
        : environment.apiExposed ? 'The browser exposes the Prompt API; model availability is checked separately.'
          : 'This browser does not currently expose the Prompt API. A website cannot turn on a browser setting or add missing hardware support.'}</p>
    <details open={availability === 'unavailable'}>
      <summary>How to enable Gemini Nano where supported</summary>
      <ol>
        <li>Use a supported, up-to-date desktop Chrome browser. The web Prompt API requires Chrome 148 or later and compatible hardware; Chrome on iPhone, iPad and Android is not currently supported.</li>
        <li>If you are using an embedded preview, <a href={`${import.meta.env.BASE_URL}#free-reading`} target="_blank" rel="noopener noreferrer">open the lab directly in a new tab</a>.</li>
        <li>If Chrome reports on-device AI disabled, open <code>chrome://settings/ai</code> yourself and enable the available on-device AI setting. Device or organisation policies may prevent activation.
          <button type="button" className="btn btn-subtle" onClick={() => void copySettings()}>Copy Chrome settings address</button></li>
        <li>Check <code>chrome://on-device-internals</code> for model/device status. Chrome’s documented requirements include at least 22 GB free profile-disk space and a supported GPU or CPU configuration.</li>
        <li>Return here, check browser AI again, give download/processing consent, and choose “Reflect on this snapshot”. First use may download a large model; use an unmetered connection. Download is limited to ten minutes and generation to ninety seconds; you can cancel either.</li>
      </ol>
      <p>All inference stays on your device. There is no automatic paid Gemini request, no API key requirement and no AI-provider charge to ZionCore. The browser controls whether Nano is available; activation is not claimed until a real local response succeeds.</p>
      <a href="https://developer.chrome.com/docs/ai/prompt-api" target="_blank" rel="noopener noreferrer">Official Chrome support and hardware requirements</a>
    </details>
    <p role="status">{copyStatus}</p>
  </div>;
}
