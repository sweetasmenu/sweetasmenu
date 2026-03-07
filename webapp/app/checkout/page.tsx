'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock, Check, ArrowLeft, Loader2, Tag, X,
  CreditCard, CheckCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type BillingInterval = 'monthly' | 'yearly';

interface CouponInfo {
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  discount_amount: number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') || 'pro';
  const initialInterval = (searchParams.get('interval') as BillingInterval) || 'monthly';

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  // Form states
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(initialInterval);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponInfo | null>(null);
  const [couponError, setCouponError] = useState('');

  const supabase = createClient();
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[1];

  // Calculate prices
  const monthlyPrice = plan.price;
  const yearlyPrice = Math.round(plan.price * 12 * 0.9); // 10% discount
  const yearlyMonthlyEquivalent = Math.round(yearlyPrice / 12);

  const basePrice = billingInterval === 'yearly' ? yearlyPrice : monthlyPrice;
  const discountAmount = appliedCoupon?.discount_amount || 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const savings = billingInterval === 'yearly' ? Math.round(plan.price * 12 * 0.1) : 0;

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/checkout?plan=' + planId + '&interval=' + billingInterval);
        return;
      }

      setUser(session.user);
    };

    checkUser();
  }, []);

  // Apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      const response = await fetch(`${API_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          plan_id: planId,
          amount: basePrice
        })
      });

      const data = await response.json();

      if (data.valid) {
        setAppliedCoupon({
          code: couponCode.toUpperCase(),
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          discount_amount: data.discount_amount
        });
        setCouponError('');
      } else {
        setCouponError(data.message || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError('Failed to validate coupon');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Handle Stripe Checkout
  const handleCheckout = async () => {
    if (!user) {
      router.push('/login?redirect=/checkout?plan=' + planId + '&interval=' + billingInterval);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const origin = window.location.origin;

      const response = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_email: user.email,
          plan_id: planId,
          interval: billingInterval,
          success_url: `${origin}/checkout/success`,
          cancel_url: `${origin}/checkout?plan=${planId}&interval=${billingInterval}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout process');
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Link
          href="/pricing"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 sm:mb-8 transition-colors text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pricing
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          Complete Your Subscription
        </h1>

        <div className="grid lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Left Column - Options */}
          <div className="lg:col-span-3 space-y-6">
            {/* Billing Interval Selection */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Billing Period</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    billingInterval === 'monthly'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">Monthly</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                    ${monthlyPrice}
                    <span className="text-xs sm:text-sm font-normal text-gray-500">/mo</span>
                  </p>
                </button>
                <button
                  onClick={() => setBillingInterval('yearly')}
                  className={`p-3 sm:p-4 rounded-xl border-2 transition-all relative ${
                    billingInterval === 'yearly'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    SAVE 10%
                  </span>
                  <p className="font-semibold text-gray-900">Yearly</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                    ${yearlyMonthlyEquivalent}
                    <span className="text-xs sm:text-sm font-normal text-gray-500">/mo</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    ${yearlyPrice}/year (Save ${savings})
                  </p>
                </button>
              </div>
            </div>

            {/* Payment Method Info */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
              <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Credit / Debit Card</p>
                  <p className="text-sm text-gray-500">Secure payment via Stripe</p>
                </div>
              </div>
            </div>

            {/* Coupon Code */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Coupon Code
              </h2>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">{appliedCoupon.code}</p>
                      <p className="text-sm text-green-600">
                        {appliedCoupon.discount_type === 'percentage'
                          ? `${appliedCoupon.discount_value}% off`
                          : `$${appliedCoupon.discount_value} off`
                        } - Save ${appliedCoupon.discount_amount.toFixed(2)} NZD
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-green-600" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 min-w-0 px-3 sm:px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none uppercase text-sm sm:text-base"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 sm:px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm sm:text-base flex-shrink-0"
                  >
                    {couponLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="mt-2 text-sm text-red-600">{couponError}</p>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 sticky top-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

              {/* Plan Info */}
              <div className="pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name} Plan</p>
                    <p className="text-sm text-gray-500">
                      {billingInterval === 'yearly' ? 'Annual billing' : 'Monthly billing'}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900">
                    ${basePrice} NZD
                  </p>
                </div>

                {billingInterval === 'yearly' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-700">
                    You save ${savings} NZD/year with annual billing
                  </div>
                )}
              </div>

              {/* Coupon Discount */}
              {appliedCoupon && (
                <div className="py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between text-green-600">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>-${appliedCoupon.discount_amount.toFixed(2)} NZD</span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="py-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-orange-500">
                    ${finalPrice.toFixed(2)} NZD
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {billingInterval === 'yearly'
                    ? `Billed annually (${yearlyMonthlyEquivalent}/mo)`
                    : 'Billed monthly'
                  }
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Redirecting to Stripe...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-6 h-6" />
                    Subscribe Now
                  </>
                )}
              </button>

              {/* Security Badge */}
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Lock className="w-4 h-4" />
                <span>Secure payment powered by Stripe</span>
              </div>

              {/* Features */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">What&apos;s included:</p>
                <ul className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">
                        {feature.replace(/^[✅❌⚠️]\s*/, '')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Money Back */}
              <div className="mt-4 text-center text-sm text-gray-500">
                30-day money-back guarantee
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
