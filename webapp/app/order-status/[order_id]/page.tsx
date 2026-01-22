'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
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
  Store,
  ArrowLeft
} from 'lucide-react';

// Bilingual translations for order status page
const translations: Record<string, Record<string, Record<string, string>>> = {
  header: {
    orderStatus: { en: 'Order Status', th: 'สถานะออเดอร์', ko: '주문 상태', zh: '订单状态', ja: '注文状況' },
    orderNumber: { en: 'Order', th: 'ออเดอร์', ko: '주문', zh: '订单', ja: '注文' },
  },
  status: {
    awaitingPayment: { en: 'Awaiting Payment', th: 'รอชำระเงิน', ko: '결제 대기 중', zh: '等待付款', ja: '支払い待ち' },
    awaitingPaymentDesc: { en: 'Please complete your payment to confirm the order', th: 'กรุณาชำระเงินเพื่อยืนยันออเดอร์', ko: '주문을 확인하려면 결제를 완료해주세요', zh: '请完成付款以确认订单', ja: 'ご注文を確定するには、お支払いを完了してください' },
    verifyingPayment: { en: 'Verifying Payment', th: 'กำลังตรวจสอบการชำระเงิน', ko: '결제 확인 중', zh: '正在验证付款', ja: '支払い確認中' },
    verifyingPaymentDesc: { en: 'Your payment slip has been submitted and is being verified', th: 'สลิปของคุณถูกส่งแล้วและกำลังตรวจสอบ', ko: '결제 영수증이 제출되었으며 확인 중입니다', zh: '您的付款凭证已提交，正在验证中', ja: '支払い明細が提出され、確認中です' },
    paymentRejected: { en: 'Payment Rejected', th: 'การชำระเงินถูกปฏิเสธ', ko: '결제 거부됨', zh: '付款被拒绝', ja: '支払いが拒否されました' },
    paymentRejectedDesc: { en: 'Your payment could not be verified. Please contact the restaurant.', th: 'ไม่สามารถตรวจสอบการชำระเงินได้ กรุณาติดต่อร้านอาหาร', ko: '결제를 확인할 수 없습니다. 레스토랑에 문의해주세요.', zh: '无法验证您的付款。请联系餐厅。', ja: 'お支払いを確認できませんでした。レストランにお問い合わせください。' },
    orderSent: { en: 'Order Sent', th: 'ส่งออเดอร์แล้ว', ko: '주문 전송됨', zh: '订单已发送', ja: '注文送信済み' },
    orderSentDesc: { en: 'Your order has been sent to the restaurant', th: 'ออเดอร์ของคุณถูกส่งไปยังร้านแล้ว', ko: '주문이 레스토랑으로 전송되었습니다', zh: '您的订单已发送至餐厅', ja: 'ご注文がレストランに送信されました' },
    confirmed: { en: 'Confirmed', th: 'ยืนยันแล้ว', ko: '확인됨', zh: '已确认', ja: '確認済み' },
    confirmedDesc: { en: 'Your order has been confirmed', th: 'ออเดอร์ของคุณได้รับการยืนยันแล้ว', ko: '주문이 확인되었습니다', zh: '您的订单已确认', ja: 'ご注文が確認されました' },
    preparing: { en: 'Preparing', th: 'กำลังเตรียม', ko: '준비 중', zh: '准备中', ja: '準備中' },
    preparingDesc: { en: 'The kitchen is preparing your order', th: 'ครัวกำลังเตรียมอาหารของคุณ', ko: '주방에서 주문을 준비 중입니다', zh: '厨房正在准备您的订单', ja: 'キッチンで準備中です' },
    ready: { en: 'Ready', th: 'พร้อมแล้ว', ko: '준비 완료', zh: '准备就绪', ja: '準備完了' },
    readyDesc: { en: 'Your order is ready!', th: 'อาหารของคุณพร้อมแล้ว!', ko: '주문이 준비되었습니다!', zh: '您的订单已准备好！', ja: 'ご注文の準備ができました！' },
    completed: { en: 'Completed', th: 'เสร็จสิ้น', ko: '완료됨', zh: '已完成', ja: '完了' },
    completedDesc: { en: 'Your order has been completed. Thank you!', th: 'ออเดอร์ของคุณเสร็จสิ้นแล้ว ขอบคุณค่ะ!', ko: '주문이 완료되었습니다. 감사합니다!', zh: '您的订单已完成。谢谢！', ja: 'ご注文が完了しました。ありがとうございます！' },
    cancelled: { en: 'Cancelled', th: 'ยกเลิกแล้ว', ko: '취소됨', zh: '已取消', ja: 'キャンセル済み' },
    cancelledDesc: { en: 'This order has been cancelled', th: 'ออเดอร์นี้ถูกยกเลิกแล้ว', ko: '이 주문은 취소되었습니다', zh: '此订单已取消', ja: 'この注文はキャンセルされました' },
  },
  serviceType: {
    dineIn: { en: 'Dine-In', th: 'ทานที่ร้าน', ko: '매장 식사', zh: '堂食', ja: '店内飲食' },
    pickup: { en: 'Pickup', th: 'รับที่ร้าน', ko: '픽업', zh: '自取', ja: 'テイクアウト' },
    delivery: { en: 'Delivery', th: 'จัดส่ง', ko: '배달', zh: '外卖', ja: '配達' },
  },
  labels: {
    tableNumber: { en: 'Table Number', th: 'หมายเลขโต๊ะ', ko: '테이블 번호', zh: '桌号', ja: 'テーブル番号' },
    name: { en: 'Name', th: 'ชื่อ', ko: '이름', zh: '姓名', ja: '名前' },
    phone: { en: 'Phone', th: 'โทรศัพท์', ko: '전화', zh: '电话', ja: '電話' },
    pickupTime: { en: 'Pickup Time', th: 'เวลารับ', ko: '픽업 시간', zh: '取餐时间', ja: '受取時間' },
    deliveryAddress: { en: 'Delivery Address', th: 'ที่อยู่จัดส่ง', ko: '배달 주소', zh: '送餐地址', ja: '配達先' },
    orderItems: { en: 'Order Items', th: 'รายการอาหาร', ko: '주문 항목', zh: '订单项目', ja: '注文内容' },
    meat: { en: 'Meat', th: 'เนื้อ', ko: '고기', zh: '肉类', ja: '肉' },
    addOns: { en: 'Add-ons', th: 'เพิ่มเติม', ko: '추가', zh: '附加', ja: '追加' },
    note: { en: 'Note', th: 'หมายเหตุ', ko: '메모', zh: '备注', ja: 'メモ' },
    specialInstructions: { en: 'Special Instructions', th: 'คำแนะนำพิเศษ', ko: '특별 지시', zh: '特殊说明', ja: '特別な指示' },
    subtotal: { en: 'Subtotal', th: 'ยอดรวม', ko: '소계', zh: '小计', ja: '小計' },
    deliveryFee: { en: 'Delivery Fee', th: 'ค่าจัดส่ง', ko: '배달비', zh: '配送费', ja: '配達料' },
    total: { en: 'Total', th: 'รวมทั้งหมด', ko: '합계', zh: '总计', ja: '合計' },
    inclGST: { en: 'Incl. GST (15%)', th: 'รวม GST (15%)', ko: 'GST 포함 (15%)', zh: '含GST (15%)', ja: 'GST込み (15%)' },
    orderTimeline: { en: 'Order Timeline', th: 'ไทม์ไลน์ออเดอร์', ko: '주문 타임라인', zh: '订单时间线', ja: '注文タイムライン' },
    orderReceived: { en: 'Order Received', th: 'ได้รับออเดอร์', ko: '주문 접수', zh: '订单已接收', ja: '注文受付' },
    confirmedBy: { en: 'Confirmed by restaurant', th: 'ร้านยืนยันแล้ว', ko: '레스토랑 확인', zh: '餐厅已确认', ja: 'レストラン確認済み' },
    kitchenWorking: { en: 'Kitchen is working on your order', th: 'ครัวกำลังทำอาหาร', ko: '주방에서 준비 중', zh: '厨房正在准备', ja: 'キッチンで準備中' },
    kitchenEstimate: { en: 'Kitchen estimate', th: 'เวลาประมาณ', ko: '예상 시간', zh: '预计时间', ja: '予想時間' },
    readyForPickup: { en: 'Ready for Pickup', th: 'พร้อมรับอาหาร', ko: '픽업 준비 완료', zh: '可以取餐', ja: '受取準備完了' },
    yourOrderReady: { en: 'Your order is ready!', th: 'อาหารพร้อมแล้ว!', ko: '주문 준비 완료!', zh: '您的餐点已准备好！', ja: 'ご注文の準備ができました！' },
    updatesAutomatically: { en: 'Updates automatically', th: 'อัพเดทอัตโนมัติ', ko: '자동 업데이트', zh: '自动更新', ja: '自動更新' },
    estimatedTime: { en: 'Estimated time', th: 'เวลาประมาณ', ko: '예상 시간', zh: '预计时间', ja: '予想時間' },
    minutes: { en: 'minutes', th: 'นาที', ko: '분', zh: '分钟', ja: '分' },
    almostReady: { en: 'Almost ready!', th: 'ใกล้เสร็จแล้ว!', ko: '거의 완료!', zh: '即将完成！', ja: 'もうすぐです！' },
    placedOn: { en: 'Placed on', th: 'สั่งเมื่อ', ko: '주문일', zh: '下单时间', ja: '注文日時' },
  },
  buttons: {
    backToMenu: { en: 'Back to Menu', th: 'กลับไปเมนู', ko: '메뉴로 돌아가기', zh: '返回菜单', ja: 'メニューに戻る' },
    goHome: { en: 'Go Home', th: 'กลับหน้าแรก', ko: '홈으로', zh: '回到首页', ja: 'ホームへ' },
  },
  errors: {
    orderNotFound: { en: 'Order Not Found', th: 'ไม่พบออเดอร์', ko: '주문을 찾을 수 없음', zh: '未找到订单', ja: '注文が見つかりません' },
    orderNotFoundDesc: { en: 'The order you are looking for does not exist.', th: 'ไม่พบออเดอร์ที่คุณกำลังค้นหา', ko: '찾으시는 주문이 존재하지 않습니다.', zh: '您查找的订单不存在。', ja: 'お探しの注文は存在しません。' },
    loadingOrder: { en: 'Loading order status...', th: 'กำลังโหลดสถานะออเดอร์...', ko: '주문 상태 로딩 중...', zh: '正在加载订单状态...', ja: '注文状況を読み込み中...' },
  },
};

// Helper function to get translation
const t = (category: string, key: string, lang: string): string => {
  const langCode = lang === 'original' ? 'en' : lang;
  return translations[category]?.[key]?.[langCode] || translations[category]?.[key]?.['en'] || key;
};

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
  const searchParams = useSearchParams();
  const order_id = params.order_id as string;

  // Get language and restaurant from URL params
  const lang = searchParams.get('lang') || 'en';
  const restaurantSlug = searchParams.get('restaurant') || '';

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
        setEstimatedTime(`${t('labels', 'almostReady', lang)} 🔥`);
      } else {
        setEstimatedTime(`~${remaining} ${t('labels', 'minutes', lang)}`);
      }
      return;
    }

    // Default to 15-30 minutes until kitchen updates
    switch (order.status) {
      case 'pending':
      case 'pending_payment':
      case 'confirmed':
        setEstimatedTime(`15-30 ${t('labels', 'minutes', lang)}`);
        return;
      case 'preparing':
        setEstimatedTime(`10-20 ${t('labels', 'minutes', lang)}`);
        return;
      case 'ready':
        setEstimatedTime(`${t('status', 'ready', lang)}! 🎉`);
        return;
      case 'completed':
        setEstimatedTime(`${t('status', 'completed', lang)} ✓`);
        return;
      case 'cancelled':
        setEstimatedTime(t('status', 'cancelled', lang));
        return;
      default:
        setEstimatedTime(`15-30 ${t('labels', 'minutes', lang)}`);
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
        text: t('status', 'verifyingPayment', lang),
        description: t('status', 'verifyingPaymentDesc', lang),
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300'
      };
    }

    // Special case: cancelled due to payment rejection
    if (status === 'cancelled' && orderData.cancel_reason === 'payment_rejected') {
      return {
        icon: <XCircle className="w-6 h-6" />,
        text: t('status', 'paymentRejected', lang),
        description: t('status', 'paymentRejectedDesc', lang),
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300'
      };
    }

    switch (status) {
      case 'pending_payment':
        return {
          icon: <Clock className="w-6 h-6" />,
          text: t('status', 'awaitingPayment', lang),
          description: t('status', 'awaitingPaymentDesc', lang),
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300'
        };
      case 'pending':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          text: t('status', 'orderSent', lang),
          description: t('status', 'orderSentDesc', lang),
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          text: t('status', 'confirmed', lang),
          description: t('status', 'confirmedDesc', lang),
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-300'
        };
      case 'preparing':
        return {
          icon: <Utensils className="w-6 h-6" />,
          text: t('status', 'preparing', lang),
          description: t('status', 'preparingDesc', lang),
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-300'
        };
      case 'ready':
        return {
          icon: <Package className="w-6 h-6" />,
          text: t('labels', 'readyForPickup', lang),
          description: t('status', 'readyDesc', lang),
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-6 h-6" />,
          text: t('status', 'completed', lang),
          description: t('status', 'completedDesc', lang),
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-6 h-6" />,
          text: t('status', 'cancelled', lang),
          description: t('status', 'cancelledDesc', lang),
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

  // Build the menu URL for back navigation
  const menuUrl = restaurantSlug ? `/restaurant/${restaurantSlug}` : '/';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">{t('errors', 'loadingOrder', lang)}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('errors', 'orderNotFound', lang)}</h2>
          <p className="text-gray-600 mb-6">{error || t('errors', 'orderNotFoundDesc', lang)}</p>
          <Link
            href={menuUrl}
            className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            {restaurantSlug ? t('buttons', 'backToMenu', lang) : t('buttons', 'goHome', lang)}
          </Link>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('header', 'orderStatus', lang)}</h1>
          <p className="text-gray-600">{t('header', 'orderNumber', lang)} #{order.id.slice(0, 8)}</p>
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
                  <>{t('labels', 'kitchenEstimate', lang)}: {estimatedTime}</>
                ) : (
                  <>{t('labels', 'estimatedTime', lang)}: {estimatedTime}</>
                )}
              </span>
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            {t('labels', 'placedOn', lang)} {formatTime(order.created_at)}
          </div>
          
          {/* Real-time indicator */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{t('labels', 'updatesAutomatically', lang)}</span>
          </div>
        </div>

        {/* Customer Info Card - based on service type */}
        {order.service_type && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              {order.service_type === 'dine_in' ? (
                <><Store className="w-5 h-5 text-orange-500" /> {t('serviceType', 'dineIn', lang)}</>
              ) : order.service_type === 'pickup' ? (
                <><Package className="w-5 h-5 text-blue-500" /> {t('serviceType', 'pickup', lang)}</>
              ) : (
                <><MapPin className="w-5 h-5 text-green-500" /> {t('serviceType', 'delivery', lang)}</>
              )}
            </h3>

            {/* Dine-in: Show table number */}
            {order.service_type === 'dine_in' && order.table_no && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <Store className="w-6 h-6 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-600">{t('labels', 'tableNumber', lang)}</p>
                  <p className="text-xl font-bold text-orange-600">{order.table_no}</p>
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
                      <p className="text-sm text-gray-600">{t('labels', 'name', lang)}</p>
                      <p className="font-semibold text-gray-900">{order.customer_name || order.customer_details?.name}</p>
                    </div>
                  </div>
                )}
                {(order.customer_phone || order.customer_details?.phone) && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Phone className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">{t('labels', 'phone', lang)}</p>
                      <p className="font-semibold text-gray-900">{order.customer_phone || order.customer_details?.phone}</p>
                    </div>
                  </div>
                )}
                {order.customer_details?.pickup_time && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">{t('labels', 'pickupTime', lang)}</p>
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
                      <p className="text-sm text-gray-600">{t('labels', 'name', lang)}</p>
                      <p className="font-semibold text-gray-900">{order.customer_name || order.customer_details?.name}</p>
                    </div>
                  </div>
                )}
                {(order.customer_phone || order.customer_details?.phone) && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Phone className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">{t('labels', 'phone', lang)}</p>
                      <p className="font-semibold text-gray-900">{order.customer_phone || order.customer_details?.phone}</p>
                    </div>
                  </div>
                )}
                {order.customer_details?.address && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">{t('labels', 'deliveryAddress', lang)}</p>
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
          <h3 className="text-xl font-bold text-gray-900 mb-4">{t('labels', 'orderItems', lang)}</h3>

          <div className="space-y-4 mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {item.quantity}x {item.nameEn || item.name}
                  </p>
                  {item.selectedMeat && (
                    <p className="text-sm text-gray-600">{t('labels', 'meat', lang)}: {item.selectedMeat}</p>
                  )}
                  {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                    <p className="text-sm text-gray-600">
                      {t('labels', 'addOns', lang)}: {item.selectedAddOns.join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-sm text-gray-500 italic mt-1">{t('labels', 'note', lang)}: {item.notes}</p>
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
              <p className="text-sm font-semibold text-yellow-800 mb-1">{t('labels', 'specialInstructions', lang)}:</p>
              <p className="text-sm text-yellow-700">{order.special_instructions}</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">{t('labels', 'subtotal', lang)}:</span>
              <span className="font-semibold text-gray-900">${order.subtotal.toFixed(2)}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">{t('labels', 'deliveryFee', lang)}:</span>
                <span className="font-semibold text-gray-900">${order.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-lg font-bold text-gray-900">{t('labels', 'total', lang)}:</span>
              <span className="text-2xl font-bold text-orange-500">${order.total_price.toFixed(2)} NZD</span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between items-center text-sm text-gray-500 mt-1">
                <span>{t('labels', 'inclGST', lang)}:</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">{t('labels', 'orderTimeline', lang)}</h3>
          <div className="space-y-4">
            {/* Step 1: Order Received */}
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full ${order.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                <Clock className={`w-5 h-5 ${order.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${order.status === 'pending' ? 'text-gray-900' : 'text-gray-500'}`}>
                  {t('labels', 'orderReceived', lang)}
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
                    {t('status', 'confirmed', lang)}
                  </p>
                  <p className="text-sm text-gray-500">{t('labels', 'confirmedBy', lang)}</p>
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
                    {t('status', 'preparing', lang)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.status === 'preparing' && order.estimated_minutes
                      ? `${t('labels', 'kitchenEstimate', lang)}: ~${order.estimated_minutes} ${t('labels', 'minutes', lang)}`
                      : t('labels', 'kitchenWorking', lang)}
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
                    {t('labels', 'readyForPickup', lang)}
                  </p>
                  <p className="text-sm text-gray-500">{t('labels', 'yourOrderReady', lang)}</p>
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
                  <p className="font-semibold text-gray-900">{t('status', 'completed', lang)}</p>
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
          <Link
            href={menuUrl}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            {restaurantSlug ? t('buttons', 'backToMenu', lang) : t('buttons', 'goHome', lang)}
          </Link>
        </div>
      </div>
    </div>
  );
}

