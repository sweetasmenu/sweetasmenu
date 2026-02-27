export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_KEY = 'cookie_consent';
const CONSENT_VERSION = '1.0';

/**
 * Get the current cookie consent from localStorage.
 * Returns null if user has not yet made a choice.
 */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    const parsed: CookieConsent = JSON.parse(stored);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save cookie consent preferences to localStorage.
 */
export function setCookieConsent(consent: { analytics: boolean; marketing: boolean }): void {
  if (typeof window === 'undefined') return;
  const fullConsent: CookieConsent = {
    essential: true,
    analytics: consent.analytics,
    marketing: consent.marketing,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(fullConsent));
}

/**
 * Check if user has given consent for a specific cookie category.
 * Use this before loading third-party scripts (e.g., Facebook Pixel).
 *
 * Example:
 *   if (hasConsent('marketing')) { loadFacebookPixel(); }
 */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'essential') return true;
  const consent = getCookieConsent();
  if (!consent) return false;
  return consent[category] === true;
}

/**
 * Check if user has made any consent choice at all.
 */
export function hasConsentBeenGiven(): boolean {
  return getCookieConsent() !== null;
}
