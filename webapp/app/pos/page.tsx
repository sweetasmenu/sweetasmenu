'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function POSRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if there's a saved session
    const savedSession = localStorage.getItem('pos_session');

    if (savedSession) {
      const session = JSON.parse(savedSession);
      if (session.expires > Date.now()) {
        // Session still valid, redirect based on role
        if (session.role === 'chef') {
          router.replace('/pos/kitchen');
        } else {
          router.replace('/pos/orders');
        }
        return;
      } else {
        // Session expired
        localStorage.removeItem('pos_session');
      }
    }

    // No valid session, redirect to login
    router.replace('/pos/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-white text-lg">Loading POS System...</p>
      </div>
    </div>
  );
}
