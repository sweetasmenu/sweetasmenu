'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Loader2,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Utensils,
  ChevronRight,
  RefreshCw,
  Trash2,
  MapPin,
  Store
} from 'lucide-react';

interface OrderItem {
  menu_id: string;
  name: string;
  nameEn?: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  restaurant_id: string;
  status: 'pending' | 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  service_type?: 'dine_in' | 'pickup' | 'delivery';
  items: OrderItem[];
  total_price: number;
  created_at: string;
  table_no?: string;
  restaurant_name?: string;
}

interface StoredOrder {
  orderId: string;
  restaurantId: string;
  restaurantName?: string;
  createdAt: string;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getStoredOrderIds = (): StoredOrder[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('my_orders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const removeStoredOrder = (orderId: string) => {
    const stored = getStoredOrderIds().filter(o => o.orderId !== orderId);
    localStorage.setItem('my_orders', JSON.stringify(stored));
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const fetchOrders = useCallback(async (showRefresh = false) => {
    const storedOrders = getStoredOrderIds();

    if (storedOrders.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (showRefresh) setRefreshing(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const fetchedOrders: Order[] = [];

    // Fetch each order
    for (const stored of storedOrders) {
      try {
        const response = await fetch(`${API_URL}/api/orders/${stored.orderId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.order) {
            fetchedOrders.push({
              ...data.order,
              restaurant_name: stored.restaurantName
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch order:', stored.orderId, error);
      }
    }

    // Sort by created_at descending (newest first)
    fetchedOrders.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setOrders(fetchedOrders);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Setup realtime subscription for all orders
  useEffect(() => {
    if (!supabase || orders.length === 0) return;

    const orderIds = orders.map(o => o.id);

    const channel = supabase
      .channel('my-orders-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          // Check if this update is for one of our orders
          const updatedOrder = payload.new as Order;
          if (orderIds.includes(updatedOrder.id)) {
            console.log('Order updated:', updatedOrder.id);
            setOrders(prev => prev.map(o =>
              o.id === updatedOrder.id ? { ...updatedOrder, restaurant_name: o.restaurant_name } : o
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orders.length]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return {
          icon: <Clock className="w-5 h-5" />,
          text: 'Awaiting Payment',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        };
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5" />,
          text: 'Order Received',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          text: 'Confirmed',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100'
        };
      case 'preparing':
        return {
          icon: <Utensils className="w-5 h-5" />,
          text: 'Preparing',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100'
        };
      case 'ready':
        return {
          icon: <Package className="w-5 h-5" />,
          text: 'Ready!',
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          text: 'Completed',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-5 h-5" />,
          text: 'Cancelled',
          color: 'text-red-500',
          bgColor: 'bg-red-100'
        };
      default:
        return {
          icon: <Clock className="w-5 h-5" />,
          text: 'Unknown',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100'
        };
    }
  };

  const getServiceTypeIcon = (type?: string) => {
    switch (type) {
      case 'dine_in':
        return <Store className="w-4 h-4 text-orange-500" />;
      case 'pickup':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'delivery':
        return <MapPin className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'Yesterday';

    return date.toLocaleDateString('en-NZ', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter: Show active orders first, then recent completed/cancelled
  const activeOrders = orders.filter(o =>
    !['completed', 'cancelled'].includes(o.status)
  );
  const pastOrders = orders.filter(o =>
    ['completed', 'cancelled'].includes(o.status)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-600 text-sm">Track your order status</p>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6">
              Your orders will appear here after you place an order
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
            >
              Browse Restaurants
            </button>
          </div>
        ) : (
          <>
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Active Orders
                </h2>
                <div className="space-y-3">
                  {activeOrders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    return (
                      <div
                        key={order.id}
                        onClick={() => router.push(`/order-status/${order.id}`)}
                        className="bg-white rounded-xl shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-orange-500"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {order.restaurant_name && (
                                <span className="font-semibold text-gray-900">{order.restaurant_name}</span>
                              )}
                              {getServiceTypeIcon(order.service_type)}
                            </div>
                            <p className="text-sm text-gray-500">
                              Order #{order.id.slice(0, 8)} • {formatTime(order.created_at)}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''} • ${order.total_price?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span className="text-sm font-medium">{statusInfo.text}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>

                        {/* Progress indicator for active orders */}
                        {order.status !== 'pending_payment' && (
                          <div className="mt-3 flex gap-1">
                            <div className={`h-1 flex-1 rounded ${
                              ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)
                                ? 'bg-green-500' : 'bg-gray-200'
                            }`}></div>
                            <div className={`h-1 flex-1 rounded ${
                              ['confirmed', 'preparing', 'ready'].includes(order.status)
                                ? 'bg-green-500' : 'bg-gray-200'
                            }`}></div>
                            <div className={`h-1 flex-1 rounded ${
                              ['preparing', 'ready'].includes(order.status)
                                ? 'bg-green-500' : 'bg-gray-200'
                            }`}></div>
                            <div className={`h-1 flex-1 rounded ${
                              order.status === 'ready' ? 'bg-green-500' : 'bg-gray-200'
                            }`}></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past Orders */}
            {pastOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Past Orders</h2>
                <div className="space-y-3">
                  {pastOrders.map(order => {
                    const statusInfo = getStatusInfo(order.status);
                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl shadow-md p-4 opacity-80"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => router.push(`/order-status/${order.id}`)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {order.restaurant_name && (
                                <span className="font-semibold text-gray-700">{order.restaurant_name}</span>
                              )}
                              {getServiceTypeIcon(order.service_type)}
                            </div>
                            <p className="text-sm text-gray-500">
                              Order #{order.id.slice(0, 8)} • {formatTime(order.created_at)}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''} • ${order.total_price?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span className="text-sm font-medium">{statusInfo.text}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStoredOrder(order.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Remove from list"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Real-time indicator */}
        {orders.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Updates automatically</span>
          </div>
        )}

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
