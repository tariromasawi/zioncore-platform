import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Compass,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  getGetWalletQueryKey,
  getListWalletTransactionsQueryKey,
  useGetWallet,
  useListWalletTransactions,
} from '@workspace/api-client-react';
import { updateProfile, type User } from 'firebase/auth';
import { getFirebaseIdentityHeaders } from '@/lib/firebase';
import { readMembership, FREE_MEMBERSHIP, isPremiumEntitled, type MembershipSnapshot } from '@/lib/membership';
import { canManageStripeBilling, membershipDisplayLabel } from '@/lib/membership-model';
import {
  customerServiceGoals,
  getCustomerServiceRecommendation,
  type CustomerServiceGoal,
} from '@/lib/customer-service-recommendations';
import BillingOffers from './billing-offers';

export type WalletPageProps = {
  user: User | null;
  authLoading: boolean;
  firebaseReady: boolean;
  projectMismatch: boolean;
};

type WalletAuth = {
  uid: string;
  headers: Record<string, string>;
};

type MembershipState = {
  uid: string;
  membership: MembershipSnapshot;
  unavailable: boolean;
};

function formatDate(value: string | null) {
  if (!value) return 'Not yet recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function transactionName(type: string) {
  const names: Record<string, string> = {
    purchase: 'Credit purchase',
    promotional_grant: 'Promotional grant',
    reservation: 'Usage reserved',
    settlement: 'Usage settled',
    release: 'Reservation released',
  };
  return names[type] ?? 'Wallet update';
}

function signedAmount(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

export default function WalletPage({
  user,
  authLoading,
  firebaseReady,
  projectMismatch,
}: WalletPageProps) {
  const [auth, setAuth] = useState<WalletAuth | null>(null);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [membershipState, setMembershipState] = useState<MembershipState | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<CustomerServiceGoal>('frequency');

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setProfileMessage('');
    setProfileError('');
  }, [user?.uid]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || profileBusy) return;
    const nextName = displayName.trim().slice(0, 80);
    setProfileBusy(true);
    setProfileMessage('');
    setProfileError('');
    try {
      await updateProfile(user, { displayName: nextName || null });
      setDisplayName(nextName);
      setProfileMessage('Your Firebase account display name has been updated.');
    } catch {
      setProfileError('The display name could not be saved. Sign in again if your session needs refreshing, then retry.');
    } finally {
      setProfileBusy(false);
    }
  };

  useEffect(() => {
    let current = true;
    setAuth(null);
    setAuthError('');

    if (!user || !firebaseReady || projectMismatch) {
      if (user && !authLoading) {
        setAuthError(projectMismatch
          ? 'This project does not match the approved Firebase configuration.'
          : !firebaseReady
            ? 'Firebase sign-in is not ready. Private wallet access is paused.'
            : '');
      }
      return () => { current = false; };
    }

    void getFirebaseIdentityHeaders(user).then(headers => {
      if (!current) return;
      setAuth({
        uid: user.uid,
        headers,
      });
    }).catch(() => {
      if (current) setAuthError('Secure wallet credentials could not be obtained. Check your connection and retry.');
    });

    return () => { current = false; };
  }, [user?.uid, firebaseReady, projectMismatch, authLoading, authAttempt]);

  useEffect(() => {
    let current = true;
    setMembershipState(null);
    if (!user || !firebaseReady || projectMismatch) return () => { current = false; };

    void readMembership(user.uid).then(membership => {
      if (current) setMembershipState({ uid: user.uid, membership, unavailable: false });
    }).catch(() => {
      if (current) {
        setMembershipState({
          uid: user.uid,
          membership: FREE_MEMBERSHIP,
          unavailable: true,
        });
      }
    });
    return () => { current = false; };
  }, [user?.uid, firebaseReady, projectMismatch]);

  const authenticated = Boolean(user && auth?.uid === user.uid);
  const walletKey = useMemo(
    () => [...getGetWalletQueryKey(), user?.uid ?? 'signed-out'] as const,
    [user?.uid],
  );
  const transactionsKey = useMemo(
    () => [...getListWalletTransactionsQueryKey({ limit: 12 }), user?.uid ?? 'signed-out'] as const,
    [user?.uid],
  );

  const walletQuery = useGetWallet({
    query: {
      enabled: authenticated,
      queryKey: walletKey,
      refetchInterval: authenticated ? 30_000 : false,
      refetchOnWindowFocus: true,
    },
    request: { headers: auth && auth.uid === user?.uid ? auth.headers : undefined },
  });
  const transactionsQuery = useListWalletTransactions(
    { limit: 12 },
    {
      query: {
        enabled: authenticated,
        queryKey: transactionsKey,
        refetchInterval: authenticated ? 30_000 : false,
        refetchOnWindowFocus: true,
      },
      request: { headers: auth && auth.uid === user?.uid ? auth.headers : undefined },
    },
  );

  const wallet = authenticated ? walletQuery.data : undefined;
  const transactions = authenticated ? transactionsQuery.data?.transactions : undefined;
  const membership = membershipState?.uid === user?.uid ? membershipState : null;
  const membershipIsPremium = Boolean(membership && isPremiumEntitled(membership.membership));
  const membershipLabel = membership ? membershipDisplayLabel(membership.membership) : 'Checking';
  const canManageBilling = Boolean(
    membership && !membership.unavailable && canManageStripeBilling(membership.membership),
  );
  const pending = authLoading || (Boolean(user) && !authenticated && !authError);
  const serviceRecommendation = getCustomerServiceRecommendation(selectedGoal, membershipIsPremium);

  return (
    <main className="zc-wallet" data-testid="page-wallet">
      <style>{`
        .zc-wallet {
          --zw-ink: #203a3d;
          --zw-muted: #70817c;
          --zw-line: #ded9cd;
          --zw-paper: #f5f2e9;
          --zw-panel: #fbf9f2;
          --zw-teal: #25484b;
          --zw-gold: #dcae5f;
          min-height: 100dvh;
          padding: clamp(26px, 5vw, 58px) 0 76px;
          color: var(--zw-ink);
          background:
            radial-gradient(ellipse at 86% 2%, rgba(220,174,95,.15), transparent 32rem),
            linear-gradient(180deg, #f4f1e8 0%, #eeece3 100%);
          font-family: var(--app-font-sans, 'DM Sans', sans-serif);
        }
        .zw-wrap { width: min(1160px, calc(100% - 40px)); margin: 0 auto; }
        .zw-topline { display:flex; align-items:center; justify-content:space-between; gap:20px; }
        .zw-kicker { display:flex; align-items:center; gap:9px; color:#71817c; font:10px var(--app-font-mono, monospace); letter-spacing:.15em; text-transform:uppercase; }
        .zw-kicker-mark { display:grid; place-items:center; width:28px; height:28px; color:#f2c66d; background:var(--zw-teal); border-radius:50% 50% 50% 8px; }
        .zw-private { display:flex; align-items:center; gap:7px; padding:8px 11px; border:1px solid #d8d4c8; border-radius:2px; color:#71817c; font:9px var(--app-font-mono, monospace); letter-spacing:.08em; text-transform:uppercase; }
        .zw-hero { position:relative; display:grid; grid-template-columns:minmax(0,1.15fr) minmax(250px,.85fr); gap:42px; align-items:end; padding:47px 0 35px; }
        .zw-overline { margin:0 0 12px; color:#a07838; font:10px var(--app-font-mono, monospace); letter-spacing:.15em; text-transform:uppercase; }
        .zw-title { max-width:700px; margin:0; color:#203a3d; font:clamp(46px, 7vw, 82px)/.9 var(--app-font-serif, Georgia, serif); font-weight:400; letter-spacing:-.04em; }
        .zw-title em { color:#ad7c35; font-weight:400; }
        .zw-intro { max-width:640px; margin:19px 0 0; color:#70817c; font-size:13px; line-height:1.8; }
        .zw-hero-art { position:relative; min-height:160px; display:flex; justify-content:flex-end; align-items:flex-end; }
        .zw-orbit { position:relative; width:210px; height:150px; border:1px solid rgba(37,72,75,.2); border-radius:50%; transform:rotate(-18deg); }
        .zw-orbit::before,.zw-orbit::after { content:""; position:absolute; inset:20px -12px; border:1px solid rgba(37,72,75,.16); border-radius:50%; transform:rotate(40deg); }
        .zw-orbit::after { inset:39px -24px; border-color:rgba(220,174,95,.55); transform:rotate(-50deg); }
        .zw-orbit-core { position:absolute; width:60px; height:60px; top:50%; left:50%; transform:translate(-50%,-50%) rotate(18deg); display:grid; place-items:center; border-radius:50%; color:#f1c66c; background:var(--zw-teal); box-shadow:0 0 0 9px rgba(37,72,75,.08); }
        .zw-orbit-label { position:absolute; right:5px; bottom:7px; color:#81908a; font:9px var(--app-font-mono, monospace); letter-spacing:.1em; text-transform:uppercase; }
        .zw-snapshot { display:grid; grid-template-columns:1.4fr repeat(3,1fr); margin:0 0 52px; border:1px solid #d8d2c5; background:rgba(251,249,242,.85); box-shadow:0 10px 35px rgba(43,55,49,.045); }
        .zw-total { position:relative; display:flex; flex-direction:column; justify-content:center; min-height:142px; padding:23px 27px; color:#f4f0e6; background:var(--zw-teal); overflow:hidden; }
        .zw-total::after { content:""; position:absolute; width:165px; height:165px; right:-49px; bottom:-103px; border:1px solid rgba(240,197,108,.44); border-radius:50%; box-shadow:0 0 0 19px rgba(240,197,108,.07),0 0 0 39px rgba(240,197,108,.04); }
        .zw-total-label { color:#b9c9bf; font:9px var(--app-font-mono, monospace); letter-spacing:.14em; text-transform:uppercase; }
        .zw-total-value { margin-top:10px; font:clamp(40px,5vw,58px)/1 var(--app-font-mono, monospace); letter-spacing:-.07em; }
        .zw-total-caption { margin-top:7px; color:#c1cec4; font-size:10px; }
        .zw-stat { min-width:0; padding:26px 22px 20px; border-left:1px solid #e3ded3; }
        .zw-stat-label { display:flex; align-items:center; gap:7px; color:#7a8982; font:9px var(--app-font-mono, monospace); letter-spacing:.09em; text-transform:uppercase; }
        .zw-stat-value { display:block; margin-top:15px; color:#28474a; font:28px var(--app-font-mono, monospace); letter-spacing:-.05em; }
        .zw-stat-note { margin-top:5px; color:#99a098; font-size:9px; }
        .zw-section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:17px; }
        .zw-section-eyebrow { color:#a07838; font:9px var(--app-font-mono, monospace); letter-spacing:.16em; text-transform:uppercase; }
        .zw-section-title { margin:5px 0 0; font:31px/1.05 var(--app-font-serif, Georgia, serif); font-weight:400; color:#294548; }
        .zw-section-note { max-width:390px; margin:0; color:#82908a; font-size:10px; line-height:1.65; text-align:right; }
        .zw-catalog { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .zw-pack { position:relative; min-height:220px; padding:20px 21px 18px; border:1px solid #d9d4c9; background:rgba(251,249,242,.82); overflow:hidden; transition:transform .22s ease; }
        .zw-pack:hover { transform:translateY(-3px); border-color:#bca775; }
        .zw-pack.lab { background:#e7e9df; border-color:#c8d0c4; }
        .zw-pack.throne { background:#29484b; border-color:#29484b; color:#f5f0e4; }
        .zw-pack-top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .zw-pack-code { color:#9b865a; font:8px var(--app-font-mono, monospace); letter-spacing:.12em; }
        .zw-pack.throne .zw-pack-code { color:#d7b56f; }
        .zw-pack-status { padding:5px 7px; border:1px solid #d4c9af; color:#876d3b; font:8px var(--app-font-mono, monospace); letter-spacing:.07em; text-transform:uppercase; white-space:nowrap; }
        .zw-pack.throne .zw-pack-status { color:#f1d38b; border-color:#6e8176; }
        .zw-pack-name { margin:20px 0 0; font:32px/1 var(--app-font-serif, Georgia, serif); font-weight:400; }
        .zw-pack-credits { display:flex; align-items:baseline; gap:7px; margin-top:8px; }
        .zw-pack-number { color:#a47636; font:26px var(--app-font-mono, monospace); }
        .zw-pack.throne .zw-pack-number { color:#efc66e; }
        .zw-pack-unit { color:#83918a; font-size:10px; }
        .zw-pack-copy { max-width:330px; margin:12px 0 0; color:#7b8983; font-size:10px; line-height:1.65; }
        .zw-pack.throne .zw-pack-copy { color:#c6d0c5; }
        .zw-pack-bottom { display:flex; align-items:center; gap:8px; margin-top:17px; padding-top:12px; border-top:1px solid rgba(120,132,121,.2); color:#876e42; font:9px var(--app-font-mono, monospace); text-transform:uppercase; letter-spacing:.06em; }
        .zw-pack.throne .zw-pack-bottom { color:#e3ca91; }
        .zw-notice { display:flex; align-items:flex-start; gap:12px; margin:15px 0 48px; padding:14px 16px; border-left:2px solid #d3a64f; background:#ebe7dc; color:#647671; font-size:10px; line-height:1.7; }
        .zw-notice strong { color:#3d5a58; }
        .zw-lower { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(270px,.8fr); gap:16px; align-items:start; }
        .zw-panel { border:1px solid #dbd6ca; background:rgba(251,249,242,.85); }
        .zw-profile { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.8fr); gap:20px; align-items:center; margin:0 0 16px; padding:19px; }
        .zw-profile h2 { margin:0; color:#385457; font:22px var(--app-font-serif, Georgia, serif); font-weight:400; }
        .zw-profile-email { margin:6px 0 0; color:#778680; font-size:10px; overflow-wrap:anywhere; }
        .zw-profile-meta { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
        .zw-profile-meta span { padding:5px 7px; color:#647b70; background:#ecebe2; font:8px var(--app-font-mono, monospace); letter-spacing:.05em; text-transform:uppercase; }
        .zw-profile-form { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:end; }
        .zw-profile-form label { grid-column:1/-1; color:#82908a; font:9px var(--app-font-mono, monospace); letter-spacing:.08em; text-transform:uppercase; }
        .zw-profile-form input { min-width:0; height:38px; padding:8px 10px; border:1px solid #d8d2c5; border-radius:0; color:#294548; background:#fffdf7; font:11px var(--app-font-sans, sans-serif); }
        .zw-profile-form button { min-height:38px; padding:8px 12px; border:1px solid #25484b; color:#f4f0e6; background:#25484b; font-size:10px; cursor:pointer; }
        .zw-profile-form button:disabled { opacity:.55; cursor:wait; }
        .zw-profile-status { grid-column:1/-1; margin:0; color:#617b68; font-size:9px; }
        .zw-profile-status.error { color:#965c51; }
        .zw-panel-head { display:flex; justify-content:space-between; align-items:center; padding:17px 19px; border-bottom:1px solid #e4dfd4; }
        .zw-panel-title { display:flex; align-items:center; gap:9px; color:#385457; font-size:11px; font-weight:700; letter-spacing:.03em; }
        .zw-panel-meta { color:#929b92; font:8px var(--app-font-mono, monospace); letter-spacing:.09em; text-transform:uppercase; }
        .zw-activity-list { list-style:none; margin:0; padding:0; }
        .zw-activity { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:12px; align-items:center; padding:13px 19px; border-bottom:1px solid #ece8df; }
        .zw-activity:last-child { border-bottom:0; }
        .zw-activity-icon { width:31px; height:31px; display:grid; place-items:center; color:#627b72; background:#eeece2; border-radius:50%; }
        .zw-activity-name { color:#405d5b; font-size:10px; font-weight:700; }
        .zw-activity-date { margin-top:4px; color:#98a097; font:8px var(--app-font-mono, monospace); }
        .zw-activity-delta { color:#5d786b; font:11px var(--app-font-mono, monospace); text-align:right; white-space:nowrap; }
        .zw-activity-delta.negative { color:#a56853; }
        .zw-empty { display:grid; place-items:center; min-height:157px; padding:24px; text-align:center; }
        .zw-empty-icon { width:35px; height:35px; display:grid; place-items:center; margin-bottom:9px; color:#82928a; border:1px solid #ded9cd; border-radius:50%; }
        .zw-empty strong { color:#536d68; font:20px var(--app-font-serif, Georgia, serif); font-weight:400; }
        .zw-empty p { max-width:300px; margin:6px 0 0; color:#8b9690; font-size:9px; line-height:1.65; }
        .zw-error { display:flex; flex-direction:column; align-items:flex-start; gap:9px; padding:20px; color:#8c5148; font-size:10px; line-height:1.6; }
        .zw-error button { display:inline-flex; align-items:center; gap:7px; border:1px solid #d7cfc1; padding:8px 10px; color:#496361; background:#f4f1e8; font-size:9px; cursor:pointer; }
        .zw-error button:hover { background:#ebe7dc; }
        .zw-membership { padding:18px 19px 19px; }
        .zw-member-top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .zw-tier { display:flex; align-items:center; gap:8px; color:#405d5b; font:22px var(--app-font-serif, Georgia, serif); }
        .zw-tier-badge { padding:5px 7px; color:#627b65; background:#e6e9df; font:8px var(--app-font-mono, monospace); letter-spacing:.07em; text-transform:uppercase; }
        .zw-tier-badge.premium { color:#7c612c; background:#efe5cf; }
        .zw-membership p { margin:10px 0 0; color:#83908a; font-size:9px; line-height:1.7; }
        .zw-planned { margin-top:14px; padding:12px 13px; border:1px solid #e4dfd4; background:#f4f1e8; }
        .zw-planned-title { display:flex; align-items:center; gap:7px; color:#927642; font:8px var(--app-font-mono, monospace); letter-spacing:.1em; text-transform:uppercase; }
        .zw-planned p { margin:7px 0 0; }
        .zw-capabilities { margin-top:45px; border-top:1px solid #d9d4c9; padding-top:22px; }
        .zw-cap-head { display:flex; justify-content:space-between; gap:20px; align-items:baseline; margin-bottom:12px; }
        .zw-cap-title { margin:0; color:#365256; font:23px var(--app-font-serif, Georgia, serif); font-weight:400; }
        .zw-cap-sub { color:#89948d; font:8px var(--app-font-mono, monospace); text-transform:uppercase; letter-spacing:.1em; }
        .zw-cap-grid { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #ded9cd; background:#e3dfd5; gap:1px; }
        .zw-cap-item { padding:14px; background:#f7f4eb; }
        .zw-cap-item strong { color:#48625e; font-size:9px; }
        .zw-cap-item p { margin:6px 0 0; color:#83908a; font-size:9px; line-height:1.6; }
        .zw-service-launch { margin:0 0 34px; }
        .zw-service-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }
        .zw-service-card { display:flex; flex-direction:column; align-items:flex-start; min-height:155px; padding:15px; border:1px solid #d9d4c9; background:rgba(251,249,242,.82); color:#294548; text-decoration:none; transition:transform .18s ease,border-color .18s ease,background .18s ease; }
        .zw-service-card:hover { transform:translateY(-2px); border-color:#bca775; background:#fbf9f2; }
        .zw-service-card:focus-visible { outline:2px solid #a07838; outline-offset:3px; }
        .zw-service-kicker { color:#a07838; font:8px var(--app-font-mono, monospace); letter-spacing:.13em; text-transform:uppercase; }
        .zw-service-title { margin-top:13px; color:#365256; font:20px/1.05 var(--app-font-serif, Georgia, serif); }
        .zw-service-copy { margin-top:8px; color:#7b8983; font-size:9px; line-height:1.6; }
        .zw-service-action { display:flex; align-items:center; gap:6px; margin-top:auto; padding-top:12px; color:#6f704e; font:8px var(--app-font-mono, monospace); letter-spacing:.06em; text-transform:uppercase; }
         .zw-journey { display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:15px;margin:0 0 14px;padding:17px;border:1px solid #d8d1c0;background:linear-gradient(125deg,#f0ede3,#faf8f1 62%,#ece8dc); }
         .zw-journey-select h3 { margin:7px 0 13px;color:#345153;font:20px/1.12 var(--app-font-serif, Georgia, serif);font-weight:400; }
         .zw-journey-label { display:flex;align-items:center;gap:6px;color:#9c7940;font:8px var(--app-font-mono, monospace);letter-spacing:.12em;text-transform:uppercase; }
         .zw-goal-options { display:flex;flex-wrap:wrap;gap:6px; }
         .zw-goal-options button { min-height:34px;padding:7px 9px;border:1px solid #d7d1c4;background:#faf8f1;color:#6f7e76;font:9px var(--app-font-sans, sans-serif);cursor:pointer; }
         .zw-goal-options button:hover,.zw-goal-options button.selected { border-color:#a98b55;background:#e9e5d8;color:#345153; }
         .zw-goal-options button:focus-visible { outline:2px solid #a07838;outline-offset:2px; }
         .zw-journey-recommendation { padding:15px 16px;border-left:2px solid #b48a43;background:#fffdf8; }
         .zw-journey-kicker { color:#a07838;font:8px var(--app-font-mono, monospace);letter-spacing:.12em;text-transform:uppercase; }
         .zw-journey-recommendation h4 { margin:7px 0;color:#345153;font:21px/1.1 var(--app-font-serif, Georgia, serif);font-weight:400; }
         .zw-journey-recommendation p { margin:0;color:#78877f;font-size:9px;line-height:1.65; }
         .zw-journey-recommendation ol { display:grid;gap:5px;margin:10px 0 0;padding-left:17px;color:#78877f;font-size:9px;line-height:1.6; }
         .zw-journey-actions { display:flex;flex-wrap:wrap;gap:7px;margin-top:13px; }
         .zw-journey-actions .btn { min-height:35px;padding:7px 10px;font-size:9px;text-decoration:none; }
         .zw-journey-actions .btn-primary { width:auto;background:#25484b; }
         .zw-journey-note { grid-column:1/-1;margin:0;color:#89938b;font-size:8px;line-height:1.6; }
        .zw-foot { display:flex; justify-content:space-between; align-items:flex-start; gap:25px; margin-top:23px; color:#929b93; font-size:8px; line-height:1.7; }
        .zw-foot a { color:#536f69; text-underline-offset:3px; }
        .zw-skeleton { position:relative; overflow:hidden; background:#e5e1d7; color:transparent; border-radius:2px; }
        .zw-skeleton::after { content:""; position:absolute; inset:0; background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.5) 48%,transparent 72%); transform:translateX(-100%); animation:zw-shimmer 1.7s ease-in-out infinite; }
        .zw-skel-value { display:block; width:110px; height:35px; margin-top:12px; }
        .zw-skel-line { display:block; width:100%; height:11px; margin:9px 0; }
        .zw-skel-line.short { width:54%; }
        @keyframes zw-shimmer { to { transform:translateX(100%); } }
        @media (prefers-reduced-motion: reduce) {
          .zw-wallet *, .zw-wallet *::before, .zw-wallet *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; transition-duration:.01ms !important; }
        }
        @media (max-width:800px) {
          .zw-hero { grid-template-columns:1fr minmax(150px,.55fr); gap:18px; }
          .zw-snapshot { grid-template-columns:repeat(3,1fr); }
          .zw-total { grid-column:1/-1; min-height:123px; }
          .zw-stat:first-of-type { border-left:0; }
          .zw-lower { grid-template-columns:1fr; }
          .zw-cap-grid { grid-template-columns:repeat(2,1fr); }
          .zw-service-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
           .zw-journey { grid-template-columns:1fr; }
           .zw-journey-note { grid-column:auto; }
        }
        @media (max-width:560px) {
          .zw-wrap { width:calc(100% - 28px); }
          .zw-private { font-size:0; gap:0; padding:8px; }
          .zw-private svg { width:15px; height:15px; }
          .zw-hero { grid-template-columns:1fr; padding:35px 0 25px; }
          .zw-title { font-size:clamp(48px,14vw,70px); }
          .zw-hero-art { min-height:80px; justify-content:center; margin-top:-4px; }
          .zw-profile { grid-template-columns:1fr; gap:13px; padding:15px; }
          .zw-orbit { width:150px; height:100px; }
          .zw-orbit-core { width:43px; height:43px; }
          .zw-orbit-label { right:-32px; bottom:1px; }
          .zw-snapshot { margin-bottom:38px; }
          .zw-stat { padding:17px 11px 14px; }
          .zw-stat-label { font-size:7px; letter-spacing:.03em; }
          .zw-stat-value { font-size:22px; }
          .zw-stat-note { font-size:8px; }
          .zw-section-head { display:block; }
          .zw-section-note { margin-top:9px; text-align:left; }
          .zw-catalog { grid-template-columns:1fr; }
          .zw-pack { min-height:0; }
          .zw-notice { margin-bottom:37px; }
          .zw-cap-grid { grid-template-columns:1fr 1fr; }
          .zw-cap-item { padding:11px; }
          .zw-service-grid { grid-template-columns:1fr 1fr; gap:7px; }
          .zw-service-card { min-height:156px; padding:11px; }
          .zw-service-title { font-size:18px; }
           .zw-journey { padding:12px; }
           .zw-journey-actions { display:grid; }
           .zw-journey-actions .btn { justify-content:center; }
          .zw-foot { flex-direction:column; gap:10px; }
        }
      `}</style>

      <div className="zw-wrap">
        <div className="zw-topline">
          <div className="zw-kicker">
            <span className="zw-kicker-mark"><Waves size={15} aria-hidden="true" /></span>
            ZionCore / Frequency Intelligence
          </div>
          <div className="zw-private" data-testid="status-wallet-privacy">
            <LockKeyhole size={12} aria-hidden="true" /> Private account view
          </div>
        </div>

        <header className="zw-hero">
          <div>
            <p className="zw-overline">Customer dashboard / account &amp; credit ledger</p>
            <h1 className="zw-title">Your signal.<br /><em>Your units.</em></h1>
            <p className="zw-intro">
              Your account home for listening credits, membership, and the offers available in ZionCore. Build a richer frequency practice one saved observation at a time.
            </p>
          </div>
          <div className="zw-hero-art" aria-hidden="true">
            <div className="zw-orbit">
              <span className="zw-orbit-core"><AudioLines size={24} /></span>
              <span className="zw-orbit-label">Measured / not assumed</span>
            </div>
          </div>
        </header>

        {!user && !authLoading && (
          <section className="zw-panel zw-empty" data-testid="status-wallet-sign-in">
            <span className="zw-empty-icon"><LockKeyhole size={16} aria-hidden="true" /></span>
            <strong>Private by design.</strong>
            <p>Create a free account or sign in to see your private wallet, saved account records, and membership. Your frequency journal starts with the observations you choose to keep.</p>
            <Link href="/history" data-testid="link-wallet-history-sign-in">Sign in or join free <span aria-hidden="true">→</span></Link>
            <Link href="#zw-catalog-title" className="btn btn-subtle" data-testid="link-wallet-browse-plans">Browse credit packs and Premium <span aria-hidden="true">→</span></Link>
          </section>
        )}
        {user && (
          <section className="zw-panel zw-profile" aria-labelledby="zw-profile-title" data-testid="panel-wallet-profile">
            <div>
              <h2 id="zw-profile-title">Account profile</h2>
              <p className="zw-profile-email" data-testid="text-wallet-profile-email">{user.email || 'Email unavailable'}</p>
              <div className="zw-profile-meta">
                <span>{user.emailVerified ? 'Email verified' : 'Email not verified'}</span>
                <span>{[...new Set(user.providerData.map(provider => provider.providerId))]
                  .map(provider => provider === 'google.com' ? 'Google' : provider === 'apple.com' ? 'Apple' : provider === 'password' ? 'Email and password' : provider)
                  .join(' · ') || 'Account provider unavailable'}</span>
              </div>
              <Link href="/history" className="permission-note" data-testid="link-wallet-account-settings">Account, sign-in and privacy options</Link>
            </div>
            <form className="zw-profile-form" aria-label="Edit profile" aria-busy={profileBusy} onSubmit={event => void saveProfile(event)}>
              <label htmlFor="zw-profile-display-name">Display name</label>
              <input
                id="zw-profile-display-name"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                disabled={profileBusy}
                data-testid="input-wallet-display-name"
              />
              <button type="submit" disabled={profileBusy} data-testid="button-wallet-save-profile">
                {profileBusy ? 'Saving…' : 'Save profile'}
              </button>
              {profileMessage && <p className="zw-profile-status" role="status" data-testid="status-wallet-profile-saved">{profileMessage}</p>}
              {profileError && <p className="zw-profile-status error" role="alert" data-testid="status-wallet-profile-error">{profileError}</p>}
            </form>
            <p className="sr-only" role="status" aria-atomic="true">{profileBusy ? 'Saving your profile. Please wait.' : ''}</p>
          </section>
        )}
        {user && projectMismatch && (
          <section className="zw-error" role="alert" data-testid="status-wallet-project-mismatch">
            <CircleAlert size={17} aria-hidden="true" />
            <span>Private wallet access is unavailable because this Firebase project does not match the approved project configuration.</span>
          </section>
        )}
        {user && !projectMismatch && authError && (
          <section className="zw-error" role="alert" data-testid="status-wallet-auth-error">
            <CircleAlert size={17} aria-hidden="true" />
            <span>{authError}</span>
            <button type="button" onClick={() => setAuthAttempt(attempt => attempt + 1)} data-testid="button-wallet-auth-retry">
              <RefreshCw size={12} aria-hidden="true" /> Retry secure setup
            </button>
          </section>
        )}
        {user && !projectMismatch && !authError && (
          <>
            <section className="zw-snapshot" aria-label="Wallet balance summary" data-testid="panel-wallet-snapshot">
              <div className="zw-total" aria-live="polite" data-testid="value-wallet-available">
                <span className="zw-total-label">Available units</span>
                {pending || walletQuery.isLoading ? (
                  <span className="zw-skeleton zw-skel-value" aria-label="Loading available credits" data-testid="status-wallet-loading" />
                ) : wallet ? (
                  <>
                    <span className="zw-total-value">{wallet.availableCredits.toLocaleString()}</span>
                    <span className="zw-total-caption">Platform usage units · no cash value</span>
                  </>
                ) : (
                  <span className="zw-total-caption">Wallet data unavailable</span>
                )}
              </div>
              {[
                { label: 'Purchased', value: wallet?.purchasedCredits, note: 'ledger units', icon: <ArrowDownLeft size={12} /> },
                { label: 'Promotional', value: wallet?.promotionalCredits, note: 'ledger units', icon: <Sparkles size={12} /> },
                { label: 'Reserved', value: wallet?.reservedCredits, note: 'in-use units', icon: <Activity size={12} /> },
              ].map(item => (
                <div className="zw-stat" key={item.label} data-testid={`value-wallet-${item.label.toLowerCase()}`}>
                  <span className="zw-stat-label">{item.icon}{item.label}</span>
                  {pending || walletQuery.isLoading
                    ? <span className="zw-skeleton zw-skel-value" aria-label={`Loading ${item.label.toLowerCase()} credits`} />
                    : <strong className="zw-stat-value">{wallet ? item.value?.toLocaleString() : '—'}</strong>}
                  <span className="zw-stat-note">{item.note}</span>
                </div>
              ))}
            </section>

            {(walletQuery.isError || transactionsQuery.isError) && (
              <section className="zw-error" role="alert" data-testid="status-wallet-load-error">
                <CircleAlert size={17} aria-hidden="true" />
                <span>Wallet records could not be loaded. Your balance is not being estimated or substituted.</span>
                <button type="button" onClick={() => { void walletQuery.refetch(); void transactionsQuery.refetch(); }} data-testid="button-wallet-retry">
                  <RefreshCw size={12} aria-hidden="true" /> Retry secure request
                </button>
              </section>
            )}

            <div className="zw-lower">
              <section className="zw-panel" aria-labelledby="zw-activity-title" data-testid="panel-wallet-activity">
                <div className="zw-panel-head">
                  <h2 className="zw-panel-title" id="zw-activity-title"><Clock3 size={14} aria-hidden="true" /> Recent ledger activity</h2>
                  <span className="zw-panel-meta">Latest 12 / secure ledger</span>
                </div>
                {transactionsQuery.isLoading || pending ? (
                  <div className="zw-empty" role="status" data-testid="status-wallet-activity-loading">
                    <span className="zw-skeleton zw-skel-line" /><span className="zw-skeleton zw-skel-line" /><span className="zw-skeleton zw-skel-line short" />
                    <p>Loading private ledger records…</p>
                  </div>
                ) : transactionsQuery.isError ? (
                  <div className="zw-empty" role="status" data-testid="status-wallet-activity-unavailable">
                    <span className="zw-empty-icon"><CircleAlert size={15} /></span>
                    <strong>Activity unavailable</strong><p>Recent entries could not be verified. Retry the secure request above.</p>
                  </div>
                ) : transactions?.length ? (
                  <ul className="zw-activity-list" data-testid="list-wallet-transactions">
                    {transactions.map(transaction => (
                      <li className="zw-activity" key={transaction.id} data-testid={`row-wallet-transaction-${transaction.id}`}>
                        <span className="zw-activity-icon" aria-hidden="true">
                          {transaction.creditDelta < 0 ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                        </span>
                        <span>
                          <span className="zw-activity-name" data-testid={`text-wallet-transaction-type-${transaction.id}`}>{transactionName(transaction.type)}</span>
                          <span className="zw-activity-date" data-testid={`text-wallet-transaction-date-${transaction.id}`}>{formatDate(transaction.createdAt)}</span>
                        </span>
                        <span className={`zw-activity-delta ${transaction.creditDelta < 0 ? 'negative' : ''}`} data-testid={`value-wallet-transaction-delta-${transaction.id}`}>
                          {signedAmount(transaction.creditDelta)} ZC
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="zw-empty" data-testid="status-wallet-activity-empty">
                    <span className="zw-empty-icon"><AudioLines size={15} aria-hidden="true" /></span>
                    <strong>No ledger entries yet.</strong>
                    <p>When verified wallet records exist, the latest entries will appear here. Nothing is fabricated to fill the space.</p>
                  </div>
                )}
                {wallet?.updatedAt && (
                  <div className="zw-panel-head" data-testid="text-wallet-updated-at">
                    <span className="zw-panel-meta">Wallet record updated</span>
                    <span className="zw-panel-meta">{formatDate(wallet.updatedAt)}</span>
                  </div>
                )}
              </section>

              <section className="zw-panel" aria-labelledby="zw-membership-title" data-testid="panel-wallet-membership">
                <div className="zw-panel-head">
                  <h2 className="zw-panel-title" id="zw-membership-title"><BadgeCheck size={14} aria-hidden="true" /> Membership record</h2>
                  <span className="zw-panel-meta">Server managed</span>
                </div>
                <div className="zw-membership" aria-live="polite">
                  <div className="zw-member-top">
                    <span className="zw-tier" data-testid="text-wallet-membership">{membershipLabel}</span>
                    <span className={`zw-tier-badge ${membershipIsPremium ? 'premium' : ''}`} data-testid="status-wallet-membership">
                      {membership
                        ? membership.unavailable ? 'Fail-closed · Free' : membershipIsPremium ? 'Verified record' : canManageBilling ? 'Stripe-linked record' : 'Current tier'
                        : 'Reading record'}
                    </span>
                  </div>
                  <p data-testid="text-wallet-membership-note">
                    {!membership
                      ? 'Membership is read from the server-managed account record. Until it is verified, no paid entitlement is assumed.'
                      : membership.unavailable
                        ? 'The membership record could not be verified. Access is treated as Free; no Premium entitlement is assumed.'
                        : membershipIsPremium
                          ? `Server-managed Premium record${membership.membership.accessUntil ? ` · access through ${formatDate(membership.membership.accessUntil)}` : ''}.`
                          : canManageBilling
                            ? `${membershipLabel} Stripe status. Premium access is not assumed unless an active entitlement is verified. Use Manage billing to review the subscription.`
                            : 'Free membership from the server-managed record. Paid entitlement is never assumed without a verified Stripe event.'}
                  </p>
                  <div className="zw-planned" data-testid="panel-premium-benefit">
                    <div className="zw-planned-title"><Sparkles size={12} aria-hidden="true" /> ZionCore Premium · member comparison studio</div>
                    <p>Premium unlocks a private side-by-side comparison workspace for your saved acoustic sessions. Compare dominant peaks, relative level, capture length, and notes without another AI request or credit charge. Interpretation credits remain separate.</p>
                    <Link href="/premium" className="btn btn-subtle" data-testid="link-premium-comparison">{membershipIsPremium ? 'Open Premium comparison studio' : 'Preview the Premium comparison studio'}</Link>
                  </div>
                </div>
              </section>
            </div>

          </>
        )}

        <section className="zw-service-launch" aria-labelledby="zw-service-title" data-testid="panel-customer-services">
          <div className="zw-section-head">
            <div>
              <div className="zw-section-eyebrow">Your ZionCore studio</div>
              <h2 className="zw-section-title" id="zw-service-title">Choose your next exploration.</h2>
            </div>
            <p className="zw-section-note">Open a tool directly. Review its quote and confirm any paid processing before it begins.</p>
          </div>
          <section className="zw-journey" aria-labelledby="zw-journey-title" data-testid="panel-service-recommendation">
            <div className="zw-journey-select">
              <div className="zw-journey-label"><Compass size={14} aria-hidden="true" /> Guided research selection</div>
              <h3 id="zw-journey-title">What do you want to explore today?</h3>
              <div className="zw-goal-options" role="group" aria-label="Choose an exploration goal">
                {customerServiceGoals.map(goal => (
                  <button
                    type="button"
                    key={goal}
                    className={selectedGoal === goal ? 'selected' : ''}
                    aria-pressed={selectedGoal === goal}
                    onClick={() => setSelectedGoal(goal)}
                    data-testid={`button-service-goal-${goal}`}
                  >
                    {getCustomerServiceRecommendation(goal).label}
                  </button>
                ))}
              </div>
            </div>
            <div className="zw-journey-recommendation" aria-live="polite" data-testid="panel-recommended-service">
              <span className="zw-journey-kicker">Recommended starting point</span>
              <h4>{serviceRecommendation.title}</h4>
              <p>{serviceRecommendation.summary}</p>
              <ol>
                {serviceRecommendation.steps.map((step, index) => <li key={`${selectedGoal}-${index}`}>{step}</li>)}
              </ol>
              <div className="zw-journey-actions">
                <Link href={serviceRecommendation.primary.href} className="btn btn-primary" data-testid="link-recommended-service">
                  {serviceRecommendation.primary.label} <span aria-hidden="true">→</span>
                </Link>
                {serviceRecommendation.secondary && (
                  <Link href={serviceRecommendation.secondary.href} className="btn btn-subtle" data-testid="link-recommended-secondary">
                    {serviceRecommendation.secondary.label} <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
            <p className="zw-journey-note">Recommendations are immediate and do not call an AI provider. Paid interpretation begins only after the current quote is shown and you approve it.</p>
          </section>
          <div className="zw-service-grid">
            <Link href="/" className="zw-service-card" data-testid="link-wallet-live-lab">
              <span className="zw-service-kicker">01 / Listen</span>
              <strong className="zw-service-title">Frequency lab</strong>
              <span className="zw-service-copy">Capture or import a signal, inspect its measured features, and request a reading.</span>
              <span className="zw-service-action">Open the lab <span aria-hidden="true">→</span></span>
            </Link>
            <Link href="/messages" className="zw-service-card" data-testid="link-wallet-message-studio">
              <span className="zw-service-kicker">02 / Encode</span>
              <strong className="zw-service-title">Message studio</strong>
              <span className="zw-service-copy">Create, play, export, or decode supported local acoustic message packets.</span>
              <span className="zw-service-action">Open messages <span aria-hidden="true">→</span></span>
            </Link>
            <Link href="/history" className="zw-service-card" data-testid="link-wallet-history-studio">
              <span className="zw-service-kicker">03 / Revisit</span>
              <strong className="zw-service-title">Saved history</strong>
              <span className="zw-service-copy">Return to saved observations and completed readings associated with your account.</span>
              <span className="zw-service-action">Open history <span aria-hidden="true">→</span></span>
            </Link>
            <Link href="/devices" className="zw-service-card" data-testid="link-wallet-device-centre">
              <span className="zw-service-kicker">04 / Connect</span>
              <strong className="zw-service-title">Device Centre</strong>
              <span className="zw-service-copy">Check browser capabilities and find the supported import path for your signal source.</span>
              <span className="zw-service-action">Explore devices <span aria-hidden="true">→</span></span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="zw-catalog-title">
          <div className="zw-section-head">
            <div>
              <div className="zw-section-eyebrow">Stripe catalog / verified offers</div>
              <h2 className="zw-section-title" id="zw-catalog-title">Explore credits &amp; membership.</h2>
            </div>
            <p className="zw-section-note">See current prices from Stripe, compare the available paths, and choose what fits your practice. Account access changes only after Stripe verifies payment.</p>
          </div>
          <BillingOffers
            user={user}
            firebaseReady={firebaseReady}
            projectMismatch={projectMismatch}
            showPortal={canManageBilling}
          />
        </section>

        <section className="zw-capabilities" aria-labelledby="zw-cap-title">
          <div className="zw-cap-head">
            <h2 className="zw-cap-title" id="zw-cap-title">Current capabilities and next milestones.</h2>
            <span className="zw-cap-sub">Build status / transparent by design</span>
          </div>
          <div className="zw-cap-grid" data-testid="list-wallet-feature-status">
            <article className="zw-cap-item" data-testid="status-feature-observation">
              <strong>Listen · measure · save</strong>
              <p>Explore live acoustic frequencies, review the signal, and choose which observations to keep in your personal record.</p>
            </article>
            <article className="zw-cap-item" data-testid="status-feature-ai">
              <strong>Interpret · reflect · experiment</strong>
              <p>Request a detailed ZionCore frequency reading after signing in. Gemini is the primary provider; OpenAI may receive the same derived measurement and chosen context as a fallback. The current credit quote appears before each reading; buying a pack is optional.</p>
            </article>
            <article className="zw-cap-item" data-testid="status-feature-packets">
              <strong>Local acoustic packet studio</strong>
              <p>Encode up to 512 UTF-8 bytes of text or prayer, or record a 0.25–2 second voice packet. Export WAV, play/stop, and decode supported text, prayer, and voice packets locally with CRC integrity checks.</p>
            </article>
            <article className="zw-cap-item" data-testid="status-feature-delivery">
              <strong>Next milestone · device-to-device proof</strong>
              <p>Cross-device delivery still needs receiver testing. CRC detects accidental corruption; encryption, sender authentication, and multi-packet recovery remain future engineering work.</p>
            </article>
          </div>
        </section>

        <footer className="zw-foot">
          <span>Credits are platform usage units, not cash or crypto. Prices are loaded from Stripe; payment is confirmed on the server before credits or membership change. No divine or supernatural delivery, guaranteed protection, or RF microphone detection is claimed.</span>
          <Link href="/history" data-testid="link-wallet-history">Account and sign-in options <span aria-hidden="true">→</span></Link>
        </footer>
      </div>
    </main>
  );
}
