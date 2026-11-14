import { useEffect } from 'react';
import { useLocation } from 'wouter';

/** Restore useful SPA navigation and wait for lazy routes before resolving hashes. */
export default function NavigationEffects() {
  const [location] = useLocation();
  useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const setHeaderInset = () => {
      const height = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 76;
      document.documentElement.style.setProperty('--navigation-inset', `${Math.ceil(height) + 16}px`);
    };
    const scrollToHash = (smooth: boolean) => {
      observer?.disconnect();
      if (timeout) clearTimeout(timeout);
      const hash = window.location.hash;
      if (!hash || hash === '#') return;
      let id: string;
      try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
      const findAndScroll = () => {
        const target = document.getElementById(id);
        if (!target) return false;
        setHeaderInset();
        target.scrollIntoView({
          block: 'start',
          behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant',
        });
        observer?.disconnect();
        if (timeout) clearTimeout(timeout);
        return true;
      };
      if (findAndScroll()) return;
      observer = new MutationObserver(findAndScroll);
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = setTimeout(() => observer?.disconnect(), 5_000);
    };
    const onHashChange = () => scrollToHash(true);
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.hash) {
        // Avoid a native instant jump before our smooth, header-aware scroll.
        event.preventDefault();
        if (window.location.hash !== destination.hash) {
          window.history.pushState(window.history.state, '', destination.pathname + destination.search + destination.hash);
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => scrollToHash(true));
      }
    };
    setHeaderInset();
    frame = requestAnimationFrame(() => {
      if (window.location.hash) scrollToHash(false);
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('resize', setHeaderInset, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('resize', setHeaderInset);
    };
  }, [location]);
  return null;
}
