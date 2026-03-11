'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock, LogIn, LogOut, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function StaffAttendancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const restaurantId = params.restaurant_id as string;
  const token = searchParams.get('token') || '';

  const [restaurantName, setRestaurantName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch restaurant name
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/menu/${restaurantId}`);
        if (res.ok) {
          const data = await res.json();
          setRestaurantName(data.restaurant?.name || 'Restaurant');
        }
      } catch (e) {
        console.error('Failed to fetch restaurant:', e);
      } finally {
        setPageLoading(false);
      }
    };
    if (restaurantId) fetchRestaurant();
  }, [restaurantId]);

  const handleAction = async (action: 'clock-in' | 'clock-out') => {
    if (pin.length !== 6) {
      setResult({ type: 'error', message: 'Please enter your 6-digit PIN' });
      return;
    }
    if (!token) {
      setResult({ type: 'error', message: 'Invalid QR code. Please scan a fresh QR code from your restaurant.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/staff/attendance/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          pin_code: pin,
          token,
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.already_clocked_in) {
          setResult({
            type: 'warning',
            message: `${data.staff_name} is already clocked in today.`,
          });
        } else if (data.not_clocked_in) {
          setResult({
            type: 'warning',
            message: `${data.staff_name} hasn't clocked in yet today.`,
          });
        } else {
          const timeStr = new Date().toLocaleTimeString('en-NZ', {
            hour: '2-digit',
            minute: '2-digit',
          });
          setResult({
            type: 'success',
            message:
              action === 'clock-in'
                ? `Welcome, ${data.staff_name}! Clocked in at ${timeStr}`
                : `Goodbye, ${data.staff_name}! Clocked out at ${timeStr} (${data.duration_minutes} min)`,
          });
        }
      } else {
        setResult({
          type: 'error',
          message: data.detail || 'Failed. Please try again.',
        });
      }
    } catch (e) {
      setResult({ type: 'error', message: 'Connection error. Please try again.' });
    } finally {
      setLoading(false);
      setPin('');
      pinInputRef.current?.focus();
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-sm text-gray-500">
            This link has expired or is invalid. Please scan the QR code displayed in your restaurant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{restaurantName}</h1>
          <p className="text-sm text-gray-500 mt-1">Staff Attendance</p>
        </div>

        {/* Live Clock */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3">
            <Clock className="w-5 h-5 text-gray-500" />
            <span className="text-2xl font-mono font-semibold text-gray-900">
              {currentTime.toLocaleTimeString('en-NZ', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {currentTime.toLocaleDateString('en-NZ', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* PIN Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
            Enter your 6-digit PIN
          </label>
          <input
            ref={pinInputRef}
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-colors text-gray-900"
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleAction('clock-in')}
            disabled={loading || pin.length !== 6}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            Clock In
          </button>
          <button
            onClick={() => handleAction('clock-out')}
            disabled={loading || pin.length !== 6}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
            Clock Out
          </button>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl ${
              result.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : result.type === 'warning'
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {result.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : result.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                result.type === 'success'
                  ? 'text-green-700'
                  : result.type === 'warning'
                  ? 'text-amber-700'
                  : 'text-red-700'
              }`}
            >
              {result.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
