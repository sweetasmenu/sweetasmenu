'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Building2, Loader2, CheckCircle, AlertCircle, ArrowLeft, QrCode, Upload, Copy, Check, Banknote } from 'lucide-react';
import Link from 'next/link';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe/config';
import QRCode from 'react-qr-code';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface OrderItem {
  id: string;
  name: string;
  nameEn?: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  restaurant_id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total_price: number;
  delivery_fee?: number;
  surcharge_amount?: number;
  food_surcharge_amount?: number;
  food_surcharge_name?: string;
  service_type: 'dine_in' | 'pickup' | 'delivery';
  table_no?: string;
  customer_name?: string;
  status: string;
  payment_status: string;
}

interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
}

interface PaymentSettings {
  accept_card: boolean;
  accept_bank_transfer: boolean;
  accept_qr_code?: boolean;  // Show QR code for bank transfer
  accept_pay_at_cashier?: boolean;  // Pay at cashier for dine-in and pickup
  bank_accounts: BankAccount[];
}

interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  payment_settings?: PaymentSettings;
}

// Stripe Payment Form Component
function StripePaymentForm({
  clientSecret,
  orderId,
  onSuccess
}: {
  clientSecret: string;
  orderId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/${orderId}/success`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      // Confirm payment on backend - update order status from pending_payment to pending
      try {
        const confirmResponse = await fetch(`${API_URL}/api/payments/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_intent_id: paymentIntent.id,
            order_id: orderId,
          }),
        });

        const confirmData = await confirmResponse.json();
        console.log('Payment confirmation response:', confirmData);

        if (confirmData.success && confirmData.paid) {
          console.log('Order status updated to pending - should appear in POS');
          onSuccess();
        } else {
          // Backend confirmation failed, but payment succeeded
          // Still show success to customer but log the error
          console.error('Backend confirmation failed:', confirmData);
          onSuccess();
        }
      } catch (err) {
        console.error('Failed to confirm payment on backend:', err);
        // Payment succeeded with Stripe, try to manually update order status
        try {
          await fetch(`${API_URL}/api/orders/${orderId}/confirm-paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (retryErr) {
          console.error('Retry also failed:', retryErr);
        }
        onSuccess(); // Still proceed to success since Stripe payment worked
      }
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      // 3D Secure or other action required - Stripe handles this automatically
      // If we reach here, the action failed or was cancelled
      setError('Payment requires additional verification. Please try again.');
      setProcessing(false);
    } else {
      // Unknown status - reset processing state
      console.error('Unexpected payment status:', paymentIntent?.status);
      setError('Payment could not be completed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-base sm:text-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay Now
          </>
        )}
      </button>
    </form>
  );
}

// Bank Transfer Component
function BankTransferPayment({
  order,
  bankAccounts,
  onSlipUpload,
  showQrCode = true,
}: {
  order: Order;
  bankAccounts: BankAccount[];
  onSlipUpload: (slip: File) => void;
  showQrCode?: boolean;
}) {
  const [selectedBank, setSelectedBank] = useState(0);
  const [copied, setCopied] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const currentBank = bankAccounts[selectedBank];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!slipFile) return;
    setUploading(true);
    await onSlipUpload(slipFile);
    setUploading(false);
  };

  // Generate QR code data (simplified - just the account number)
  const qrData = `Bank: ${currentBank.bank_name}\nAccount: ${currentBank.account_number}\nName: ${currentBank.account_name}\nAmount: $${order.total_price.toFixed(2)} NZD\nRef: Order ${order.id.slice(0, 8)}`;

  return (
    <div className="space-y-6">
      {/* Bank Selection */}
      {bankAccounts.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Bank Account
          </label>
          <div className="flex flex-wrap gap-2">
            {bankAccounts.map((bank, index) => (
              <button
                key={index}
                onClick={() => setSelectedBank(index)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  selectedBank === index
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {bank.bank_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code - Only show if enabled */}
      {showQrCode && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 text-center">
          <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Scan to Pay</h4>
          <div className="bg-white p-3 sm:p-4 inline-block rounded-lg shadow-inner">
            <QRCode value={qrData} size={140} />
          </div>
          <p className="text-xs sm:text-sm text-gray-700 mt-2">
            Scan with your mobile banking app
          </p>
        </div>
      )}

      {/* Bank Details */}
      <div className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Bank Details</h4>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-800">Bank</p>
            <p className="font-medium text-gray-900">{currentBank.bank_name}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-800">Account Name</p>
            <p className="font-medium text-gray-900">{currentBank.account_name}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-800">Account Number</p>
            <p className="font-mono font-medium text-gray-900">{currentBank.account_number}</p>
          </div>
          <button
            onClick={() => copyToClipboard(currentBank.account_number)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-800">Amount</p>
            <p className="text-xl font-bold text-green-600">${order.total_price.toFixed(2)} NZD</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-800">Reference</p>
            <p className="font-mono text-gray-900">Order {order.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={() => copyToClipboard(`Order ${order.id.slice(0, 8)}`)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Copy className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Upload Slip */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
        <h4 className="font-semibold text-blue-900 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
          <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
          Upload Payment Slip
          <span className="text-red-500">*</span>
        </h4>
        <p className="text-xs sm:text-sm text-blue-700 mb-2 sm:mb-3">
          Please upload your transfer receipt for verification
        </p>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="slip-upload"
        />

        {slipPreview ? (
          <div className="space-y-3">
            <img
              src={slipPreview}
              alt="Payment slip"
              className="max-w-full max-h-48 mx-auto rounded-lg shadow"
            />
            {/* Change Image Button */}
            <label
              htmlFor="slip-upload"
              className="block w-full py-2 border border-blue-300 bg-white text-blue-600 rounded-lg text-center cursor-pointer hover:bg-blue-50 transition-colors text-sm font-medium"
            >
              Change Image
            </label>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Submit Slip
                </>
              )}
            </button>
          </div>
        ) : (
          <label
            htmlFor="slip-upload"
            className="block w-full py-4 border-2 border-dashed border-blue-300 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors"
          >
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-blue-600">Click to upload slip</p>
          </label>
        )}
      </div>

      {/* Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Your order will be processed once the payment is verified by the restaurant staff.
        </p>
      </div>
    </div>
  );
}

// Main Payment Page
export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = params.order_id as string;

  // Get language and restaurant from query params (passed from restaurant menu page)
  const selectedLanguage = searchParams.get('lang') || 'en';
  const restaurantSlug = searchParams.get('restaurant') || '';

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'bank_transfer' | 'cash_at_cashier' | null>(null);
  const [processingCashPayment, setProcessingCashPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  // Surcharge confirmation popup
  const [showSurchargeConfirm, setShowSurchargeConfirm] = useState(false);

  // Surcharge settings for card payments
  const [surchargeSettings, setSurchargeSettings] = useState({
    credit_card_surcharge_enabled: false,
    credit_card_surcharge_rate: 0
  });

  // Translated item names for customer's selected language
  const [translatedItemNames, setTranslatedItemNames] = useState<Record<string, string>>({});

  // Translate item names to the customer's selected language
  const translateItemNames = useCallback(async (items: OrderItem[]) => {
    // English: use nameEn directly, no API call needed
    if (selectedLanguage === 'en' || selectedLanguage === 'original') return;

    const textsToTranslate: { key: string; text: string }[] = [];
    items.forEach((item, idx) => {
      const key = `item_${idx}`;
      if (item.name && !translatedItemNames[key]) {
        textsToTranslate.push({ key, text: item.name });
      }
    });

    if (textsToTranslate.length === 0) return;

    try {
      const response = await fetch(`${API_URL}/api/translate/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: textsToTranslate.map(t => t.text),
          source_lang: 'auto',
          target_lang: selectedLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translations) {
          const newTranslations: Record<string, string> = {};
          textsToTranslate.forEach((t, i) => {
            if (data.translations[i]) {
              newTranslations[t.key] = data.translations[i];
            }
          });
          setTranslatedItemNames(prev => ({ ...prev, ...newTranslations }));
        }
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  }, [selectedLanguage, translatedItemNames]);

  // Get display name for an item based on selected language
  const getItemDisplayName = (item: OrderItem, idx: number) => {
    if (selectedLanguage === 'en') {
      return item.nameEn || item.name;
    }
    if (selectedLanguage === 'original') {
      return item.name;
    }
    // Other languages: use translated name, fall back to original
    return translatedItemNames[`item_${idx}`] || item.name;
  };

  // Calculate surcharge amount (only applies to card payments)
  const getSurchargeAmount = () => {
    if (selectedMethod !== 'card' || !surchargeSettings.credit_card_surcharge_enabled) {
      return 0;
    }
    // Surcharge is calculated on the base amount (subtotal + delivery_fee)
    const baseAmount = order ? order.subtotal + (order.delivery_fee || 0) : 0;
    return Math.round(baseAmount * surchargeSettings.credit_card_surcharge_rate) / 100;
  };

  // Get final total with surcharge for card payments
  // Uses order.total_price which already includes subtotal + delivery_fee + food_surcharge (GST inclusive)
  const getFinalTotal = () => {
    if (!order) return 0;
    return order.total_price + getSurchargeAmount();
  };

  // Translate item names when order is loaded
  useEffect(() => {
    if (order?.items) {
      translateItemNames(order.items);
    }
  }, [order, translateItemNames]);

  // Fetch order and payment settings
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch order
        const orderRes = await fetch(`${API_URL}/api/orders/${orderId}`);
        const orderData = await orderRes.json();

        if (!orderData.success || !orderData.order) {
          setError('Order not found');
          setLoading(false);
          return;
        }

        const orderInfo = orderData.order;
        setOrder(orderInfo);

        // Check if already paid or verifying payment
        if (orderInfo.payment_status === 'paid' || orderInfo.status === 'verifying_payment') {
          setPaymentSuccess(true);
          setLoading(false);
          return;
        }

        // Fetch payment settings
        const settingsRes = await fetch(`${API_URL}/api/restaurant/${orderInfo.restaurant_id}/payment-settings`);
        const settingsData = await settingsRes.json();

        if (settingsData.success) {
          setPaymentSettings(settingsData.payment_settings);

          // Load restaurant's Stripe publishable key for card payments
          if (settingsData.stripe_publishable_key) {
            setStripePromise(loadStripe(settingsData.stripe_publishable_key));
          } else {
            // Fallback to platform key
            setStripePromise(getStripe());
          }

          // Auto-select if only one method available
          if (settingsData.payment_settings.accept_card && !settingsData.payment_settings.accept_bank_transfer) {
            setSelectedMethod('card');
          } else if (!settingsData.payment_settings.accept_card && settingsData.payment_settings.accept_bank_transfer) {
            setSelectedMethod('bank_transfer');
          }
        }

        // Fetch restaurant info
        const restaurantRes = await fetch(`${API_URL}/api/restaurant/${orderInfo.restaurant_id}`);
        const restaurantData = await restaurantRes.json();
        if (restaurantData.success) {
          setRestaurant(restaurantData.restaurant);
        }

        // Fetch surcharge settings
        try {
          const surchargeRes = await fetch(`${API_URL}/api/restaurant/${orderInfo.restaurant_id}/surcharge-settings`);
          if (surchargeRes.ok) {
            const surchargeData = await surchargeRes.json();
            if (surchargeData.success) {
              setSurchargeSettings({
                credit_card_surcharge_enabled: surchargeData.credit_card_surcharge_enabled || false,
                credit_card_surcharge_rate: surchargeData.credit_card_surcharge_rate || 0
              });
            }
          }
        } catch (err) {
          console.log('Could not fetch surcharge settings:', err);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching payment data:', err);
        setError('Failed to load payment information');
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  // Create payment intent when card is selected
  useEffect(() => {
    const createIntent = async () => {
      if (selectedMethod === 'card' && order && !clientSecret) {
        try {
          // Calculate final amount including surcharge for card payments
          const finalAmount = getFinalTotal();
          const surchargeAmount = getSurchargeAmount();

          const response = await fetch(`${API_URL}/api/payments/create-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: order.id,
              amount: finalAmount,
              currency: 'nzd',
              restaurant_id: order.restaurant_id,
              surcharge_amount: surchargeAmount, // Include surcharge for card payments
            }),
          });

          const data = await response.json();
          if (data.success) {
            setClientSecret(data.client_secret);
          } else {
            setError(data.detail || 'Failed to initialize payment');
          }
        } catch (err) {
          console.error('Error creating payment intent:', err);
          setError('Failed to initialize payment');
        }
      }
    };

    createIntent();
  }, [selectedMethod, order, clientSecret]);

  // Handle slip upload
  const handleSlipUpload = async (file: File) => {
    if (!order) return;

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];

        const response = await fetch(`${API_URL}/api/payments/upload-slip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            slip_image_base64: base64,
          }),
        });

        const data = await response.json();
        if (data.success) {
          // Redirect to order status page with language and restaurant params
          const statusParams = new URLSearchParams();
          statusParams.set('lang', selectedLanguage);
          statusParams.set('restaurant', restaurantSlug || order.restaurant_id);
          router.push(`/order-status/${order.id}?${statusParams.toString()}`);
        } else {
          setError(data.detail || 'Failed to upload slip');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading slip:', err);
      setError('Failed to upload slip');
    }
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
  };

  // Handle Pay at Cashier selection
  const handlePayAtCashier = async () => {
    if (!order) return;

    setProcessingCashPayment(true);
    setError(null);

    try {
      // Update order to set payment method to cash_at_cashier (status stays pending_payment until staff confirms)
      const response = await fetch(`${API_URL}/api/orders/${order.id}/pay-at-cashier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: 'cash_at_cashier',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to restaurant menu so customer can check My Orders
        const menuUrl = `/restaurant/${restaurantSlug || order.restaurant_id}`;
        router.push(menuUrl);
      } else {
        setError(data.detail || 'Failed to confirm order');
      }
    } catch (err) {
      console.error('Error confirming pay at cashier:', err);
      setError('Failed to confirm order. Please try again.');
    } finally {
      setProcessingCashPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-800">Loading payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const menuUrl = `/restaurant/${restaurantSlug || restaurant?.slug || order?.restaurant_id || ''}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-800 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setError(null)}
              className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
            >
              Try Again
            </button>
            <Link
              href={menuUrl}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Back to Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    const statusParams = new URLSearchParams();
    statusParams.set('lang', selectedLanguage);
    statusParams.set('restaurant', restaurantSlug || restaurant?.slug || order?.restaurant_id || '');
    const orderTrackingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/order-status/${order?.id}?${statusParams.toString()}`;
    const menuUrl = `/restaurant/${restaurantSlug || restaurant?.slug || order?.restaurant_id}`;

    // Save order ID to localStorage for order history
    if (typeof window !== 'undefined' && order?.id) {
      const existingOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
      if (!existingOrders.includes(order.id)) {
        existingOrders.unshift(order.id);
        // Keep only last 20 orders
        localStorage.setItem('my_orders', JSON.stringify(existingOrders.slice(0, 20)));
      }
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-3 sm:p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-5 sm:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 animate-bounce">
            <CheckCircle className="w-9 h-9 sm:w-12 sm:h-12 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-sm sm:text-base text-gray-800 mb-3 sm:mb-4">
            Your payment is being verified. Your order will be sent to the kitchen shortly.
          </p>

          {/* Order Number */}
          <div className="bg-gray-100 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-gray-800 mb-1">Order Number</p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-gray-900">
              #{order?.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-green-600 mt-1 sm:mt-2">Estimated time: 15-30 minutes</p>
          </div>

          {/* QR Code for order tracking */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-gray-800 mb-2 sm:mb-3">Scan to track your order</p>
            <div className="flex justify-center">
              <QRCode value={orderTrackingUrl} size={120} />
            </div>
            <p className="text-xs text-gray-700 mt-2 sm:mt-3">
              Save this QR code to check your order status anytime
            </p>
          </div>

          {/* Primary: Back to Menu */}
          <Link
            href={menuUrl}
            className="inline-block w-full px-5 py-3 sm:px-6 sm:py-4 bg-orange-500 text-white rounded-lg font-bold text-sm sm:text-base hover:bg-orange-600 mb-2 sm:mb-3"
          >
            Back to Menu
          </Link>

          {/* Track Your Order */}
          <Link
            href={`/order-status/${order?.id}?${statusParams.toString()}`}
            className="inline-block w-full px-5 py-2.5 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-green-700 mb-2 sm:mb-3"
          >
            Track Your Order
          </Link>

          {/* Copy link button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(orderTrackingUrl);
              alert('Order tracking link copied!');
            }}
            className="w-full px-5 py-2.5 sm:px-6 sm:py-3 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm sm:text-base hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Tracking Link
          </button>
        </div>
      </div>
    );
  }

  if (!order || !paymentSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Not Available</h1>
          <p className="text-gray-800 mb-6">Payment settings not configured for this restaurant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            href={`/restaurant/${restaurant?.slug || order.restaurant_id}`}
            className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 sm:mr-2" />
            Back
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-sm sm:text-base text-gray-800">{restaurant?.name || 'Restaurant'}</p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Order Summary</h2>

          <div className="space-y-2 mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-800">
                  {item.quantity}x {getItemDisplayName(item, idx)}
                </span>
                <span className="font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-800">Subtotal</span>
              <span className="text-gray-900">${order.subtotal.toFixed(2)}</span>
            </div>
            {(order.delivery_fee ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-800">Delivery Fee</span>
                <span className="text-gray-900">${(order.delivery_fee ?? 0).toFixed(2)}</span>
              </div>
            )}
            {(order.food_surcharge_amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-800">{order.food_surcharge_name || 'Surcharge'}</span>
                <span className="text-gray-900">${(order.food_surcharge_amount ?? 0).toFixed(2)}</span>
              </div>
            )}
            {/* Card Payment Surcharge - only show when card is selected */}
            {selectedMethod === 'card' && getSurchargeAmount() > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Service Fee ({surchargeSettings.credit_card_surcharge_rate}%)</span>
                <span>+${getSurchargeAmount().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 text-gray-900">
              <span>Total</span>
              <span className="text-blue-600">${getFinalTotal().toFixed(2)} NZD</span>
            </div>
            {/* Always show GST - NZ standard 15%, formula: total * 3 / 23 for GST-inclusive price */}
            <div className="flex justify-between text-xs text-gray-700">
              <span>Incl. GST (15%)</span>
              <span>${(Math.round(getFinalTotal() * 3 / 23 * 100) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Payment Method</h2>

          <div className="space-y-2.5 sm:space-y-3">
            {paymentSettings.accept_card && (
              <button
                onClick={() => {
                  // Show surcharge confirmation popup if surcharge is enabled
                  if (surchargeSettings.credit_card_surcharge_enabled && surchargeSettings.credit_card_surcharge_rate > 0) {
                    setShowSurchargeConfirm(true);
                  } else {
                    setSelectedMethod('card');
                    setClientSecret(null);
                  }
                }}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 sm:gap-4 ${
                  selectedMethod === 'card'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Credit/Debit Card</h3>
                  <p className="text-xs sm:text-sm text-gray-800">Visa, Mastercard, Amex, Apple Pay</p>
                  {surchargeSettings.credit_card_surcharge_enabled && (
                    <p className="text-xs text-orange-600 mt-0.5 sm:mt-1">
                      +{surchargeSettings.credit_card_surcharge_rate}% service fee applies
                    </p>
                  )}
                </div>
              </button>
            )}

            {paymentSettings.accept_bank_transfer && paymentSettings.bank_accounts.length > 0 && (
              <button
                onClick={() => setSelectedMethod('bank_transfer')}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 sm:gap-4 ${
                  selectedMethod === 'bank_transfer'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Bank Transfer</h3>
                  <p className="text-xs sm:text-sm text-gray-800">Transfer directly to bank account</p>
                </div>
              </button>
            )}

            {/* Pay at Cashier - For Dine-in and Pickup orders */}
            {(order.service_type === 'dine_in' || order.service_type === 'pickup') && paymentSettings?.accept_pay_at_cashier && (
              <button
                onClick={() => setSelectedMethod('cash_at_cashier')}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 sm:gap-4 ${
                  selectedMethod === 'cash_at_cashier'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Pay at Cashier</h3>
                  <p className="text-xs sm:text-sm text-gray-800">Pay with cash or card at the cashier</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Payment Form */}
        {selectedMethod === 'card' && clientSecret && stripePromise && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                  },
                },
              }}
            >
              <StripePaymentForm
                clientSecret={clientSecret}
                orderId={order.id}
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          </div>
        )}

        {selectedMethod === 'bank_transfer' && paymentSettings.bank_accounts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <BankTransferPayment
              order={order}
              bankAccounts={paymentSettings.bank_accounts}
              onSlipUpload={handleSlipUpload}
              showQrCode={paymentSettings.accept_qr_code !== false}
            />
          </div>
        )}

        {/* Pay at Cashier Confirmation */}
        {selectedMethod === 'cash_at_cashier' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Banknote className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Pay at Cashier</h3>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              {order.table_no && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm sm:text-base text-orange-800">Table Number</span>
                  <span className="font-bold text-orange-900">{order.table_no}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-orange-800">Amount to Pay</span>
                <span className="text-xl sm:text-2xl font-bold text-orange-600">${order.total_price.toFixed(2)} NZD</span>
              </div>
            </div>

            <button
              onClick={() => handlePayAtCashier()}
              disabled={processingCashPayment}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-base sm:text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingCashPayment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirm Order & Pay at Cashier
                </>
              )}
            </button>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-6 text-center text-sm text-gray-700">
          <p>Your payment is secure and encrypted</p>
        </div>
      </div>

      {/* Surcharge Confirmation Modal */}
      {showSurchargeConfirm && order && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Service Fee Notice</h3>
              <p className="text-sm sm:text-base text-gray-800">
                A {surchargeSettings.credit_card_surcharge_rate}% service fee will be added for card payments.
              </p>
            </div>

            {(() => {
              const modalSurcharge = Math.round((order.subtotal + (order.delivery_fee || 0)) * surchargeSettings.credit_card_surcharge_rate) / 100;
              const modalTotal = order.total_price + modalSurcharge;
              return (
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-800">Order Total</span>
                    <span className="font-medium text-gray-900">${order.total_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-orange-600">
                    <span>Service Fee ({surchargeSettings.credit_card_surcharge_rate}%)</span>
                    <span className="font-medium">
                      +${modalSurcharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base sm:text-lg font-bold pt-2 border-t border-gray-200 text-gray-900">
                    <span>Total</span>
                    <span className="text-blue-600">
                      ${modalTotal.toFixed(2)} NZD
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2.5 sm:gap-3">
              <button
                onClick={() => setShowSurchargeConfirm(false)}
                className="flex-1 py-2.5 sm:py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm sm:text-base hover:bg-gray-300 transition-colors"
              >
                Change Payment
              </button>
              <button
                onClick={() => {
                  setShowSurchargeConfirm(false);
                  setSelectedMethod('card');
                  setClientSecret(null);
                }}
                className="flex-1 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 transition-colors"
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
