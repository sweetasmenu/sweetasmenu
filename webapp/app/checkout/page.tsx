'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock, Check, ArrowLeft, Loader2, Tag, X,
  Building2, Upload, CheckCircle,
  AlertCircle, Banknote
} from 'lucide-react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type PaymentMethod = 'open_banking' | 'bank_transfer';
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('open_banking');

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponInfo | null>(null);
  const [couponError, setCouponError] = useState('');

  // Bank transfer states
  const [bankSlipFile, setBankSlipFile] = useState<File | null>(null);
  const [bankReference, setBankReference] = useState('');

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

  // Handle BlinkPay Open Banking checkout
  const handleOpenBankingCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const origin = window.location.origin;

      const response = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_email: user.email,
          plan_id: planId,
          interval: billingInterval,
          redirect_url: `${origin}/checkout/success?plan=${planId}&interval=${billingInterval}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create billing session');
      }

      const data = await response.json();

      if (data.redirect_uri) {
        // Save consent_id for verification on return
        localStorage.setItem('pending_consent_id', data.consent_id);
        localStorage.setItem('pending_plan_id', planId);
        localStorage.setItem('pending_interval', billingInterval);
        // Redirect to bank login
        window.location.href = data.redirect_uri;
      } else {
        throw new Error('No redirect URL returned');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout process');
      setLoading(false);
    }
  };

  // Handle Bank Transfer
  const handleBankTransfer = async () => {
    if (!bankSlipFile) {
      setError('Please upload your payment slip');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload slip to Supabase storage
      const fileName = `payment-slips/${user.id}/${Date.now()}-${bankSlipFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(fileName, bankSlipFile);

      if (uploadError) {
        throw new Error('Failed to upload payment slip');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-slips')
        .getPublicUrl(fileName);

      // Submit bank transfer payment
      const response = await fetch(`${API_URL}/api/payments/bank-transfer/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          plan: planId,
          amount: finalPrice,
          billing_interval: billingInterval,
          bank_transfer_slip_url: publicUrl,
          bank_transfer_reference: bankReference,
          coupon_code: appliedCoupon?.code || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/checkout/success?method=bank_transfer');
      } else {
        throw new Error(data.error || 'Failed to submit payment');
      }
    } catch (err: any) {
      console.error('Bank transfer error:', err);
      setError(err.message || 'Failed to submit bank transfer');
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    if (!user) {
      router.push('/login?redirect=/checkout?plan=' + planId + '&interval=' + billingInterval);
      return;
    }

    if (paymentMethod === 'bank_transfer') {
      handleBankTransfer();
    } else {
      handleOpenBankingCheckout();
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

            {/* Payment Method Selection */}
            <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
              <div className="space-y-3">
                {/* Open Banking (BlinkPay) */}
                <button
                  onClick={() => setPaymentMethod('open_banking')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    paymentMethod === 'open_banking'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        paymentMethod === 'open_banking' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Banknote className={`w-5 h-5 ${
                          paymentMethod === 'open_banking' ? 'text-blue-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Pay via Bank (Open Banking)</p>
                        <p className="text-sm text-gray-500">Secure direct bank payment - Instant</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
                      Recommended
                    </div>
                  </div>
                </button>

                {/* Bank Transfer */}
                <button
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      paymentMethod === 'bank_transfer' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-5 h-5 ${
                        paymentMethod === 'bank_transfer' ? 'text-green-600' : 'text-gray-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Bank Transfer</p>
                      <p className="text-sm text-gray-500">Direct bank payment - Manual verification (1-2 days)</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Bank Transfer Details */}
              {paymentMethod === 'bank_transfer' && (
                <div className="mt-6 space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h3 className="font-semibold text-green-800 mb-3">Bank Account Details</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-gray-600">Bank:</span> <span className="font-medium">ANZ New Zealand</span></p>
                      <p><span className="text-gray-600">Account Name:</span> <span className="font-medium">Smart Menu NZ Ltd</span></p>
                      <p><span className="text-gray-600">Account Number:</span> <span className="font-medium font-mono">06-0123-0456789-00</span></p>
                      <p><span className="text-gray-600">Reference:</span> <span className="font-medium">{user.email}</span></p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Payment Slip *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-green-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setBankSlipFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="slip-upload"
                      />
                      <label htmlFor="slip-upload" className="cursor-pointer">
                        {bankSlipFile ? (
                          <div className="flex items-center justify-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <span>{bankSlipFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <p>Click to upload payment slip</p>
                            <p className="text-xs">PNG, JPG, PDF up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transfer Reference (optional)
                    </label>
                    <input
                      type="text"
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder="e.g. Transaction ID"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold">Processing Time</p>
                        <p>Bank transfers are verified within 1-2 business days. Your subscription will be activated once payment is confirmed.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                disabled={loading || (paymentMethod === 'bank_transfer' && !bankSlipFile)}
                className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg ${
                  paymentMethod === 'bank_transfer'
                    ? 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing...
                  </>
                ) : paymentMethod === 'open_banking' ? (
                  <>
                    <Banknote className="w-6 h-6" />
                    Pay via Bank
                  </>
                ) : (
                  <>
                    <Building2 className="w-6 h-6" />
                    Submit Bank Transfer
                  </>
                )}
              </button>

              {/* Security Badge */}
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Lock className="w-4 h-4" />
                <span>Secure payment - SSL encrypted</span>
              </div>

              {/* Features */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">What's included:</p>
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
