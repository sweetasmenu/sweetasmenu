'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Download,
  Share2,
  Loader2,
  Copy,
  Check,
  Printer,
  QrCode
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase/client';
import html2canvas from 'html2canvas';

// Dynamic import for QR code (no SSR)
const QRCodeSVG = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded-xl" />
});

// Translation mapping for "Scan to Order"
const scanToOrderTranslations: Record<string, string> = {
  'en': 'Scan to Order',
  'th': 'สแกนเพื่อสั่งอาหาร',
  'zh': '扫码点餐',
  'zh-CN': '扫码点餐',
  'zh-TW': '掃碼點餐',
  'ja': '注文するにはスキャン',
  'ko': '주문하려면 스캔',
  'vi': 'Quét để đặt hàng',
  'ms': 'Imbas untuk Pesan',
  'id': 'Pindai untuk Pesan',
  'fr': 'Scanner pour commander',
  'de': 'Scannen zum Bestellen',
  'es': 'Escanear para ordenar',
  'pt': 'Escaneie para pedir',
  'it': 'Scansiona per ordinare',
  'ar': 'امسح للطلب',
  'hi': 'ऑर्डर करने के लिए स्कैन करें',
};

interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  theme_color?: string;
  primary_language?: string;
}

export default function RestaurantQRCodePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>('default');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const stickerRef = useRef<HTMLDivElement>(null);

  const publicMenuUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/restaurant/${restaurantId}`
    : '';

  // Get theme color with fallback
  const themeColor = restaurant?.theme_color || '#f97316'; // Default orange

  // Get translated "Scan to Order" text
  const primaryLanguage = restaurant?.primary_language || 'en';
  const scanToOrderText = scanToOrderTranslations[primaryLanguage] || scanToOrderTranslations['en'];
  const showEnglishFallback = primaryLanguage !== 'en';

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      // Check localStorage for selected restaurant (for multi-branch support)
      const savedRestaurantId = localStorage.getItem(`selected_restaurant_${session.user.id}`);

      // Fetch real restaurant data from user profile
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        // If there's a saved selection, use it; otherwise fetch from profile
        const targetRestaurantId = savedRestaurantId || '';
        const url = targetRestaurantId
          ? `${API_URL}/api/user/profile?user_id=${session.user.id}&restaurant_id=${targetRestaurantId}`
          : `${API_URL}/api/user/profile?user_id=${session.user.id}`;

        const profileResponse = await fetch(url);

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.success && profileData.restaurant) {
            const restaurantData = profileData.restaurant;
            // Use slug if available, otherwise fallback to restaurant_id
            const identifier = restaurantData.slug || restaurantData.restaurant_id;
            if (identifier) {
              setRestaurantId(identifier);
            }

            // Set full restaurant data
            setRestaurant({
              id: restaurantData.restaurant_id,
              name: restaurantData.name || 'My Restaurant',
              slug: restaurantData.slug,
              logo_url: restaurantData.logo_url,
              theme_color: restaurantData.theme_color,
              primary_language: restaurantData.primary_language,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch restaurant data:', error);
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicMenuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = async () => {
    if (!stickerRef.current) return;

    setDownloading(true);

    try {
      // Use html2canvas to capture the sticker element
      // @ts-ignore - html2canvas types are incomplete
      const canvas = await html2canvas(stickerRef.current, {
        scale: 3, // High quality for printing
        backgroundColor: '#ffffff',
        useCORS: true, // Allow cross-origin images (for logo)
        allowTaint: true,
        logging: false,
      } as any);

      const link = document.createElement('a');
      const restaurantName = restaurant?.name?.replace(/\s+/g, '-').toLowerCase() || 'restaurant';
      link.download = `${restaurantName}-qr-sticker.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('Failed to download QR sticker:', err);
      // Fallback to simple QR download
      if (qrRef.current) {
        const svg = qrRef.current.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new window.Image();

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);

            const link = document.createElement('a');
            link.download = 'restaurant-menu-qr.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          };

          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Restaurant Menu',
          text: 'Scan this QR code to view our menu and order!',
          url: publicMenuUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <Link
          href="/menus"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Menu
        </Link>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              QR Code Sticker
            </h1>
            <p className="text-gray-600">
              Download or print this sticker to place on your tables
            </p>
          </div>

          {/* QR Code Sticker Preview */}
          <div className="flex justify-center mb-8">
            <div
              ref={stickerRef}
              className="bg-white rounded-3xl overflow-hidden"
              style={{
                width: '320px',
                border: `8px solid ${themeColor}`,
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }}
            >
              {/* Sticker Content */}
              <div className="p-6">
                {/* QR Code */}
                <div
                  ref={qrRef}
                  className="flex justify-center mb-4"
                >
                  <div className="bg-white p-3 rounded-2xl">
                    <QRCodeSVG
                      value={publicMenuUrl}
                      size={220}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                  </div>
                </div>

                {/* Bottom Section */}
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: themeColor }}
                >
                  <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      {restaurant?.logo_url ? (
                        <div className="w-14 h-14 rounded-full bg-white overflow-hidden flex items-center justify-center shadow-md">
                          <Image
                            src={restaurant.logo_url}
                            alt={restaurant.name || 'Restaurant Logo'}
                            width={56}
                            height={56}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-md">
                          <QrCode className="w-7 h-7 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-white">
                      {showEnglishFallback && (
                        <p className="text-sm font-medium opacity-90">
                          Scan to Order
                        </p>
                      )}
                      <p className={`font-bold ${showEnglishFallback ? 'text-lg' : 'text-xl'}`}>
                        {scanToOrderText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Menu URL */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-8">
            <p className="text-sm font-semibold text-gray-700 mb-2">Menu URL:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={publicMenuUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 truncate"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-semibold transition-colors"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Sticker
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>

            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              <Share2 className="w-5 h-5" />
              Share
            </button>
          </div>

          {/* Preview Link */}
          <div className="mt-8 pt-8 border-t border-gray-200 text-center">
            <Link
              href={`/restaurant/${restaurantId}`}
              target="_blank"
              className="inline-flex items-center text-orange-500 hover:text-orange-600 font-semibold"
            >
              View Menu →
            </Link>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3">📱 How to use this QR sticker:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click &quot;Download Sticker&quot; to save the high-quality image</li>
            <li>Print on sticker paper or laminate for durability</li>
            <li>Place on tables, entrance, or menu boards</li>
            <li>Customers scan with their phone camera to view your menu</li>
            <li>No app download required - works with any smartphone!</li>
          </ol>
        </div>

        {/* Customization Note */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-900 mb-2">🎨 Customize your sticker:</h3>
          <p className="text-sm text-amber-800">
            The sticker color matches your restaurant&apos;s theme color. You can change it in{' '}
            <Link href="/settings" className="underline font-medium hover:text-amber-900">
              Settings → Restaurant Theme Color
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
