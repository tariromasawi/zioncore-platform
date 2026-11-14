import { signalCardSchema, type SignalCard, type SignalCardExportOptions } from './signal-cards';

const theme = {
  nature: { ink: '#254a3b', paper: '#f3f3e8', accent: '#597648' },
  tonal: { ink: '#1d4147', paper: '#f5f0e3', accent: '#997333' },
  faith: { ink: '#503651', paper: '#f6eff3', accent: '#976a56' },
};
const labels: Record<string, string> = {
  captureSource: 'Capture source', sampleRate: 'Sample rate (Hz)', fftSize: 'FFT size',
  frequencyResolutionHz: 'Frequency resolution (Hz)', dominantFrequencyHz: 'Dominant frequency (Hz)',
  topPeaksHz: 'Detected peaks (Hz)', rmsLevel: 'Relative RMS (0–1)', durationSeconds: 'Capture duration (seconds)',
};
function label(key: string) {
  return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, text => text.toUpperCase());
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!
  ));
}

// Construct exports field by field. Never serialize the whole saved card: it
// contains private context, annotation and the original personalised report.
function exportContent(input: SignalCard, options: SignalCardExportOptions) {
  const card = signalCardSchema.parse(input);
  const { faithReflection, ...reportWithoutReflection } = card.report;
  return {
    format: 'ZionCore Signal Card', version: 1,
    title: card.title, template: card.template,
    summary: card.summary, createdAt: card.createdAt,
    measurement: card.capture.measurement,
    provenance: { provider: card.report.provider, model: card.report.model },
    ...(card.capture.spectrumImage ? { spectrumImage: card.capture.spectrumImage } : {}),
    ...(options.includeContext ? { listeningContext: card.capture.listeningContext } : {}),
    ...(options.includeNotes ? { personalNotes: card.notes } : {}),
    ...(options.includeReflection && faithReflection ? { spiritualReflection: faithReflection } : {}),
    ...(options.includeReport ? { originalInterpretation: reportWithoutReflection } : {}),
    note: 'Measured acoustic features and a personal interpretation. Relative levels are not calibrated sound-pressure measurements. User-edited wording does not alter the original measurements.',
  };
}

function textValue(value: unknown): string {
  if (value === null) return 'Not available';
  if (Array.isArray(value)) return value.map(item => textValue(item)).join('\n\n');
  if (typeof value === 'object' && value) {
    return Object.entries(value).map(([key, item]) => `${label(key)}: ${textValue(item)}`).join('\n\n');
  }
  return String(value);
}

export function signalCardToText(card: SignalCard, options: SignalCardExportOptions): string {
  const { spectrumImage: _image, ...content } = exportContent(card, options);
  return textValue(content);
}
export function signalCardToJson(card: SignalCard, options: SignalCardExportOptions): string {
  return JSON.stringify(exportContent(card, options), null, 2);
}
function htmlValue(value: unknown): string {
  if (Array.isArray(value)) return `<ul>${value.map(item => `<li>${htmlValue(item)}</li>`).join('')}</ul>`;
  if (value && typeof value === 'object') {
    return `<dl>${Object.entries(value).map(([key, item]) => `<dt>${escapeHtml(label(key))}</dt><dd>${htmlValue(item)}</dd>`).join('')}</dl>`;
  }
  return `<span>${escapeHtml(value === null ? 'Not available' : String(value))}</span>`;
}
export function signalCardToHtml(card: SignalCard, options: SignalCardExportOptions): string {
  const content = exportContent(card, options);
  const palette = theme[content.template];
  const { title, summary, spectrumImage, ...details } = content;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(title)} · ZionCore</title><style>
*{box-sizing:border-box}body{margin:0;padding:clamp(16px,5vw,60px);background:${palette.paper};color:${palette.ink};font:16px/1.65 system-ui,sans-serif}main{max-width:860px;margin:auto;border:1px solid ${palette.accent};padding:clamp(18px,4vw,48px)}header{border-bottom:2px solid ${palette.accent};padding-bottom:20px}h1{font:clamp(28px,6vw,50px)/1.14 Georgia,serif;overflow-wrap:anywhere}h2{font-family:Georgia,serif}p,span{white-space:pre-wrap;overflow-wrap:anywhere}.brand{letter-spacing:.18em;font-size:12px;font-weight:bold;color:${palette.accent}}dt{font-weight:700;margin-top:16px}dd{margin:4px 0 16px}dd dl{padding-left:16px;border-left:1px solid ${palette.accent}}img{max-width:100%;height:auto}figcaption,footer{font-size:12px}figure{margin:24px 0}footer{margin-top:32px;border-top:1px solid ${palette.accent};padding-top:16px}@media print{body{background:white;padding:0}main{border:0;padding:12px}h1{font-size:30px}dt{break-after:avoid}img{max-height:220px;object-fit:contain}}
</style></head><body><main><header><div class="brand">ZIONCORE · SIGNAL CARD</div>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p></header>
${spectrumImage ? `<figure><img src="${spectrumImage}" alt="Spectrum display snapshot from the interpretation request"><figcaption>Existing spectrum display captured at request time. Displayed range and relative scale follow the original instrument.</figcaption></figure>` : ''}
<h2>Your chosen card contents</h2>${htmlValue(details)}
<footer>Created privately with ZionCore. This exported file contains the fields selected by its author; it is not a public link or a new interpretation. You may print this file to PDF using your browser.</footer>
</main></body></html>`;
}
export function downloadSignalCard(
  card: SignalCard,
  format: 'html' | 'txt' | 'json',
  options: SignalCardExportOptions,
) {
  const content = format === 'html' ? signalCardToHtml(card, options)
    : format === 'json' ? signalCardToJson(card, options) : signalCardToText(card, options);
  const mime = format === 'html' ? 'text/html' : format === 'json' ? 'application/json' : 'text/plain';
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${card.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'zioncore-signal-card'}.${format}`;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Give Safari time to consume the blob before revoking its download URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
