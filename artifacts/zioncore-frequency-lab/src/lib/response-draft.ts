import { isPremiumEntitled, type MembershipSnapshot } from './membership-model';

const DRAFT_KEY = 'zioncore.response-draft.v1';
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Explicit same-tab handoff: never put a personal prayer/intention in a URL. */
export function prepareResponseDraft(text: string, storage?: DraftStorage, now = Date.now()) {
  if (!text.trim() || text.length > 512) throw new Error('Enter a response of up to 512 characters.');
  try { (storage ?? sessionStorage).setItem(DRAFT_KEY, JSON.stringify({ text, createdAt: now })); }
  catch { throw new Error('This browser could not prepare the private draft. Copy your message into the encoder manually.'); }
}
export function takeResponseDraft(storage?: DraftStorage, now = Date.now(), consume = true): string {
  try {
    const target = storage ?? sessionStorage;
    const raw = target.getItem(DRAFT_KEY);
    if (!raw) return '';
    const item = JSON.parse(raw);
    if (consume) target.removeItem(DRAFT_KEY);
    if (typeof item.text !== 'string' || item.text.length > 512 || typeof item.createdAt !== 'number' ||
      !Number.isFinite(item.createdAt) || now < item.createdAt || now - item.createdAt > 5 * 60_000) return '';
    return item.text;
  } catch { return ''; }
}

export function guidedResponseAccess(input: {
  userUid: string | null;
  membership: { uid: string; value: MembershipSnapshot } | null;
  hasPaidInterpretation: boolean;
}, now = Date.now()): 'sign-in' | 'premium' | 'quote' | 'encode' {
  if (!input.userUid) return 'sign-in';
  if (input.membership?.uid !== input.userUid || !isPremiumEntitled(input.membership.value, now)) return 'premium';
  return input.hasPaidInterpretation ? 'encode' : 'quote';
}
