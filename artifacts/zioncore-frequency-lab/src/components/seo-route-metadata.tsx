import { useEffect } from 'react';
import { useLocation } from 'wouter';

const siteUrl = 'https://zioncore.replit.app';
const socialImage = `${siteUrl}/og-zioncore.jpg`;

type RouteMetadata = {
  title: string;
  description: string;
  canonicalPath?: string;
  indexable: boolean;
};

const routeMetadata: Record<string, RouteMetadata> = {
  '/': {
    title: 'ZionCore Frequency Intelligence | Universal Language',
    description: 'Explore sound-frequency analysis, environmental audio, acoustic messaging, and personal spiritual reflection with ZionCore’s browser-based frequency intelligence tools.',
    canonicalPath: '/',
    indexable: true,
  },
  '/discover': {
    title: 'Frequency, Sound & Signal Field Guide | ZionCore',
    description: 'Explore practical guides to frequency analysis, FFT, acoustic patterns, sound communication, and personal spiritual reflection with ZionCore.',
    canonicalPath: '/discover',
    indexable: true,
  },
  '/wallet': {
    title: 'ZionCore Plans and Interpretation Credits',
    description: 'Compare ZionCore membership and interpretation credit options. Explore the frequency lab and choose the plan that fits your listening practice.',
    canonicalPath: '/wallet',
    indexable: true,
  },
  '/messages': {
    title: 'Acoustic Message Encoder | ZionCore',
    description: 'Encode short text or prayer into a sound packet and decode it with a nearby compatible device using ZionCore Frequency Messenger.',
    indexable: false,
  },
  '/devices': {
    title: 'Universal Frequency Device Centre | ZionCore',
    description: 'Connect microphones, inspect high-rate WAV recordings, analyze vibration CSV and receive-only SDR IQ files with ZionCore’s local device adapter tools.',
    canonicalPath: '/devices',
    indexable: true,
  },
  '/cards': {
    title: 'Private Signal Card Collection | ZionCore',
    description: 'Reopen, edit, and locally export your saved ZionCore Signal Cards. Private by default, with no extra interpretation charge.',
    indexable: false,
  },
  '/admin': {
    title: 'ZionCore Administrator Console',
    description: 'Private, restricted operations and service-status console for ZionCore administrators.',
    indexable: false,
  },
  '/owner': {
    title: 'ZionCore Administrator Console',
    description: 'Private, restricted operations and service-status console for ZionCore administrators.',
    indexable: false,
  },
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

function setCanonical(path: string | undefined) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!path) {
    existing?.remove();
    return;
  }
  const canonical = existing ?? document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = `${siteUrl}${path}`;
  if (!existing) document.head.append(canonical);
}

export default function SeoRouteMetadata() {
  const [location] = useLocation();
  const path = location.split('?')[0].replace(/\/+$/, '') || '/';

  useEffect(() => {
    const isHistory = path === '/history' || path.startsWith('/history/');
    const metadata = routeMetadata[path] ?? {
      title: 'ZionCore Frequency Intelligence',
      description: 'Explore sound-frequency analysis, acoustic messaging, and personal spiritual audio reflection with ZionCore.',
      indexable: false,
    };
    const robots = metadata.indexable && !isHistory ? 'index, follow' : 'noindex, follow';

    document.title = metadata.title;
    upsertMeta('name', 'description', metadata.description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:title', metadata.title);
    upsertMeta('property', 'og:description', metadata.description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'ZionCore');
    upsertMeta('property', 'og:locale', 'en_GB');
    upsertMeta('property', 'og:url', `${siteUrl}${metadata.canonicalPath ?? path}`);
    upsertMeta('property', 'og:image', socialImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', metadata.title);
    upsertMeta('name', 'twitter:description', metadata.description);
    upsertMeta('name', 'twitter:image', socialImage);
    setCanonical(metadata.canonicalPath);
  }, [path]);

  return null;
}
