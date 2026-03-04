'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Bell, Volume2, VolumeX, Clock, CheckCircle,
  AlertTriangle, LogOut, RefreshCw, Loader2, Timer,
  Utensils, Coffee, Hand, Droplets, Receipt,
  MessageSquare, Store, MapPin, X, Printer, XCircle, Eye, Bluetooth, Cloud
} from 'lucide-react';
import { printViaIframe, printViaCloud, getPrintMethod, setPrintMethod, isMobileDevice, type PrintMethod } from '@/lib/utils/printHelper';
import { supabase } from '@/lib/supabase/client';
import { t, tBilingual, mapToPOSLanguage, POSLanguage } from '@/lib/pos-translations';
import { getThemeClasses, POSTheme } from '@/lib/pos-theme';
import BilingualText, { BilingualTextInline } from '@/components/BilingualText';
import POSNavbar from '@/components/POSNavbar';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface OrderItem {
  menu_id: string;
  name: string;
  nameEn?: string;
  quantity: number;
  price: number;
  selectedMeat?: string;
  selectedAddOns?: string[];
  notes?: string;
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
  table_no: string | null;
  items: OrderItem[];
  status: 'pending_payment' | 'awaiting_cashier_payment' | 'verifying_payment' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  service_type: 'dine_in' | 'pickup' | 'delivery';
  special_instructions?: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_details?: CustomerDetails;
  total_price: number;
  payment_method?: 'card' | 'bank_transfer' | 'cash_at_counter' | 'cash_at_cashier' | 'cashier_cash' | 'cashier_eftpos';
  payment_status?: 'pending' | 'paid' | 'failed';
  payment_intent_id?: string;
  payment_slip_url?: string;
}

interface ServiceRequest {
  id: string;
  table_no: string;
  request_type: 'call_waiter' | 'request_sauce' | 'request_water' | 'request_bill' | 'other';
  message?: string;
  status: 'pending' | 'acknowledged' | 'completed';
  created_at: string;
}

interface POSSession {
  staffId: string;
  staffName: string;
  role: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  primaryLanguage?: string;
  expires: number;
}

export default function StaffOrdersPage() {
  const router = useRouter();
  const [session, setSession] = useState<POSSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'requests'>('orders');
  const [loading, setLoading] = useState(true);
  const [volume, setVolume] = useState(70);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Translation states
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('th');
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<POSLanguage>('th');

  // Theme state - load from localStorage first for instant display
  const [posTheme, setPosTheme] = useState<POSTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos_theme');
      if (saved) return saved as POSTheme;
    }
    return 'orange';
  });
  const themeClasses = getThemeClasses(posTheme);

  // Void order states
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Print preview states
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewOrder, setPrintPreviewOrder] = useState<Order | null>(null);

  // Payment verification modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [paymentVerifyLoading, setPaymentVerifyLoading] = useState(false);
  const [stripePaymentStatus, setStripePaymentStatus] = useState<'loading' | 'succeeded' | 'failed' | 'pending' | 'unknown'>('loading');

  // Cashier payment confirmation modal states
  const [showCashierPaymentModal, setShowCashierPaymentModal] = useState(false);
  const [cashierPaymentOrder, setCashierPaymentOrder] = useState<Order | null>(null);
  const [cashierPaymentLoading, setCashierPaymentLoading] = useState(false);

  // Bluetooth print mode
  const [currentPrintMethod, setCurrentPrintMethod] = useState<PrintMethod>('system');
  const [showMobilePrintToggle, setShowMobilePrintToggle] = useState(false);

  // Restaurant details for receipts
  const [restaurantDetails, setRestaurantDetails] = useState<{
    name: string;
    address?: string;
    phone?: string;
    gst_number?: string;
    ird_number?: string;
  }>({ name: '' });

  // Check session
  useEffect(() => {
    const savedSession = localStorage.getItem('pos_session');
    if (!savedSession) {
      router.push('/pos/login');
      return;
    }

    const parsedSession = JSON.parse(savedSession) as POSSession;
    if (parsedSession.expires < Date.now()) {
      localStorage.removeItem('pos_session');
      router.push('/pos/login');
      return;
    }

    setSession(parsedSession);

    // Set language from session
    if (parsedSession.primaryLanguage) {
      const posLang = mapToPOSLanguage(parsedSession.primaryLanguage);
      setLang(posLang);
      setPrimaryLanguage(parsedSession.primaryLanguage);
    }

    // Initialize print method and detect mobile
    setCurrentPrintMethod(getPrintMethod());
    setShowMobilePrintToggle(isMobileDevice());
  }, [router]);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Create audio context for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    // Use Web Audio API for sound notifications (no mp3 files needed)
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('✅ Web Audio API initialized for notifications');
    } catch (e) {
      console.log('⚠️ Web Audio API not available');
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);


  // Play Web Audio notification
  const playWebAudioNotification = useCallback((type: 'order' | 'request' = 'order') => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const baseFreq = type === 'request' ? 600 : 800;
    const pattern = type === 'request' ? [600, 800, 600, 800] : [800, 1000];

    pattern.forEach((freq, i) => {
      setTimeout(() => {
        if (!audioContextRef.current) return;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = freq;
        oscillator.type = type === 'request' ? 'triangle' : 'sine';
        gainNode.gain.value = (volume / 100) * 0.3;
        oscillator.start();
        gainNode.gain.setValueAtTime((volume / 100) * 0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.stop(ctx.currentTime + 0.2);
      }, i * 150);
    });
  }, [volume]);

  // Play notification using Web Audio API
  const playNotification = useCallback((type: 'order' | 'request' = 'order') => {
    if (soundEnabled) {
      playWebAudioNotification(type);
    }
    if (vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(type === 'request' ? [300, 100, 300, 100, 300] : [200, 100, 200]);
    }
  }, [soundEnabled, vibrationEnabled, playWebAudioNotification]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!session?.restaurantId) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/orders?restaurant_id=${session.restaurantId}`
      );
      const data = await response.json();
      if (data.success) {
        // Filter out completed/cancelled AND pending_payment orders
        // Exception: keep completed cashier-pay orders that are still unpaid
        setOrders((data.orders || []).filter((o: Order) => {
          if (['cancelled', 'pending_payment'].includes(o.status)) return false;
          if (o.status === 'completed') {
            // Keep completed but unpaid cashier orders visible
            return ['cash_at_cashier', 'cashier_cash', 'cashier_eftpos'].includes(o.payment_method || '') && o.payment_status !== 'paid';
          }
          return true;
        }));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, [session?.restaurantId]);

  // Fetch service requests
  const fetchServiceRequests = useCallback(async () => {
    if (!session?.restaurantId) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('restaurant_id', session.restaurantId)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: false });

      if (data) {
        setServiceRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch service requests:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.restaurantId]);

  // Fetch restaurant settings (primary language, theme, and business info)
  const fetchRestaurantSettings = useCallback(async () => {
    if (!session?.restaurantId) return;

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('name, primary_language, pos_theme_color, address, phone, gst_number, ird_number')
        .eq('id', session.restaurantId)
        .single();

      if (data?.primary_language) {
        setPrimaryLanguage(data.primary_language);
        // Sync UI language with database setting
        const posLang = mapToPOSLanguage(data.primary_language);
        setLang(posLang);
      }
      if (data?.pos_theme_color) {
        setPosTheme(data.pos_theme_color as POSTheme);
        localStorage.setItem('pos_theme', data.pos_theme_color);
      }
      // Store restaurant details for receipts
      if (data) {
        setRestaurantDetails({
          name: data.name || session.restaurantName,
          address: data.address,
          phone: data.phone,
          gst_number: data.gst_number,
          ird_number: data.ird_number,
        });
      }
    } catch (error) {
      console.error('Failed to fetch restaurant settings:', error);
    }
  }, [session?.restaurantId, session?.restaurantName]);

  // Translate text to restaurant's primary language
  const translateText = useCallback(async (text: string, cacheKey: string) => {
    if (!text || translatedTexts[cacheKey]) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/translate/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [text],
          source_lang: 'auto',
          target_lang: primaryLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translations && data.translations[0]) {
          setTranslatedTexts(prev => ({
            ...prev,
            [cacheKey]: data.translations[0]
          }));
        }
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  }, [primaryLanguage, translatedTexts]);

  // Auto-translate order notes, instructions, item names, and service request messages
  useEffect(() => {
    // Translate order notes, instructions, and item names
    orders.forEach(order => {
      if (order.special_instructions) {
        const key = `order_${order.id}_instructions`;
        if (!translatedTexts[key]) {
          translateText(order.special_instructions, key);
        }
      }
      order.items.forEach((item, idx) => {
        if (item.notes) {
          const key = `order_${order.id}_item_${idx}_notes`;
          if (!translatedTexts[key]) {
            translateText(item.notes, key);
          }
        }
        // Translate item name to primary language
        if (item.name) {
          const nameKey = `item_name_${item.menu_id || `${order.id}_${idx}`}`;
          if (!translatedTexts[nameKey]) {
            translateText(item.name, nameKey);
          }
        }
      });
    });

    // Translate service request messages
    serviceRequests.forEach(req => {
      if (req.message) {
        const key = `request_${req.id}_message`;
        if (!translatedTexts[key]) {
          translateText(req.message, key);
        }
      }
    });
  }, [orders, serviceRequests, translateText, translatedTexts]);

  // Initial fetch
  useEffect(() => {
    if (session?.restaurantId) {
      fetchOrders();
      fetchServiceRequests();
      fetchRestaurantSettings();
    }
  }, [session?.restaurantId, fetchOrders, fetchServiceRequests, fetchRestaurantSettings]);

  // Real-time subscription for restaurant settings (language changes)
  useEffect(() => {
    if (!session?.restaurantId) return;

    const settingsChannel = supabase
      .channel('staff-settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${session.restaurantId}`
        },
        (payload) => {
          console.log('Restaurant settings update:', payload);
          if (payload.new && (payload.new as any).primary_language) {
            const newLang = (payload.new as any).primary_language;
            setPrimaryLanguage(newLang);
            setLang(mapToPOSLanguage(newLang));
          }
          if (payload.new && (payload.new as any).pos_theme_color) {
            const newTheme = (payload.new as any).pos_theme_color as POSTheme;
            setPosTheme(newTheme);
            localStorage.setItem('pos_theme', newTheme);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, [session?.restaurantId]);

  // Real-time subscriptions for orders and service requests
  useEffect(() => {
    if (!session?.restaurantId) return;

    // Orders channel
    const ordersChannel = supabase
      .channel('staff-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${session.restaurantId}`
        },
        (payload) => {
          console.log('Order update:', payload);

          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            const isCashierUnpaid = ['cash_at_cashier', 'cashier_cash', 'cashier_eftpos'].includes(newOrder.payment_method || '') && newOrder.payment_status !== 'paid';
            if (!['cancelled', 'pending_payment'].includes(newOrder.status) && (newOrder.status !== 'completed' || isCashierUnpaid)) {
              playNotification('order');
              setOrders((prev) => [newOrder, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as Order;
            const isCashierUnpaid = ['cash_at_cashier', 'cashier_cash', 'cashier_eftpos'].includes(newOrder.payment_method || '') && newOrder.payment_status !== 'paid';

            // Remove cancelled/pending_payment, and completed orders (unless cashier unpaid)
            if (['cancelled', 'pending_payment'].includes(newOrder.status) || (newOrder.status === 'completed' && !isCashierUnpaid)) {
              setOrders((prev) => prev.filter((o) => o.id !== newOrder.id));
            }
            // Otherwise update existing order or add if new
            else {
              setOrders((prev) => {
                const exists = prev.some(o => o.id === newOrder.id);
                if (exists) {
                  return prev.map((order) => order.id === newOrder.id ? newOrder : order);
                }
                // Order just became visible (e.g., pending_payment → pending after payment)
                playNotification('order');
                return [newOrder, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Service requests channel
    const requestsChannel = supabase
      .channel('staff-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `restaurant_id=eq.${session.restaurantId}`
        },
        (payload) => {
          console.log('Service request update:', payload);

          if (payload.eventType === 'INSERT') {
            playNotification('request');
            setServiceRequests((prev) => [payload.new as ServiceRequest, ...prev]);
            // Auto-switch to requests tab
            setActiveTab('requests');
          } else if (payload.eventType === 'UPDATE') {
            const newRequest = payload.new as ServiceRequest;
            if (newRequest.status === 'completed') {
              setServiceRequests((prev) => prev.filter((r) => r.id !== newRequest.id));
            } else {
              setServiceRequests((prev) =>
                prev.map((req) =>
                  req.id === newRequest.id ? newRequest : req
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setServiceRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [session?.restaurantId, playNotification]);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        if (['completed', 'cancelled'].includes(newStatus)) {
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
        }
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    }
  };

  // Open cashier payment modal - staff selects Cash or EFTPOS
  const openCashierPaymentModal = (order: Order) => {
    setCashierPaymentOrder(order);
    setShowCashierPaymentModal(true);
  };

  // Confirm cashier payment - staff confirms customer has paid at cashier
  // paymentType: 'cashier_cash' or 'cashier_eftpos'
  const confirmCashierPayment = async (orderId: string, paymentType: 'cashier_cash' | 'cashier_eftpos') => {
    setCashierPaymentLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/confirm-cashier-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_type: paymentType })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // New flow: order completed. Legacy flow: order sent to kitchen.
          // The real-time subscription will update the order list
          console.log('✅ Cashier payment confirmed');
          setShowCashierPaymentModal(false);
          setCashierPaymentOrder(null);
        }
      }
    } catch (error) {
      console.error('Failed to confirm cashier payment:', error);
    } finally {
      setCashierPaymentLoading(false);
    }
  };

  // Void order
  const handleVoidOrder = async () => {
    if (!voidingOrder || !voidReason.trim()) return;

    setVoidLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${voidingOrder.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          void_reason: voidReason,
          voided_by: session?.staffId
        })
      });

      if (response.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== voidingOrder.id));
        setShowVoidModal(false);
        setVoidingOrder(null);
        setVoidReason('');
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to void order');
      }
    } catch (error) {
      console.error('Failed to void order:', error);
      alert('Failed to void order');
    } finally {
      setVoidLoading(false);
    }
  };

  // Open void modal
  const openVoidModal = (order: Order) => {
    setVoidingOrder(order);
    setVoidReason('');
    setShowVoidModal(true);
  };

  // Open print preview
  const openPrintPreview = (order: Order) => {
    setPrintPreviewOrder(order);
    setShowPrintPreview(true);
  };

  // Open payment verification modal
  const openPaymentModal = async (order: Order) => {
    setPaymentModalOrder(order);
    setShowPaymentModal(true);
    setStripePaymentStatus('loading');

    // If paid via Stripe, check payment status
    if (order.payment_method === 'card' && order.payment_intent_id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/payments/status/${order.payment_intent_id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'succeeded') {
            setStripePaymentStatus('succeeded');
          } else if (data.status === 'requires_payment_method' || data.status === 'canceled') {
            setStripePaymentStatus('failed');
          } else if (data.status === 'processing' || data.status === 'requires_action') {
            setStripePaymentStatus('pending');
          } else {
            setStripePaymentStatus('unknown');
          }
        } else {
          setStripePaymentStatus('unknown');
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
        setStripePaymentStatus('unknown');
      }
    } else if (order.payment_method === 'bank_transfer') {
      // For bank transfer, status depends on slip upload
      setStripePaymentStatus(order.payment_slip_url ? 'pending' : 'unknown');
    } else {
      setStripePaymentStatus('unknown');
    }
  };

  // Confirm payment and move order to pending (kitchen)
  const confirmPayment = async () => {
    if (!paymentModalOrder) return;

    setPaymentVerifyLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${paymentModalOrder.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });

      if (response.ok) {
        // Auto-print receipt after confirming payment (original, not copy)
        printOrder(paymentModalOrder, false);

        setShowPaymentModal(false);
        setPaymentModalOrder(null);
      } else {
        alert(lang === 'th' ? 'ไม่สามารถยืนยันการชำระเงินได้' : 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      alert(lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred');
    } finally {
      setPaymentVerifyLoading(false);
    }
  };

  // Reject payment and cancel order
  const rejectPayment = async () => {
    if (!paymentModalOrder) return;

    setPaymentVerifyLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${paymentModalOrder.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancel_reason: 'payment_rejected' })
      });

      if (response.ok) {
        setShowPaymentModal(false);
        setPaymentModalOrder(null);
        setOrders((prev) => prev.filter((o) => o.id !== paymentModalOrder.id));
      } else {
        alert(lang === 'th' ? 'ไม่สามารถยกเลิกออเดอร์ได้' : 'Failed to reject order');
      }
    } catch (error) {
      console.error('Failed to reject payment:', error);
      alert(lang === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred');
    } finally {
      setPaymentVerifyLoading(false);
    }
  };

  // Print order receipt (optimized for 80mm thermal printers)
  // isCopy: true = reprint with "COPY" watermark
  const printOrder = (order: Order, isCopy: boolean = false) => {

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Get additional fees from order (delivery_fee, surcharge_amount)
    const orderAny = order as any;
    const deliveryFee = orderAny.delivery_fee || 0;
    const surchargeAmount = orderAny.surcharge_amount || 0;

    // Calculate GST (NZ: 15% included in price, formula: total * 3 / 23)
    const totalPrice = order.total_price || subtotal + deliveryFee + surchargeAmount;
    const gstAmount = Math.round(totalPrice * 3 / 23 * 100) / 100;

    // Get restaurant info
    const restName = restaurantDetails.name || session?.restaurantName || 'Restaurant';
    const restAddress = restaurantDetails.address || '';
    const restPhone = restaurantDetails.phone || '';
    const gstNumber = restaurantDetails.gst_number || '';
    const irdNumber = restaurantDetails.ird_number || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - ${order.id.slice(0, 8).toUpperCase()}</title>
        <style>
          /* POS80 Thermal Printer — 72mm printable on 80mm paper */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { margin: 0; }
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            width: 72mm;
            height: auto;
            overflow: hidden;
            margin: 0;
            padding: 0 3mm 0 0;
            font-size: 12px;
            font-weight: bold;
            line-height: 1.3;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt { width: 100%; padding-bottom: 5mm; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td { vertical-align: top; color: #000; padding: 1px 0; }

          .copy-badge {
            text-align: center;
            border: 2px solid #000;
            padding: 3px;
            margin-bottom: 4px;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 2px;
          }

          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 4px;
            margin-bottom: 4px;
          }
          .header h1 { font-size: 16px; font-weight: 900; margin-bottom: 2px; }
          .header p { font-size: 11px; color: #000; margin: 1px 0; }
          .header .tax-info { font-size: 10px; color: #000; margin-top: 2px; }
          .header .subtitle { font-size: 11px; font-weight: 900; margin-top: 3px; }
          .order-type { font-size: 12px; font-weight: 900; margin-top: 3px; display: block; }

          .info { margin-bottom: 4px; font-size: 11px; }
          .info p { margin: 1px 0; color: #000; }

          .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; margin: 3px 0; }
          .items table td { font-size: 11px; padding: 1px 0; }
          .item-qty { width: 18px; font-weight: 900; }
          .item-name { word-wrap: break-word; overflow-wrap: break-word; }
          .item-price { width: 48px; text-align: right; white-space: nowrap; }
          .modifier { font-size: 10px; color: #000; padding-left: 20px; margin: 1px 0; font-weight: normal; }

          .special {
            border: 2px solid #000;
            padding: 3px;
            margin: 3px 0;
            font-size: 11px;
          }
          .special-label { font-weight: 900; margin-bottom: 2px; }

          .totals { margin-top: 3px; padding-top: 3px; font-size: 11px; }
          .totals table td { padding: 1px 0; }
          .totals .right { text-align: right; }
          .grand-total td {
            font-size: 14px;
            font-weight: 900;
            border-top: 2px solid #000;
            padding-top: 3px;
          }
          .gst-info { font-size: 10px; text-align: right; color: #000; margin-top: 2px; }

          .footer {
            text-align: center;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 2px dashed #000;
            font-size: 11px;
            color: #000;
          }
          .footer p { margin: 1px 0; }

          .cut-line {
            text-align: center;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dashed #000;
            font-size: 10px;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          ${isCopy ? '<div class="copy-badge">*** COPY ***</div>' : ''}
          <div class="header">
            <h1>${restName}</h1>
            ${restAddress ? `<p>${restAddress}</p>` : ''}
            ${restPhone ? `<p>Tel: ${restPhone}</p>` : ''}
            ${gstNumber || irdNumber ? `
              <p class="tax-info">
                ${gstNumber ? `GST No: ${gstNumber}` : ''}
                ${gstNumber && irdNumber ? ' | ' : ''}
                ${irdNumber ? `IRD No: ${irdNumber}` : ''}
              </p>
            ` : ''}
            <p class="subtitle">TAX INVOICE</p>
            <span class="order-type">${order.service_type === 'dine_in' ? 'DINE IN' : order.service_type === 'pickup' ? 'PICK UP' : 'DELIVERY'}</span>
          </div>

          <div class="info">
            <p><b>Order #:</b> ${order.id.slice(0, 8).toUpperCase()}</p>
            <p><b>Date:</b> ${new Date(order.created_at).toLocaleString('en-NZ', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}</p>
            ${order.table_no ? `<p><b>Table:</b> ${order.table_no}</p>` : ''}
            ${order.customer_name || order.customer_details?.name ? `<p><b>Customer:</b> ${order.customer_name || order.customer_details?.name}</p>` : ''}
          </div>

          <div class="items">
            <table>
              ${order.items.map(item => `
                <tr>
                  <td class="item-qty">${item.quantity}x</td>
                  <td class="item-name">${item.nameEn || item.name}</td>
                  <td class="item-price">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
                ${item.selectedMeat ? `<tr><td></td><td colspan="2" class="modifier">+ ${item.selectedMeat}</td></tr>` : ''}
                ${item.selectedAddOns?.length ? `<tr><td></td><td colspan="2" class="modifier">+ ${item.selectedAddOns.join(', ')}</td></tr>` : ''}
                ${item.notes ? `<tr><td></td><td colspan="2" class="modifier">"${item.notes}"</td></tr>` : ''}
              `).join('')}
            </table>
          </div>

          ${order.special_instructions ? `
            <div class="special">
              <div class="special-label">SPECIAL NOTE:</div>
              ${order.special_instructions}
            </div>
          ` : ''}

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td class="right">$${subtotal.toFixed(2)}</td>
              </tr>
              ${deliveryFee > 0 ? `
                <tr>
                  <td>Delivery Fee:</td>
                  <td class="right">$${deliveryFee.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${surchargeAmount > 0 ? `
                <tr>
                  <td>Service Fee:</td>
                  <td class="right">$${surchargeAmount.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr class="grand-total">
                <td>TOTAL:</td>
                <td class="right">$${totalPrice.toFixed(2)} NZD</td>
              </tr>
            </table>
            <div class="gst-info">
              Incl. GST (15%): $${gstAmount.toFixed(2)}
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your order!</p>
            <p>Powered by SweetAsMenu</p>
          </div>

          <div class="cut-line">
            --------------------------------
          </div>
        </div>

        <script>
          window.onafterprint = function() { window.close(); };
          window.onload = function() {
            setTimeout(function() { window.print(); }, 600);
          };
        </script>
      </body>
      </html>
    `;

    if (currentPrintMethod === 'cloud' && session?.restaurantId) {
      printViaCloud(html, 'receipt', session.restaurantId, order.id).then(ok => {
        if (ok) {
          alert(lang === 'th' ? 'ส่งงานปริ้นไปยัง Cloud Queue แล้ว' : 'Print job sent to Cloud Queue');
        } else {
          alert(lang === 'th' ? 'ส่งงานปริ้นไม่สำเร็จ — ตรวจสอบตาราง print_queue ใน Supabase' : 'Cloud print failed — check print_queue table in Supabase');
        }
      });
    } else {
      printViaIframe(html);
    }
  };

  // Print kitchen ticket (for kitchen display)
  const printKitchenTicket = (order: Order) => {

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kitchen - ${order.id.slice(0, 8).toUpperCase()}</title>
        <style>
          /* POS80 Thermal Printer — 72mm printable on 80mm paper */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { margin: 0; }
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            width: 72mm;
            height: auto;
            overflow: hidden;
            margin: 0;
            padding: 0 3mm 0 0;
            font-size: 12px;
            font-weight: bold;
            line-height: 1.3;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ticket { padding-bottom: 5mm; }
          .order-number {
            font-size: 20px;
            font-weight: 900;
            text-align: center;
            border: 2px solid #000;
            padding: 4px;
            margin-bottom: 4px;
          }
          .order-type {
            font-size: 14px;
            font-weight: 900;
            text-align: center;
            margin-bottom: 4px;
            color: #000;
          }
          .info { font-size: 12px; margin-bottom: 4px; color: #000; }
          .info p { margin: 1px 0; }
          .items { border-top: 2px solid #000; padding-top: 4px; }
          .item {
            font-size: 13px;
            font-weight: 900;
            margin: 4px 0;
            padding-bottom: 3px;
            border-bottom: 1px dashed #000;
            color: #000;
          }
          .item-qty { font-size: 14px; font-weight: 900; }
          .modifier {
            font-size: 12px;
            font-weight: normal;
            padding-left: 20px;
            margin: 2px 0;
            color: #000;
          }
          .special {
            border: 3px solid #000;
            padding: 6px;
            margin: 6px 0;
            font-size: 15px;
            font-weight: 900;
            color: #000;
          }
          .time {
            text-align: center;
            font-size: 12px;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dashed #000;
            color: #000;
          }
          .cut-line {
            text-align: center;
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px dashed #000;
            font-size: 11px;
            color: #000;
          }
        </style>
      </head>
      <body>
      <div class="ticket">
        <div class="order-number">
          #${order.id.slice(0, 8).toUpperCase()}
        </div>

        <div class="order-type">
          ${order.service_type === 'dine_in' ? 'DINE IN' : order.service_type === 'pickup' ? 'PICK UP' : 'DELIVERY'}
        </div>

        <div class="info">
          ${order.table_no ? `<p><b>TABLE: ${order.table_no}</b></p>` : ''}
          ${order.customer_name ? `<p>Customer: ${order.customer_name}</p>` : ''}
        </div>

        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <span class="item-qty">${item.quantity}x</span> ${translatedTexts[`item_name_${item.menu_id || ''}`] || item.name}${item.nameEn ? ` <span style="color:#666;font-size:0.85em">(${item.nameEn})</span>` : ''}
              ${item.selectedMeat ? `<div class="modifier">+ ${item.selectedMeat}</div>` : ''}
              ${item.selectedAddOns?.length ? `<div class="modifier">+ ${item.selectedAddOns.join(', ')}</div>` : ''}
              ${item.notes ? `<div class="modifier">"${item.notes}"</div>` : ''}
            </div>
          `).join('')}
        </div>

        ${order.special_instructions ? `
          <div class="special">
            NOTE: ${order.special_instructions}
          </div>
        ` : ''}

        <div class="time">
          ${new Date(order.created_at).toLocaleString('en-NZ', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })}
        </div>

        <div class="cut-line">
          --------------------------------
        </div>
      </div>

        <script>
          window.onafterprint = function() { window.close(); };
          window.onload = function() {
            setTimeout(function() { window.print(); }, 600);
          };
        </script>
      </body>
      </html>
    `;

    if (currentPrintMethod === 'cloud' && session?.restaurantId) {
      printViaCloud(html, 'kitchen_ticket', session.restaurantId, order.id).then(ok => {
        if (ok) {
          alert(lang === 'th' ? 'ส่งงานปริ้นไปยัง Cloud Queue แล้ว' : 'Print job sent to Cloud Queue');
        } else {
          alert(lang === 'th' ? 'ส่งงานปริ้นไม่สำเร็จ — ตรวจสอบตาราง print_queue ใน Supabase' : 'Cloud print failed — check print_queue table in Supabase');
        }
      });
    } else {
      printViaIframe(html);
    }
  };

  // Update service request status
  const updateRequestStatus = async (requestId: string, newStatus: ServiceRequest['status']) => {
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: newStatus,
          acknowledged_by: newStatus === 'acknowledged' ? session?.staffId : undefined,
          acknowledged_at: newStatus === 'acknowledged' ? new Date().toISOString() : undefined,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (!error && newStatus === 'completed') {
        setServiceRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('pos_session');
    router.push('/pos/login');
  };

  // Calculate time since
  const getTimeSince = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('orders', 'justNow', lang);
    if (minutes < 60) return `${minutes} ${t('orders', 'minutes', lang)}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${t('orders', 'hours', lang)}`;
  };

  // Get request type icon and text
  const getRequestTypeInfo = (type: ServiceRequest['request_type']) => {
    switch (type) {
      case 'call_waiter': return { icon: Hand, text: t('orders', 'callWaiter', lang), color: 'text-blue-500' };
      case 'request_sauce': return { icon: Droplets, text: t('orders', 'requestSauce', lang), color: 'text-orange-500' };
      case 'request_water': return { icon: Coffee, text: t('orders', 'requestWater', lang), color: 'text-cyan-500' };
      case 'request_bill': return { icon: Receipt, text: t('orders', 'requestBill', lang), color: 'text-green-500' };
      default: return { icon: MessageSquare, text: t('orders', 'other', lang), color: 'text-purple-500' };
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending_payment': return 'bg-purple-500';
      case 'awaiting_cashier_payment': return 'bg-orange-500';
      case 'verifying_payment': return 'bg-purple-500';
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'preparing': return 'bg-orange-500';
      case 'ready': return 'bg-green-500';
      case 'completed': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const pendingRequestsCount = serviceRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navigation Bar */}
      <POSNavbar
        session={session}
        currentTime={currentTime}
        lang={lang}
        theme={posTheme}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled(!soundEnabled)}
        volume={volume}
        onVolumeChange={setVolume}
        showSoundControls={true}
      />

      {/* Toolbar */}
      <div className="bg-slate-800 px-2 md:px-4 py-1.5 md:py-2 flex items-center justify-between border-b border-slate-700">
        {/* Print Method Selector */}
        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={() => { setPrintMethod('system'); setCurrentPrintMethod('system'); }}
            className={`flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
              currentPrintMethod === 'system'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
            }`}
            title="System Print"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{lang === 'th' ? 'ปริ้นปกติ' : 'System'}</span>
          </button>
          {showMobilePrintToggle && (
            <button
              onClick={() => { setPrintMethod('rawbt'); setCurrentPrintMethod('rawbt'); }}
              className={`flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                currentPrintMethod === 'rawbt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
              }`}
              title="Bluetooth (RawBT)"
            >
              <Bluetooth className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">BT</span>
            </button>
          )}
          <button
            onClick={() => { setPrintMethod('cloud'); setCurrentPrintMethod('cloud'); }}
            className={`flex items-center gap-1 px-2 md:px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
              currentPrintMethod === 'cloud'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
            }`}
            title="Cloud Print Queue"
          >
            <Cloud className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{lang === 'th' ? 'คลาวด์' : 'Cloud'}</span>
          </button>
        </div>

        <button
          onClick={() => { fetchOrders(); fetchServiceRequests(); }}
          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xs md:text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
          <span>{lang === 'th' ? 'รีเฟรช' : 'Refresh'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'orders'
              ? `bg-slate-800 ${themeClasses.textPrimary} border-b-2 ${themeClasses.borderPrimary}`
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <BilingualTextInline
            category="orders"
            textKey="ordersTab"
            lang={lang}
            englishClassName="text-[10px] opacity-70 ml-1"
          />
          <span className={`px-2 py-0.5 ${themeClasses.bgPrimary} text-white text-sm rounded-full`}>
            {orders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === 'requests'
              ? `bg-slate-800 ${themeClasses.textPrimary} border-b-2 ${themeClasses.borderPrimary}`
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bell className="w-5 h-5" />
          <BilingualTextInline
            category="orders"
            textKey="requestsTab"
            lang={lang}
            englishClassName="text-[10px] opacity-70 ml-1"
          />
          {pendingRequestsCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-sm rounded-full animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <main className="p-3 md:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
          </div>
        ) : activeTab === 'orders' ? (
          /* Orders Tab */
          orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Coffee className="w-16 h-16 mb-4" />
              <BilingualText
                category="orders"
                textKey="noOrders"
                lang={lang}
                className="items-center"
                primaryClassName="text-xl"
                englishClassName="text-sm opacity-60"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-slate-800 rounded-xl overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 bg-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {order.service_type === 'dine_in' ? (
                        <div className={`w-12 h-12 ${themeClasses.bgPrimary} rounded-full flex items-center justify-center`}>
                          <span className="text-lg font-bold">T{order.table_no}</span>
                        </div>
                      ) : order.service_type === 'pickup' ? (
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                          <Store className="w-6 h-6" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <MapPin className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status === 'pending_payment' ? (lang === 'th' ? 'รอยืนยันชำระเงิน' : 'Awaiting Payment') :
                           order.status === 'awaiting_cashier_payment' ? (lang === 'th' ? 'รอรับเงินที่แคชเชียร์' : 'Pay at Cashier') :
                           order.status === 'verifying_payment' ? (lang === 'th' ? 'รอตรวจสอบชำระเงิน' : 'Verifying Payment') :
                           order.status === 'pending' ? t('orders', 'pending', lang) :
                           order.status === 'confirmed' ? t('orders', 'confirmed', lang) :
                           order.status === 'preparing' ? t('orders', 'preparing', lang) :
                           order.status === 'ready' ? t('orders', 'ready', lang) :
                           order.status === 'completed' ? (lang === 'th' ? 'เสิร์ฟแล้ว' : 'Served') : order.status}
                        </span>
                        {['cash_at_cashier', 'cashier_cash', 'cashier_eftpos'].includes(order.payment_method || '') && order.payment_status !== 'paid' && order.status !== 'awaiting_cashier_payment' && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 ml-1">
                            {lang === 'th' ? 'ยังไม่จ่าย' : 'Unpaid'}
                          </span>
                        )}
                        {order.customer_name && (
                          <p className="text-sm text-slate-400 mt-1">{order.customer_name}</p>
                        )}
                        {order.customer_details?.name && !order.customer_name && (
                          <p className="text-sm text-slate-400 mt-1">{order.customer_details.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${themeClasses.textPrimary}`}>${order.total_price?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-slate-400">{getTimeSince(order.created_at)}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 md:p-4 space-y-2 max-h-48 md:max-h-60 overflow-y-auto">
                    {order.items.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 bg-slate-700 rounded flex items-center justify-center text-sm md:text-base font-semibold">
                            {item.quantity}
                          </span>
                          <span className="flex-1 text-sm md:text-base">
                            {translatedTexts[`item_name_${item.menu_id || `${order.id}_${idx}`}`] || item.name}
                            {item.nameEn && (
                              <span className="text-slate-400 text-xs ml-1">({item.nameEn})</span>
                            )}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-yellow-500 ml-8 mt-1">
                            📝 {translatedTexts[`order_${order.id}_item_${idx}_notes`] || item.notes}
                            {translatedTexts[`order_${order.id}_item_${idx}_notes`] && translatedTexts[`order_${order.id}_item_${idx}_notes`] !== item.notes && (
                              <span className="text-gray-500 ml-1">({item.notes})</span>
                            )}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Special Instructions */}
                  {order.special_instructions && (
                    <div className="px-4 py-2 bg-yellow-500/20 border-t border-yellow-500/30">
                      <p className="text-sm text-yellow-400">
                        ⚠️ {translatedTexts[`order_${order.id}_instructions`] || order.special_instructions}
                      </p>
                      {translatedTexts[`order_${order.id}_instructions`] && translatedTexts[`order_${order.id}_instructions`] !== order.special_instructions && (
                        <p className="text-xs text-gray-500 mt-1">
                          (Original: {order.special_instructions})
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-3 bg-slate-700/30 flex gap-2 flex-wrap">
                    {/* Preview Button */}
                    <button
                      onClick={() => openPrintPreview(order)}
                      className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold flex items-center justify-center gap-1"
                      title={lang === 'th' ? 'ดูรายละเอียด' : 'Preview'}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {/* Print Button */}
                    <button
                      onClick={() => printOrder(order)}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold flex items-center justify-center gap-1"
                      title={lang === 'th' ? 'พิมพ์' : 'Print'}
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                    {/* Void Button */}
                    <button
                      onClick={() => openVoidModal(order)}
                      className="px-3 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-semibold flex items-center justify-center gap-1"
                      title={lang === 'th' ? 'ยกเลิกออเดอร์' : 'Void'}
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    {/* Verify Payment Button - for pending_payment orders */}
                    {order.status === 'pending_payment' && (
                      <button
                        onClick={() => openPaymentModal(order)}
                        className={`flex-1 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold flex items-center justify-center gap-2`}
                      >
                        <Eye className="w-5 h-5" />
                        {lang === 'th' ? 'ตรวจสอบการชำระเงิน' : 'Verify Payment'}
                      </button>
                    )}
                    {/* Verify & Confirm Payment Button - for verifying_payment orders */}
                    {order.status === 'verifying_payment' && (
                      <button
                        onClick={() => openPaymentModal(order)}
                        className={`flex-1 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold flex items-center justify-center gap-2`}
                      >
                        <Eye className="w-5 h-5" />
                        {lang === 'th' ? 'ตรวจสอบ & ยืนยัน' : 'Verify & Confirm'}
                      </button>
                    )}
                    {/* Confirm Cashier Payment Button - for awaiting_cashier_payment orders */}
                    {order.status === 'awaiting_cashier_payment' && (
                      <button
                        onClick={() => openCashierPaymentModal(order)}
                        className={`flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-semibold flex items-center justify-center gap-2`}
                      >
                        <CheckCircle className="w-5 h-5" />
                        {lang === 'th' ? 'ยืนยันรับเงินแล้ว' : 'Confirm Payment'}
                      </button>
                    )}
                    {/* Confirm Order Button - for pending orders (already paid/verified) */}
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                        className={`flex-1 py-2 ${themeClasses.bgPrimary} ${themeClasses.bgPrimaryHover} rounded-lg font-semibold flex items-center justify-center gap-2`}
                      >
                        <CheckCircle className="w-5 h-5" />
                        {lang === 'th' ? 'ยืนยันออเดอร์' : 'Confirm Order'}
                      </button>
                    )}
                    {/* Preparing Button - for confirmed orders */}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-semibold flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {lang === 'th' ? 'กำลังทำอาหาร' : 'Preparing'}
                      </button>
                    )}
                    {/* Preparing indicator - waiting for kitchen to mark ready */}
                    {order.status === 'preparing' && (
                      <div className="flex-1 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg font-semibold flex items-center justify-center gap-2 text-yellow-400">
                        {lang === 'th' ? 'กำลังทำอาหาร...' : 'Preparing...'}
                      </div>
                    )}
                    {/* Served Button - for ready orders */}
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-semibold flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {t('orders', 'served', lang)}
                      </button>
                    )}
                    {/* Awaiting Payment Button - for completed but unpaid cashier orders */}
                    {order.status === 'completed' && ['cash_at_cashier', 'cashier_cash', 'cashier_eftpos'].includes(order.payment_method || '') && order.payment_status !== 'paid' && (
                      <button
                        onClick={() => openCashierPaymentModal(order)}
                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold flex items-center justify-center gap-2 animate-pulse"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {lang === 'th' ? 'รอจ่ายเงิน' : 'Awaiting Payment'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Service Requests Tab */
          serviceRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Bell className="w-16 h-16 mb-4" />
              <BilingualText
                category="orders"
                textKey="noRequests"
                lang={lang}
                className="items-center"
                primaryClassName="text-xl"
                englishClassName="text-sm opacity-60"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {serviceRequests.map((request) => {
                const typeInfo = getRequestTypeInfo(request.request_type);
                const Icon = typeInfo.icon;
                const isPending = request.status === 'pending';

                return (
                  <div
                    key={request.id}
                    className={`bg-slate-800 rounded-xl overflow-hidden border-l-4 ${
                      isPending ? 'border-red-500 animate-pulse' : 'border-yellow-500'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center ${typeInfo.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-semibold">{typeInfo.text}</p>
                            <p className={`text-2xl font-bold ${themeClasses.textPrimary}`}>{t('orders', 'table', lang)} {request.table_no}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isPending ? 'bg-red-500' : 'bg-yellow-500'
                          }`}>
                            {isPending ? t('orders', 'pendingAction', lang) : t('orders', 'acknowledged', lang)}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">{getTimeSince(request.created_at)}</p>
                        </div>
                      </div>

                      {request.message && (
                        <div className="p-3 bg-slate-700 rounded-lg mb-4">
                          <p className="text-sm text-slate-300">
                            {translatedTexts[`request_${request.id}_message`] || request.message}
                          </p>
                          {translatedTexts[`request_${request.id}_message`] && translatedTexts[`request_${request.id}_message`] !== request.message && (
                            <p className="text-xs text-slate-500 mt-1">
                              (Original: {request.message})
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {isPending && (
                          <button
                            onClick={() => updateRequestStatus(request.id, 'acknowledged')}
                            className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-semibold text-black"
                          >
                            {t('orders', 'acknowledge', lang)}
                          </button>
                        )}
                        <button
                          onClick={() => updateRequestStatus(request.id, 'completed')}
                          className="flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-semibold flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          {t('orders', 'complete', lang)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>

      {/* Void Order Modal */}
      {showVoidModal && voidingOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-500">
                {lang === 'th' ? 'ยกเลิกออเดอร์' : 'Void Order'}
              </h3>
              <button
                onClick={() => setShowVoidModal(false)}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-slate-400 mb-2">
                {lang === 'th' ? 'ออเดอร์:' : 'Order:'} #{voidingOrder.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-white mb-4">
                {lang === 'th' ? 'โต๊ะ:' : 'Table:'} {voidingOrder.table_no || '-'} |
                {lang === 'th' ? ' ยอดรวม:' : ' Total:'} ${voidingOrder.total_price?.toFixed(2) || '0.00'}
              </p>

              <label className="block text-sm text-slate-400 mb-2">
                {lang === 'th' ? 'เหตุผลในการยกเลิก *' : 'Void Reason *'}
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={lang === 'th' ? 'กรุณาระบุเหตุผล...' : 'Please specify reason...'}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                rows={3}
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowVoidModal(false)}
                  className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  onClick={handleVoidOrder}
                  disabled={!voidReason.trim() || voidLoading}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {voidLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {lang === 'th' ? 'ยืนยันยกเลิก' : 'Confirm Void'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printPreviewOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md md:max-w-lg w-full text-black my-4">
            <div className="p-4 border-b flex items-center justify-between bg-slate-100 rounded-t-xl">
              <h3 className="text-lg md:text-xl font-bold">
                {lang === 'th' ? 'ตัวอย่างก่อนพิมพ์' : 'Print Preview'}
              </h3>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="p-1 hover:bg-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="p-5 md:p-6 font-sans text-sm md:text-base">
              <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
                <h1 className="text-xl md:text-2xl font-bold">{restaurantDetails.name || session?.restaurantName || 'Restaurant'}</h1>
                {restaurantDetails.address && (
                  <p className="text-xs text-gray-500">{restaurantDetails.address}</p>
                )}
                {restaurantDetails.phone && (
                  <p className="text-xs text-gray-500">Tel: {restaurantDetails.phone}</p>
                )}
                {(restaurantDetails.gst_number || restaurantDetails.ird_number) && (
                  <p className="text-xs text-gray-400">
                    {restaurantDetails.gst_number && `GST: ${restaurantDetails.gst_number}`}
                    {restaurantDetails.gst_number && restaurantDetails.ird_number && ' | '}
                    {restaurantDetails.ird_number && `IRD: ${restaurantDetails.ird_number}`}
                  </p>
                )}
                <p className="text-gray-600 mt-2">TAX INVOICE</p>
              </div>

              <div className="mb-4 space-y-1">
                <p><strong>Order #:</strong> {printPreviewOrder.id.slice(0, 8).toUpperCase()}</p>
                <p><strong>Date:</strong> {new Date(printPreviewOrder.created_at).toLocaleString('en-NZ')}</p>
                <p><strong>Type:</strong> {printPreviewOrder.service_type === 'dine_in' ? 'Dine In' : printPreviewOrder.service_type === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                {printPreviewOrder.table_no && <p><strong>Table:</strong> {printPreviewOrder.table_no}</p>}
                {(printPreviewOrder.customer_name || printPreviewOrder.customer_details?.name) && (
                  <p><strong>Customer:</strong> {printPreviewOrder.customer_name || printPreviewOrder.customer_details?.name}</p>
                )}
              </div>

              <div className="border-t border-b border-dashed border-gray-400 py-4 my-4">
                {printPreviewOrder.items.map((item, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="flex justify-between">
                      <span>{item.quantity}x {translatedTexts[`item_name_${item.menu_id || ''}`] || item.name}{item.nameEn ? ` (${item.nameEn})` : ''}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.selectedMeat && (
                      <p className="text-xs text-gray-600 ml-4">+ {item.selectedMeat}</p>
                    )}
                    {item.selectedAddOns?.length ? (
                      <p className="text-xs text-gray-600 ml-4">+ {item.selectedAddOns.join(', ')}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {printPreviewOrder.special_instructions && (
                <div className="bg-gray-100 p-2 rounded mb-4 italic text-sm">
                  Note: {printPreviewOrder.special_instructions}
                </div>
              )}

              <div className="text-right text-lg font-bold">
                Total: ${printPreviewOrder.total_price?.toFixed(2) || '0.00'}
              </div>

              <div className="text-center mt-6 text-xs text-gray-500">
                <p>Thank you for your order!</p>
                <p>Powered by SweetAsMenu</p>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-100 rounded-b-xl">
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => {
                    printOrder(printPreviewOrder, false);
                    setShowPrintPreview(false);
                  }}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Printer className="w-5 h-5" />
                  {lang === 'th' ? 'พิมพ์ต้นฉบับ' : 'Print Original'}
                </button>
                <button
                  onClick={() => {
                    printOrder(printPreviewOrder, true);
                    setShowPrintPreview(false);
                  }}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Printer className="w-5 h-5" />
                  {lang === 'th' ? 'พิมพ์สำเนา' : 'Print Copy'}
                </button>
              </div>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="w-full py-3 bg-slate-300 hover:bg-slate-400 rounded-lg font-semibold text-black text-sm md:text-base"
              >
                {lang === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Verification Modal */}
      {showPaymentModal && paymentModalOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full my-4">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-purple-400">
                {lang === 'th' ? 'ตรวจสอบการชำระเงิน' : 'Verify Payment'}
              </h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentModalOrder(null);
                }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Order Info */}
              <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-slate-400 text-sm">{lang === 'th' ? 'ออเดอร์' : 'Order'}</p>
                    <p className="text-lg font-bold">#{paymentModalOrder.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">{lang === 'th' ? 'ยอดรวม' : 'Total'}</p>
                    <p className="text-lg font-bold text-green-400">${paymentModalOrder.total_price?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>
                    {paymentModalOrder.service_type === 'dine_in'
                      ? `${lang === 'th' ? 'โต๊ะ' : 'Table'} ${paymentModalOrder.table_no}`
                      : paymentModalOrder.service_type === 'pickup'
                        ? (lang === 'th' ? 'รับเอง' : 'Pickup')
                        : (lang === 'th' ? 'จัดส่ง' : 'Delivery')}
                  </span>
                  {(paymentModalOrder.customer_name || paymentModalOrder.customer_details?.name) && (
                    <span>• {paymentModalOrder.customer_name || paymentModalOrder.customer_details?.name}</span>
                  )}
                </div>
              </div>

              {/* Payment Method Info */}
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-2">{lang === 'th' ? 'วิธีการชำระเงิน' : 'Payment Method'}</p>
                <div className={`p-4 rounded-lg border-2 ${
                  paymentModalOrder.payment_method === 'card'
                    ? 'bg-blue-500/10 border-blue-500'
                    : paymentModalOrder.payment_method === 'bank_transfer'
                      ? 'bg-green-500/10 border-green-500'
                      : 'bg-slate-700 border-slate-600'
                }`}>
                  <div className="flex items-center gap-3">
                    {paymentModalOrder.payment_method === 'card' ? (
                      <>
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-xl">💳</span>
                        </div>
                        <div>
                          <p className="font-semibold">{lang === 'th' ? 'บัตรเครดิต/เดบิต (Stripe)' : 'Card Payment (Stripe)'}</p>
                          <p className="text-sm text-slate-400">Apple Pay / Google Pay / Card</p>
                        </div>
                      </>
                    ) : paymentModalOrder.payment_method === 'bank_transfer' ? (
                      <>
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-xl">🏦</span>
                        </div>
                        <div>
                          <p className="font-semibold">{lang === 'th' ? 'โอนเงินผ่านธนาคาร' : 'Bank Transfer'}</p>
                          <p className="text-sm text-slate-400">{lang === 'th' ? 'ต้องตรวจสอบสลิป' : 'Requires slip verification'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                          <span className="text-xl">💵</span>
                        </div>
                        <div>
                          <p className="font-semibold">{lang === 'th' ? 'ไม่ทราบวิธีการชำระเงิน' : 'Unknown Payment Method'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stripe Payment Status */}
              {paymentModalOrder.payment_method === 'card' && (
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-2">{lang === 'th' ? 'สถานะการชำระเงิน Stripe' : 'Stripe Payment Status'}</p>
                  <div className={`p-4 rounded-lg ${
                    stripePaymentStatus === 'loading' ? 'bg-slate-700' :
                    stripePaymentStatus === 'succeeded' ? 'bg-green-500/20 border-2 border-green-500' :
                    stripePaymentStatus === 'failed' ? 'bg-red-500/20 border-2 border-red-500' :
                    stripePaymentStatus === 'pending' ? 'bg-yellow-500/20 border-2 border-yellow-500' :
                    'bg-slate-700 border-2 border-slate-600'
                  }`}>
                    {stripePaymentStatus === 'loading' ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        <span>{lang === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...'}</span>
                      </div>
                    ) : stripePaymentStatus === 'succeeded' ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <div>
                          <p className="font-bold text-green-500">{lang === 'th' ? 'ชำระเงินสำเร็จ' : 'Payment Successful'}</p>
                          <p className="text-sm text-slate-400">{lang === 'th' ? 'ได้รับเงินเรียบร้อยแล้ว' : 'Payment has been received'}</p>
                        </div>
                      </div>
                    ) : stripePaymentStatus === 'failed' ? (
                      <div className="flex items-center gap-3">
                        <XCircle className="w-8 h-8 text-red-500" />
                        <div>
                          <p className="font-bold text-red-500">{lang === 'th' ? 'ชำระเงินไม่สำเร็จ' : 'Payment Failed'}</p>
                          <p className="text-sm text-slate-400">{lang === 'th' ? 'การชำระเงินถูกปฏิเสธ' : 'Payment was declined'}</p>
                        </div>
                      </div>
                    ) : stripePaymentStatus === 'pending' ? (
                      <div className="flex items-center gap-3">
                        <Clock className="w-8 h-8 text-yellow-500" />
                        <div>
                          <p className="font-bold text-yellow-500">{lang === 'th' ? 'กำลังดำเนินการ' : 'Processing'}</p>
                          <p className="text-sm text-slate-400">{lang === 'th' ? 'รอการยืนยันจาก Stripe' : 'Awaiting confirmation from Stripe'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-slate-400" />
                        <div>
                          <p className="font-bold text-slate-400">{lang === 'th' ? 'ไม่ทราบสถานะ' : 'Unknown Status'}</p>
                          <p className="text-sm text-slate-500">{lang === 'th' ? 'ไม่สามารถตรวจสอบได้' : 'Unable to verify'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bank Transfer Slip */}
              {paymentModalOrder.payment_method === 'bank_transfer' && (
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-2">{lang === 'th' ? 'สลิปการโอนเงิน' : 'Transfer Slip'}</p>
                  {paymentModalOrder.payment_slip_url ? (
                    <div className="bg-slate-700 rounded-lg p-2">
                      <img
                        src={paymentModalOrder.payment_slip_url}
                        alt="Payment Slip"
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(paymentModalOrder.payment_slip_url, '_blank')}
                      />
                      <p className="text-xs text-slate-500 text-center mt-2">
                        {lang === 'th' ? 'คลิกเพื่อขยายภาพ' : 'Click to enlarge'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 text-center">
                      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">{lang === 'th' ? 'ไม่พบสลิป' : 'No Slip Found'}</p>
                      <p className="text-sm text-slate-400">{lang === 'th' ? 'ลูกค้าไม่ได้แนบสลิปการโอนเงิน' : 'Customer did not upload a transfer slip'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={rejectPayment}
                  disabled={paymentVerifyLoading}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  {paymentVerifyLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {lang === 'th' ? 'ปฏิเสธ' : 'Reject'}
                </button>
                <button
                  onClick={confirmPayment}
                  disabled={paymentVerifyLoading || (paymentModalOrder.payment_method === 'card' && stripePaymentStatus === 'failed')}
                  className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                    (paymentModalOrder.payment_method === 'card' && stripePaymentStatus === 'succeeded')
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-purple-500 hover:bg-purple-600'
                  } disabled:opacity-50`}
                >
                  {paymentVerifyLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {lang === 'th' ? 'ยืนยัน - ส่งไปครัว' : 'Confirm - Send to Kitchen'}
                </button>
              </div>

              {/* Warning for card payments that failed */}
              {paymentModalOrder.payment_method === 'card' && stripePaymentStatus === 'failed' && (
                <p className="text-xs text-red-400 text-center mt-3">
                  {lang === 'th'
                    ? '⚠️ การชำระเงินล้มเหลว ไม่สามารถยืนยันออเดอร์นี้ได้'
                    : '⚠️ Payment failed. Cannot confirm this order.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cashier Payment Confirmation Modal - Select Cash or EFTPOS */}
      {showCashierPaymentModal && cashierPaymentOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-400">
                {lang === 'th' ? 'ยืนยันการชำระเงิน' : 'Confirm Payment'}
              </h3>
              <button
                onClick={() => {
                  setShowCashierPaymentModal(false);
                  setCashierPaymentOrder(null);
                }}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Order Info */}
              <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-slate-400 text-sm">{lang === 'th' ? 'ออเดอร์' : 'Order'}</p>
                    <p className="text-lg font-bold">#{cashierPaymentOrder.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">{lang === 'th' ? 'ยอดรวม' : 'Total'}</p>
                    <p className="text-lg font-bold text-green-400">${cashierPaymentOrder.total_price?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>
                    {cashierPaymentOrder.table_no
                      ? `${lang === 'th' ? 'โต๊ะ' : 'Table'} ${cashierPaymentOrder.table_no}`
                      : (cashierPaymentOrder.customer_name || cashierPaymentOrder.customer_details?.name || '-')}
                  </span>
                </div>
              </div>

              {/* Payment Type Selection */}
              <div className="mb-4">
                <p className="text-sm text-slate-400 mb-3">{lang === 'th' ? 'ลูกค้าจ่ายด้วย:' : 'Customer paid with:'}</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cash Button */}
                  <button
                    onClick={() => confirmCashierPayment(cashierPaymentOrder.id, 'cashier_cash')}
                    disabled={cashierPaymentLoading}
                    className="p-4 bg-green-500/20 border-2 border-green-500 rounded-xl hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl">💵</span>
                      </div>
                      <p className="font-bold text-green-400">{lang === 'th' ? 'เงินสด' : 'Cash'}</p>
                    </div>
                  </button>

                  {/* EFTPOS Button */}
                  <button
                    onClick={() => confirmCashierPayment(cashierPaymentOrder.id, 'cashier_eftpos')}
                    disabled={cashierPaymentLoading}
                    className="p-4 bg-blue-500/20 border-2 border-blue-500 rounded-xl hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-2xl">💳</span>
                      </div>
                      <p className="font-bold text-blue-400">EFTPOS</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Loading indicator */}
              {cashierPaymentLoading && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  <span className="ml-2 text-slate-400">{lang === 'th' ? 'กำลังดำเนินการ...' : 'Processing...'}</span>
                </div>
              )}

              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowCashierPaymentModal(false);
                  setCashierPaymentOrder(null);
                }}
                disabled={cashierPaymentLoading}
                className="w-full mt-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold disabled:opacity-50"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
