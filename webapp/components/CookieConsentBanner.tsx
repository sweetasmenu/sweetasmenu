'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import {
  setCookieConsent,
  hasConsentBeenGiven,
} from '@/lib/utils/cookieConsent';

function CategoryToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>
          {label}
          {disabled && (
            <span className="ml-2 text-xs text-gray-400 font-normal">(Always on)</span>
          )}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
          disabled
            ? 'bg-gray-200 cursor-not-allowed'
            : checked
              ? 'bg-amber-600 cursor-pointer'
              : 'bg-gray-300 cursor-pointer'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasConsentBeenGiven()) {
        setIsVisible(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptAll = () => {
    setCookieConsent({ analytics: true, marketing: true });
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    setCookieConsent({ analytics, marketing });
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    setCookieConsent({ analytics: false, marketing: false });
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up"
      style={{
        animation: 'cookie-slide-up 0.5s ease-out forwards',
      }}
    >
      <style jsx global>{`
        @keyframes cookie-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-5">
          {/* Main Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                We use cookies to improve your experience on our platform.{' '}
                <Link href="/privacy" className="text-amber-600 hover:text-amber-700 underline">
                  Learn more
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showPreferences ? 'Hide' : 'Manage'}
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="space-y-3">
                <CategoryToggle
                  label="Essential"
                  description="Required for authentication and core functionality. Cannot be disabled."
                  checked={true}
                  disabled={true}
                  onChange={() => {}}
                />
                <CategoryToggle
                  label="Analytics"
                  description="Help us understand how you use our platform so we can improve it."
                  checked={analytics}
                  disabled={false}
                  onChange={setAnalytics}
                />
                <CategoryToggle
                  label="Marketing"
                  description="Allow personalised ads and tracking (e.g., Facebook Pixel)."
                  checked={marketing}
                  disabled={false}
                  onChange={setMarketing}
                />
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={handleRejectAll}
                  className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
                >
                  Reject All
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-5 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
