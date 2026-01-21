'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Utensils,
  CheckCircle2,
  Package,
  User,
  Phone,
  MapPin,
  Store
} from 'lucide-react';

interface OrderItem {
  menu_id: string;
  name: string;
  nameEn?: string;
  price: number;
  quantity: number;
  selectedMeat?: string;
  selectedAddOns?: string[];
  notes?: string;
  itemTotal: number;
}

interface CustomerDetails {
  name?: string;
  phone?: string;
  address?: string;
  table_no?: string;
  pickup_time?: string;
}

interface Order {
  id: string;
  restaurant_id: string;
  table_no?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total_price: number;
  status: 'pending' | 'pending_payment' | 'payment_rejected' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  service_type?: 'dine_in' | 'pickup' | 'delivery';
  customer_name?: string;
  customer_phone?: string;
  customer_details?: CustomerDetails;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  estimated_minutes?: number;
  cooking_started_at?: string;
  // Payment fields
  payment_method?: 'card' | 'bank_transfer' | 'cash';
  payment_slip_url?: string;
  payment_intent_id?: string;
  cancel_reason?: string;
}

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const order_id = params.order_id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  useEffect(() => {
    if (order_id) {
      fetchOrder();
      setupRealtimeSubscription();
    }
  }, [order_id]);

  // Update estimated time countdown every 30 seconds
  useEffect(() => {
    if (!order) return;

    const interval = setInterval(() => {
      calculateEstimatedTime(order);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [order]);

  const fetchOrder = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/orders/${order_id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Order not found');
        } else {
          throw new Error('Failed to fetch order');
        }
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setOrder(data.order);
        // Calculate estimated time based on status
        calculateEstimatedTime(data.order);
      } else {
        setError('Failed to fetch order');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedTime = (order: Order) => {
    const now = Date.now();

    // If kitchen has set an estimated time, use that
    if (order.estimated_minutes && order.cooking_started_at) {
      const startTime = new Date(order.cooking_started_at).getTime();
      const estimatedEnd = startTime + (order.estimated_minutes * 60 * 1000);
      const remaining = Math.ceil((estimatedEnd - now) / 60000);

      if (remaining <= 0) {
        setEstimatedTime('Almost ready! 🔥');
      } else {
        setEstimatedTime(`~${remaining} minutes`);
      }
      return;
    }

    // Default to 15-30 minutes until kitchen updates
    switch (order.status) {
      case 'pending':
      case 'pending_payment':
      case 'confirmed':
        setEstimatedTime('15-30 minutes');
        return;
      case 'preparing':
        setEstimatedTime('10-20 minutes');
        return;
      case 'ready':
        setEstimatedTime('Ready now! 🎉');
        return;
      case 'completed':
        setEstimatedTime('Completed ✓');
        return;
      case 'cancelled':
        setEstimatedTime('Cancelled');
        return;
      default:
        setEstimatedTime('15-30 minutes');
    }
  };

  const setupRealtimeSubscription = () => {
    if (!supabase || !order_id) return;

    const channel = supabase
      .channel(`order-${order_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order_id}`
        },
        (payload) => {
          console.log('🔄 Order status updated:', payload);
          // Reload order when status changes
          fetchOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusInfo = (orderData: Order) => {
    const status = orderData.status;

    // Special case: pending_payment with payment slip uploaded (bank transfer)
    // This means customer has paid and is waiting for verification
    if (status === 'pending_payment' && orderData.payment_method === 'bank_transfer' && orderData.payment_slip_url) {
      return {
        icon: <Clock className="w-6 h-6" />,
        text: 'Verifying Payment',
        description: 'Your payment slip has been submitted and is being verified by the restaurant',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300'
      };
    }

    // Special case: cancelled due to payment rejection
    if (status === 'cancelled' && orderData.cancel_reason === 'payment_rejected') {
      return {
        icon: <XCircle className="w-6 h-6" />,
        text: 'Payment Rejected',
        description: 'Your payment could not be verified. Please contact the restaurant or place a new order.',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300'
      };
    }

    switch (status) {
      case 'pending_payment':
        return {
          icon: <Clock className="w-6 h-6" />,
          text: 'Awaiting Payment',
          description: 'Please complete your payment to confirm the order',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300'
        };
      case 'pending':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          text: 'Order Sent',
          description: 'Your order has been sent to the restaurant and is waiting to be confirmed',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          text: 'Confirmed',
          description: 'Your order has been confirmed and will be prepared soon',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300'
        };
      case 'preparing':
        return {
          icon: <Utensils className="w-6 h-6" />,
          text: 'Preparing',
          description: 'The kitchen is preparing your order',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300'
        };
      case 'ready':
        return {
          icon: <Package className="w-6 h-6" />,
          text: 'Ready for Pickup',
          description: 'Your order is ready! Please come to collect it',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-6 h-6" />,
          text: 'Completed',
          description: 'Your order has been completed. Thank you!',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-6 h-6" />,
          text: 'Cancelled',
          description: 'This order has been cancelled',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300'
        };
      default:
        return {
          icon: <Clock className="w-6 h-6" />,
          text: 'Unknown',
          description: 'Unknown status',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300'
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The order you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Status</h1>
          <p className="text-gray-600">Order #{order.id.slice(0, 8)}</p>
        </div>

        {/* Status Card */}
        <div className={`bg-white rounded-2xl shadow-xl p-8 mb-6 border-2 ${statusInfo.borderColor}`}>
          <div className="flex items-center justify-center mb-4">
            <div className={`p-4 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.icon}
            </div>
          </div>
          <h2 className={`text-2xl font-bold text-center mb-2 ${statusInfo.color}`}>
            {statusInfo.text}
          </h2>
          <p className="text-center text-gray-600 mb-4">
            {statusInfo.description}
          </p>
          
          {/* Estimated Time */}
          {estimatedTime && order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className={`flex items-center justify-center gap-2 mb-4 p-3 rounded-lg ${
              order.estimated_minutes ? 'bg-green-50 border border-green-200' : 'bg-blue-50'
            }`}>
              <Clock className={`w-5 h-5 ${order.estimated_minutes ? 'text-green-600' : 'text-blue-600'}`} />
              <span className={`font-semibold ${order.estimated_minutes ? 'text-green-800' : 'text-blue-800'}`}>
                {order.estimated_minutes ? (
                  <>Kitchen estimate: {estimatedTime}</>
                ) : (
                  <>Estimated time: {estimatedTime}</>
                )}
              </span>
            </div>
          )}
          
          <div className="text-center text-sm text-gray-500">
            Placed on {formatTime(order.created_at)}
          </div>
          
          {/* Real-time indicator */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Updates automatically</span>
          </div>
        </div>

        {/* Customer Info Card - based on service type */}
        {order.service_type && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              {order.service_type === 'dine_in' ? (
                <><Store className="w-5 h-5 text-orange-500" /> Dine-In</>
              ) : order.service_type === 'pickup' ? (
                <><Package className="w-5 h-5 text-blue-500" /> Pickup</>
              ) : (
                <><MapPin className="w-5 h-5 text-green-500" /> Delivery</>
              )}
            </h3>

            {/* Dine-in: Show table number */}
            {order.service_type === 'dine_in' && order.table_no && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <Store className="w-6 h-6 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">Table Number</p>
                  <p className="text-xl font-bold text-orange-600">Table {order.table_no}</p>
                </div>
              </div>
            )}

            {/* Pickup: Show name, phone, pickup time */}
            {order.service_type === 'pickup' && (
              <div className="space-y-3">
                {(order.customer_name || order.customer_details?.name) && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <User className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">{order.customer_name || order.customer_details?.name}</p>
                    </div>
                  </div>
                )}
                {(order.customer_phone || order.customer_details?.phone) && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Phone className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{order.customer_phone || order.customer_details?.phone}</p>
                    </div>
                  </div>
                )}
                {order.customer_details?.pickup_time && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Pickup Time</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(order.customer_details.pickup_time).toLocaleString('en-NZ', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delivery: Show name, phone, address */}
            {order.service_type === 'delivery' && (
              <div className="space-y-3">
                {(order.customer_name || order.customer_details?.name) && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <User className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">{order.customer_name || order.customer_details?.name}</p>
                    </div>
                  </div>
                )}
                {(order.customer_phone || order.customer_details?.phone) && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Phone className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{order.customer_phone || order.customer_details?.phone}</p>
                    </div>
                  </div>
                )}
                {order.customer_details?.address && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Delivery Address</p>
                      <p className="font-semibold text-gray-900">{order.customer_details.address}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Order Items</h3>

          <div className="space-y-4 mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {item.quantity}x {item.nameEn || item.name}
                  </p>
                  {item.selectedMeat && (
                    <p className="text-sm text-gray-600">Meat: {item.selectedMeat}</p>
                  )}
                  {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                    <p className="text-sm text-gray-600">
                      Add-ons: {item.selectedAddOns.join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-sm text-gray-500 italic mt-1">Note: {item.notes}</p>
                  )}
                </div>
                <p className="font-bold text-gray-900">
                  ${item.itemTotal.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {order.special_instructions && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-1">Special Instructions:</p>
              <p className="text-sm text-yellow-700">{order.special_instructions}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold text-gray-900">${order.subtotal.toFixed(2)}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Delivery Fee:</span>
                <span className="font-semibold text-gray-900">${order.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-lg font-bold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-orange-500">${order.total_price.toFixed(2)} NZD</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between items-center text-sm text-gray-500 mt-1">
                <span>Incl. GST (15%):</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Order Timeline</h3>
          <div className="space-y-4">
            {/* Step 1: Order Received */}
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full ${order.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                <Clock className={`w-5 h-5 ${order.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${order.status === 'pending' ? 'text-gray-900' : 'text-gray-500'}`}>
                  Order Received
                </p>
                <p className="text-sm text-gray-500">{formatTime(order.created_at)}</p>
              </div>
              {order.status !== 'pending' && (
                <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
              )}
            </div>

            {/* Step 2: Confirmed */}
            {['confirmed', 'preparing', 'ready', 'completed'].includes(order.status) && (
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${order.status === 'confirmed' ? 'bg-blue-100' : 'bg-green-100'}`}>
                  <CheckCircle className={`w-5 h-5 ${order.status === 'confirmed' ? 'text-blue-600' : 'text-green-600'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${order.status === 'confirmed' ? 'text-gray-900' : 'text-gray-500'}`}>
                    Confirmed
                  </p>
                  <p className="text-sm text-gray-500">Order confirmed by restaurant</p>
                </div>
                {['preparing', 'ready', 'completed'].includes(order.status) && (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                )}
              </div>
            )}

            {/* Step 3: Preparing */}
            {['preparing', 'ready', 'completed'].includes(order.status) && (
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${order.status === 'preparing' ? 'bg-orange-100' : 'bg-green-100'}`}>
                  <Utensils className={`w-5 h-5 ${order.status === 'preparing' ? 'text-orange-600' : 'text-green-600'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${order.status === 'preparing' ? 'text-gray-900' : 'text-gray-500'}`}>
                    Preparing
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.status === 'preparing' && order.estimated_minutes
                      ? `Kitchen estimate: ~${order.estimated_minutes} minutes`
                      : 'Kitchen is working on your order'}
                  </p>
                </div>
                {['ready', 'completed'].includes(order.status) && (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                )}
              </div>
            )}

            {/* Step 4: Ready */}
            {['ready', 'completed'].includes(order.status) && (
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full ${order.status === 'ready' ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Package className={`w-5 h-5 ${order.status === 'ready' ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${order.status === 'ready' ? 'text-gray-900' : 'text-gray-500'}`}>
                    Ready for Pickup
                  </p>
                  <p className="text-sm text-gray-500">Your order is ready!</p>
                </div>
                {order.status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
                )}
              </div>
            )}

            {order.status === 'completed' && (
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-gray-100">
                  <CheckCircle2 className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Completed</p>
                  {order.completed_at && (
                    <p className="text-sm text-gray-500">{formatTime(order.completed_at)}</p>
                  )}
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 mt-1" />
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

