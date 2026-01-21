'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CreditCard, Building2, Loader2, CheckCircle, AlertCircle, ArrowLeft, QrCode, Upload, Copy, Check, Banknote } from 'lucide-react';
import Link from 'next/link';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/config';
import QRCode from 'react-qr-code';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface OrderItem {
  id: string;
  name: string;
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
  accept_cash_at_counter?: boolean;  // Pay at counter for dine-in
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

    if (paymentIntent && paymentIntent.status === 'succeeded') {
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
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
}: {
  order: Order;
  bankAccounts: BankAccount[];
  onSlipUpload: (slip: File) => void;
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

      {/* QR Code */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
        <h4 className="font-semibold text-gray-900 mb-4">Scan to Pay</h4>
        <div className="bg-white p-4 inline-block rounded-lg shadow-inner">
          <QRCode value={qrData} size={180} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Scan with your mobile banking app
        </p>
      </div>

      {/* Bank Details */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h4 className="font-semibold text-gray-900">Bank Details</h4>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Bank</p>
            <p className="font-medium text-gray-900">{currentBank.bank_name}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Account Name</p>
            <p className="font-medium text-gray-900">{currentBank.account_name}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Account Number</p>
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
            <p className="text-sm text-gray-600">Amount</p>
            <p className="text-xl font-bold text-green-600">${order.total_price.toFixed(2)} NZD</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Reference</p>
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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Payment Slip (Optional)
        </h4>
        <p className="text-sm text-blue-700 mb-3">
          Upload your transfer receipt for faster verification
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
  const orderId = params.order_id as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'bank_transfer' | 'cash_at_counter' | null>(null);
  const [processingCashPayment, setProcessingCashPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Surcharge confirmation popup
  const [showSurchargeConfirm, setShowSurchargeConfirm] = useState(false);

  // Surcharge settings for card payments
  const [surchargeSettings, setSurchargeSettings] = useState({
    credit_card_surcharge_enabled: false,
    credit_card_surcharge_rate: 2.50
  });

  // Calculate surcharge amount (only applies to card payments)
  const getSurchargeAmount = () => {
    if (selectedMethod !== 'card' || !surchargeSettings.credit_card_surcharge_enabled) {
      return 0;
    }
    const baseAmount = order ? order.subtotal + (order.delivery_fee || 0) : 0;
    return Math.round(baseAmount * surchargeSettings.credit_card_surcharge_rate) / 100;
  };

  // Get final total with surcharge for card payments
  const getFinalTotal = () => {
    if (!order) return 0;
    const baseTotal = order.subtotal + (order.delivery_fee || 0);
    return baseTotal + getSurchargeAmount();
  };

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

        // Check if already paid
        if (orderInfo.payment_status === 'paid') {
          setPaymentSuccess(true);
          setLoading(false);
          return;
        }

        // Fetch payment settings
        const settingsRes = await fetch(`${API_URL}/api/restaurant/${orderInfo.restaurant_id}/payment-settings`);
        const settingsData = await settingsRes.json();

        if (settingsData.success) {
          setPaymentSettings(settingsData.payment_settings);

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
                credit_card_surcharge_rate: surchargeData.credit_card_surcharge_rate || 2.50
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
          // Redirect to order status page
          router.push(`/order-status/${order.id}`);
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

  // Handle Pay at Counter selection
  const handlePayAtCounter = async () => {
    if (!order) return;

    setProcessingCashPayment(true);
    setError(null);

    try {
      // Update order to confirm and set payment method to cash_at_counter
      const response = await fetch(`${API_URL}/api/orders/${order.id}/pay-at-counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: 'cash_at_counter',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to order status page
        router.push(`/order-status/${order.id}&payment=counter`);
      } else {
        setError(data.detail || 'Failed to confirm order');
      }
    } catch (err) {
      console.error('Error confirming pay at counter:', err);
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
          <p className="text-lg text-gray-600">Loading payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    const orderTrackingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/order-status/${order?.id}`;
    const menuUrl = `/restaurant/${restaurant?.slug || order?.restaurant_id}`;

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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-4">
            Your order has been confirmed and sent to the kitchen.
          </p>

          {/* Order Number */}
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">Order Number</p>
            <p className="text-2xl font-mono font-bold text-gray-900">
              #{order?.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-green-600 mt-2">Estimated time: 15-30 minutes</p>
          </div>

          {/* QR Code for order tracking */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-600 mb-3">Scan to track your order</p>
            <div className="flex justify-center">
              <QRCode value={orderTrackingUrl} size={150} />
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Save this QR code to check your order status anytime
            </p>
          </div>

          {/* Primary: Back to Menu */}
          <Link
            href={menuUrl}
            className="inline-block w-full px-6 py-4 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 mb-3"
          >
            Back to Menu
          </Link>

          {/* Track Your Order */}
          <Link
            href={`/order-status/${order?.id}`}
            className="inline-block w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 mb-3"
          >
            Track Your Order
          </Link>

          {/* Copy link button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(orderTrackingUrl);
              alert('Order tracking link copied!');
            }}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
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
          <p className="text-gray-600 mb-6">Payment settings not configured for this restaurant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/restaurant/${restaurant?.slug || order.restaurant_id}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Complete Payment</h1>
          <p className="text-gray-600">{restaurant?.name || 'Restaurant'}</p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>

          <div className="space-y-2 mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            {order.delivery_fee && order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span>${order.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            {/* Card Payment Surcharge - only show when card is selected */}
            {selectedMethod === 'card' && getSurchargeAmount() > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Service Fee ({surchargeSettings.credit_card_surcharge_rate}%)</span>
                <span>+${getSurchargeAmount().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-blue-600">${getFinalTotal().toFixed(2)} NZD</span>
            </div>
            {/* Always show GST - NZ standard 15%, formula: total * 3 / 23 for GST-inclusive price */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Incl. GST (15%)</span>
              <span>${(Math.round(getFinalTotal() * 3 / 23 * 100) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payment Method</h2>

          <div className="space-y-3">
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
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4 ${
                  selectedMethod === 'card'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Credit/Debit Card</h3>
                  <p className="text-sm text-gray-600">Visa, Mastercard, Amex, Apple Pay</p>
                  {surchargeSettings.credit_card_surcharge_enabled && (
                    <p className="text-xs text-orange-600 mt-1">
                      +{surchargeSettings.credit_card_surcharge_rate}% service fee applies
                    </p>
                  )}
                </div>
              </button>
            )}

            {paymentSettings.accept_bank_transfer && paymentSettings.bank_accounts.length > 0 && (
              <button
                onClick={() => setSelectedMethod('bank_transfer')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4 ${
                  selectedMethod === 'bank_transfer'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Bank Transfer</h3>
                  <p className="text-sm text-gray-600">Transfer directly to bank account</p>
                </div>
              </button>
            )}

            {/* Pay at Counter - Only for Dine-in orders */}
            {order.service_type === 'dine_in' && (
              <button
                onClick={() => setSelectedMethod('cash_at_counter')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4 ${
                  selectedMethod === 'cash_at_counter'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Pay at Counter</h3>
                  <p className="text-sm text-gray-600">Pay with cash or card at the cashier</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Payment Form */}
        {selectedMethod === 'card' && clientSecret && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <Elements
              stripe={getStripe()}
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
          <div className="bg-white rounded-xl shadow-lg p-6">
            <BankTransferPayment
              order={order}
              bankAccounts={paymentSettings.bank_accounts}
              onSlipUpload={handleSlipUpload}
            />
          </div>
        )}

        {/* Pay at Counter Confirmation */}
        {selectedMethod === 'cash_at_counter' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pay at Counter</h3>
              <p className="text-gray-600">
                Your order will be sent to the kitchen. Please pay at the cashier when ready.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-orange-800">Table Number</span>
                <span className="font-bold text-orange-900">{order.table_no || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-orange-800">Amount to Pay</span>
                <span className="text-2xl font-bold text-orange-600">${order.total_price.toFixed(2)} NZD</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Please show your table number to the cashier when paying.
                You can pay with cash or card at the counter.
              </p>
            </div>

            <button
              onClick={handlePayAtCounter}
              disabled={processingCashPayment}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingCashPayment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirm Order & Pay at Counter
                </>
              )}
            </button>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Your payment is secure and encrypted</p>
        </div>
      </div>

      {/* Surcharge Confirmation Modal */}
      {showSurchargeConfirm && order && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Service Fee Notice</h3>
              <p className="text-gray-600">
                A {surchargeSettings.credit_card_surcharge_rate}% service fee will be added for card payments.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${order.subtotal.toFixed(2)}</span>
              </div>
              {order.delivery_fee && order.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery Fee</span>
                  <span className="font-medium">${order.delivery_fee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-orange-600">
                <span>Service Fee ({surchargeSettings.credit_card_surcharge_rate}%)</span>
                <span className="font-medium">
                  +${(Math.round((order.subtotal + (order.delivery_fee || 0)) * surchargeSettings.credit_card_surcharge_rate) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="text-blue-600">
                  ${((order.subtotal + (order.delivery_fee || 0)) * (1 + surchargeSettings.credit_card_surcharge_rate / 100)).toFixed(2)} NZD
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSurchargeConfirm(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Change Payment
              </button>
              <button
                onClick={() => {
                  setShowSurchargeConfirm(false);
                  setSelectedMethod('card');
                  setClientSecret(null);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
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
