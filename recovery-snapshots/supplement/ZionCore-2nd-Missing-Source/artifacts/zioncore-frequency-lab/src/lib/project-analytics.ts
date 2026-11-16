export type AnalyticsData = Record<string, string | number | boolean>;
export type SignupMethod = 'email_password' | 'google' | 'apple';
export type GuideCtaPlacement = 'hero' | 'closing';
export type GuideCtaDestination = 'live_lab' | 'guide_index' | 'signup' | 'plans';

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics is optional and must never interrupt the user flow.
  }
}

export function trackGuideArticleOpen(topic: string): void {
  trackEvent('guide_article_open', { route: 'discover', topic, action: 'open' });
}

export function trackGuideCtaClick(
  placement: GuideCtaPlacement,
  destination: GuideCtaDestination,
): void {
  trackEvent('guide_cta_click', { route: 'discover', action: 'click', placement, destination });
}

export function trackSignupSuccess(method: SignupMethod): void {
  trackEvent('signup_success', { outcome: 'success', method });
}
