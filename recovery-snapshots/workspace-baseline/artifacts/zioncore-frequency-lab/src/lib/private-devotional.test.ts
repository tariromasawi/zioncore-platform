import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDevotionalExport, createDevotionalRecord } from '@/lib/private-devotional';

const validDraft = {
  title: 'A family blessing',
  recordType: 'family-blessing' as const,
  intention: 'unity' as const,
  personOrFamilyLabel: 'Family',
  content: 'A private, user-authored blessing.',
};

test('devotional entries are validated, user-authored, and have no account or sharing metadata', () => {
  const record = createDevotionalRecord(
    { ...validDraft, title: '  A private title  ', content: '  Personal words.  ' },
    { id: 'ba40e443-39c5-4d39-b0ce-f61c02a63cde', now: new Date('2026-11-12T12:00:00.000Z') },
  );
  assert.equal(record.title, 'A private title');
  assert.equal(record.content, 'Personal words.');
  assert.equal(record.createdAt, '2026-11-12T12:00:00.000Z');
  assert.equal('uid' in record, false);
  assert.equal('shared' in record, false);
});

test('devotional entries reject empty or overlong private text', () => {
  assert.throws(() => createDevotionalRecord({ ...validDraft, content: '  ' }), /Write a prayer/);
  assert.throws(() => createDevotionalRecord({ ...validDraft, title: 'x'.repeat(121) }));
  assert.throws(() => createDevotionalRecord({ ...validDraft, personOrFamilyLabel: 'x'.repeat(121) }));
});

test('user-initiated export includes only supplied records and excludes shared collections', () => {
  const record = createDevotionalRecord(validDraft, {
    id: 'ba40e443-39c5-4d39-b0ce-f61c02a63cde',
    now: new Date('2026-11-12T12:00:00.000Z'),
  });
  const exported = createDevotionalExport([record], new Date('2026-11-12T12:10:00.000Z'));
  assert.equal(exported.userInitiated, true);
  assert.equal(exported.sharedCollectionIncluded, false);
  assert.equal(exported.storage, 'temporary-in-memory-session');
  assert.equal(exported.records.length, 1);
  assert.equal('ownerUid' in exported, false);
});
