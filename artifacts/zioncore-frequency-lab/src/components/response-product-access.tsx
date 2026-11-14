import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { readMembership, type MembershipSnapshot } from '@/lib/membership';
import { guidedResponseAccess, prepareResponseDraft } from '@/lib/response-draft';

/** A guided local product gate. Financial execution remains in the existing signed-quote API. */
export default function ResponseProductAccess({ draft, userUid, hasPaidInterpretation }: {
  draft: string; userUid: string | null; hasPaidInterpretation: boolean;
}) {
  const [member, setMember] = useState<{ uid: string; value: MembershipSnapshot } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeUser = useRef(userUid);
  activeUser.current = userUid;
  useEffect(() => { setMember(null); setError(''); setBusy(false); }, [userUid]);
  const step = guidedResponseAccess({ userUid, membership: member, hasPaidInterpretation });
  const checkMembership = async () => {
    if (!userUid || busy) return;
    const uid = userUid;
    setBusy(true); setError('');
    try {
      const value = await readMembership(uid);
      if (activeUser.current === uid) setMember({ uid, value });
    } catch {
      if (activeUser.current === uid) setError('Membership could not be verified. Sign in and retry. No credits have been charged.');
    } finally {
      if (activeUser.current === uid) setBusy(false);
    }
  };
  return <div>
    <ol className="zc-fx-checks">
      <li><strong>1 · Premium</strong> {step === 'quote' || step === 'encode'
        ? 'Active membership verified.'
        : <Link href="/premium">Sign in and activate Premium</Link>}
        {userUid && <button type="button" className="btn btn-subtle" disabled={busy} onClick={() => void checkMembership()} data-testid="button-verify-response-membership">{busy ? 'Checking…' : 'Check my membership'}</button>}
        {member?.uid === userUid && step === 'premium' && <span>No active Premium entitlement was found.</span>}</li>
      <li><strong>2 · Deeper reading</strong> {hasPaidInterpretation
        ? 'A completed paid interpretation is available for your account in this session.'
        : step === 'quote'
          ? <a href="#interpretation">Review the quote, buy credits if needed, then approve your deeper reading</a>
          : 'After membership, approve a credit-funded interpretation. No processing starts automatically.'}</li>
      <li><strong>3 · Personalised response</strong> Review your draft, encode it, then explicitly preview or play the signal.</li>
    </ol>
    {step === 'encode' ? <Link href="/messages" className="btn btn-primary zc-fx-mt" data-testid="link-encode-draft" onClick={event => {
      try { prepareResponseDraft(draft); setError(''); }
      catch (cause) { event.preventDefault(); setError(cause instanceof Error ? cause.message : 'The local draft could not be prepared.'); }
    }}>Continue personalised response</Link>
      : <button type="button" className="btn btn-primary zc-fx-mt" disabled>Complete the steps to continue</button>}
    {error && <p role="alert">{error}</p>}
    <p className="zc-fx-note">Drafting is free. This guided response requires Premium and a completed credit-funded interpretation; encoding does not charge again. The standalone free encoder demonstration remains available below. Nothing is broadcast automatically.</p>
  </div>;
}
