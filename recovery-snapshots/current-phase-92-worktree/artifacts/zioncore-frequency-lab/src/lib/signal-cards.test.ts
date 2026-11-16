import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureCapture, fixtureReport } from '../integration/signal-card-fixtures';
import {
  createSignalCard, readSignalCards, saveSignalCard, deleteSignalCard, signalCardStorageKey,
  signalCardToText, signalCardToHtml, signalCardToJson, DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS,
} from './signal-cards';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
function card() { return createSignalCard(structuredClone(fixtureReport), structuredClone(fixtureCapture)); }
const defaults = { ...DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS };

test('card edits persist per account, update rather than duplicate, and can be deleted', () => {
  const storage = new MemoryStorage();
  const original = card();
  const saved = saveSignalCard('account-a', original, storage)[0];
  saveSignalCard('account-a', { ...saved, title: 'Evening listening', notes: 'Private note' }, storage);
  const reloaded = readSignalCards('account-a', storage);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].title, 'Evening listening');
  assert.equal(reloaded[0].notes, 'Private note');
  assert.deepEqual(reloaded[0].capture, original.capture);
  assert.equal(readSignalCards('account-b', storage).length, 0);
  assert.equal(deleteSignalCard('account-a', original.id, storage).length, 0);
});

test('saving edits cannot replace original report or captured measurements', () => {
  const storage = new MemoryStorage();
  const original = card();
  saveSignalCard('account-a', original, storage);
  assert.throws(() => saveSignalCard('account-a', {
    ...original, report: { ...original.report, executiveSummary: 'Rewritten original' },
  }, storage), /original reading/);
  assert.deepEqual(readSignalCards('account-a', storage)[0].report, original.report);
});

test('a completed card preserves its chosen context, reflection, and measured capture', () => {
  const sourceReport = structuredClone(fixtureReport);
  const sourceCapture = structuredClone(fixtureCapture);
  const created = createSignalCard(sourceReport, sourceCapture);

  assert.equal(created.capture.listeningContext, sourceCapture.listeningContext);
  assert.equal(created.report.faithReflection, sourceReport.faithReflection);
  assert.deepEqual(created.capture.measurement, sourceCapture.measurement);
  const privateByDefault = signalCardToText(created, defaults);
  assert.ok(!privateByDefault.includes(sourceCapture.listeningContext));
  assert.ok(!privateByDefault.includes(sourceReport.faithReflection ?? ''));
  const explicitlyIncluded = signalCardToText(created, {
    ...defaults, includeContext: true, includeReflection: true,
  });
  assert.ok(explicitlyIncluded.includes(sourceCapture.listeningContext));
  assert.ok(explicitlyIncluded.includes(sourceReport.faithReflection ?? ''));
});

test('a stale editor cannot silently overwrite a newer saved card', () => {
  const storage = new MemoryStorage();
  const initial = saveSignalCard('account-a', card(), storage)[0];
  const otherTab = structuredClone(initial);
  const latest = saveSignalCard('account-a', { ...initial, title: 'Newer edit' }, storage)[0];
  assert.ok(Date.parse(latest.updatedAt) > Date.parse(initial.updatedAt));
  assert.throws(() => saveSignalCard('account-a', {
    ...otherTab, title: 'Stale edit',
  }, storage), /changed in another tab/);
  assert.equal(readSignalCards('account-a', storage)[0].title, 'Newer edit');
});

test('default exports omit context, personal notes, reflection and full interpretation', () => {
  const source = { ...card(), notes: 'SYNTHETIC_PRIVATE_NOTES' };
  for (const render of [signalCardToText, signalCardToHtml, signalCardToJson]) {
    const result = render(source, defaults);
    for (const hidden of [
      'SYNTHETIC_PRIVATE_CONTEXT', 'SYNTHETIC_PRIVATE_NOTES',
      'SYNTHETIC_PRIVATE_REFLECTION', 'SYNTHETIC_FULL_REPORT',
    ]) assert.ok(!result.includes(hidden), `${hidden} must require explicit inclusion`);
    assert.ok(result.includes('440'));
  }
});

test('each private field is included only by its own explicit export option', () => {
  const source = { ...card(), notes: 'SYNTHETIC_PRIVATE_NOTES' };
  const choices = {
    includeContext: 'SYNTHETIC_PRIVATE_CONTEXT', includeNotes: 'SYNTHETIC_PRIVATE_NOTES',
    includeReflection: 'SYNTHETIC_PRIVATE_REFLECTION', includeReport: 'SYNTHETIC_FULL_REPORT',
  };
  for (const [key, sentinel] of Object.entries(choices)) {
    for (const render of [signalCardToText, signalCardToHtml, signalCardToJson]) {
      const result = render(source, { ...defaults, [key]: true });
      assert.ok(result.includes(sentinel));
      for (const other of Object.values(choices).filter(value => value !== sentinel)) {
        assert.ok(!result.includes(other), `${key} must not include ${other}`);
      }
    }
  }
});

test('HTML exports escape edited text, reject external images, and disallow scripts', () => {
  const source = { ...card(), title: '<script>alert("x")</script>', summary: '<img src=x onerror=alert(1)>' };
  const html = signalCardToHtml(source, defaults);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /default-src 'none'/);
  assert.throws(() => signalCardToHtml({
    ...source, capture: { ...source.capture, spectrumImage: 'https://example.com/private.png' },
  }, defaults));
});

test('captured spectrum is embedded locally in HTML and JSON, but not text sharing', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=';
  const source = card();
  source.capture.spectrumImage = png;
  assert.ok(signalCardToHtml(source, defaults).includes(`src="${png}"`));
  assert.ok(signalCardToJson(source, defaults).includes(png));
  assert.ok(!signalCardToText(source, defaults).includes(png));
  assert.ok(!signalCardToHtml(source, defaults).includes('SYNTHETIC_PRIVATE_CONTEXT'));
});

test('corrupted saved data is reported and never overwritten during save', () => {
  const storage = new MemoryStorage();
  const key = signalCardStorageKey('account-a');
  storage.setItem(key, '{invalid-json');
  assert.throws(() => readSignalCards('account-a', storage), /not been overwritten/);
  assert.throws(() => saveSignalCard('account-a', card(), storage), /not been overwritten/);
  assert.equal(storage.getItem(key), '{invalid-json');
});

test('full libraries reject a new card without silently discarding an old one', () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 20; index++) {
    const source = card();
    saveSignalCard('account-a', { ...source, id: `card-${index}` }, storage);
  }
  assert.throws(() => saveSignalCard('account-a', card(), storage), /20 cards/);
  assert.equal(readSignalCards('account-a', storage).length, 20);
});

test('browser storage failures never return a false save success', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
  assert.throws(() => saveSignalCard('account-a', card(), storage), /could not be saved/);
});

test('a recovered report without measurement data does not invent a capture', () => {
  const recovered = createSignalCard(fixtureReport, null);
  assert.equal(recovered.capture.measurement, null);
  assert.equal(recovered.capture.spectrumImage, null);
  assert.match(signalCardToText(recovered, defaults), /Measurement: Not available/);
});
