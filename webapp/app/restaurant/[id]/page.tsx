'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Utensils, ShoppingCart, Plus, Minus, X, CheckCircle, MapPin, Clock, Store, Globe, Languages, MessageCircle, Bell, UtensilsCrossed, Droplets, Receipt, HelpCircle, Send, Check, Pencil, ClipboardList } from 'lucide-react';
import ClassicList from './templates/ClassicList';
import GridView from './templates/GridView';
import MagazineStyle from './templates/MagazineStyle';
import Elegant from './templates/Elegant';
import Casual from './templates/Casual';
import MobileMenuSection from './templates/MobileMenuSection';
import { dt, DashboardLanguage, dashboardTranslations } from '@/lib/dashboard-translations';

interface MenuItem {
  menu_id: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  price: string;
  category: string;
  categoryEn?: string;
  photo_url?: string;
  is_best_seller?: boolean;
  meats?: Array<{name: string; nameEn?: string; price: string}>;
  addOns?: Array<{name: string; nameEn?: string; price: string}>;
}

interface CartItem {
  menu_id: string;
  name: string;
  nameEn?: string;
  price: number;
  quantity: number;
  selectedMeat?: string;
  selectedAddOns?: string[];
  notes?: string;
}

interface DeliveryRate {
  id: string;
  distance_km: number;
  price: number;
}

interface DeliverySettings {
  pricing_mode: 'tier' | 'per_km';
  price_per_km: number;
  base_fee: number;
  max_distance_km: number;
  free_delivery_above: number;
}

export default function RestaurantMenuPage() {
  const params = useParams();
  const router = useRouter();
  const restaurant_id = params.id as string;
  
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [originalMenus, setOriginalMenus] = useState<MenuItem[]>([]); // Keep original for kitchen
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [bestSellers, setBestSellers] = useState<MenuItem[]>([]);
  const [branding, setBranding] = useState<any>({});
  const [menuTemplate, setMenuTemplate] = useState<string>('grid'); // 'list', 'grid', 'magazine', 'elegant', 'casual'

  // Service options from restaurant settings
  const [serviceOptions, setServiceOptions] = useState({
    dine_in: true,
    pickup: true,
    delivery: true
  });

  // Delivery rates from restaurant settings
  const [deliveryRates, setDeliveryRates] = useState<DeliveryRate[]>([]);
  const [selectedDeliveryFee, setSelectedDeliveryFee] = useState<number>(0);

  // Delivery settings (per-km pricing)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({
    pricing_mode: 'per_km',
    price_per_km: 1.50,
    base_fee: 3.00,
    max_distance_km: 15,
    free_delivery_above: 0
  });

  // Restaurant location for delivery calculation
  const [restaurantLocation, setRestaurantLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });

  // Delivery calculation state
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);
  const [deliveryCalculation, setDeliveryCalculation] = useState<{
    success: boolean;
    distance_km?: number;
    distance_text?: string;
    duration_minutes?: number;
    duration_text?: string;
    delivery_fee?: number | null;
    is_within_range?: boolean;
    formatted_address?: string;
    message?: string;
    error?: string;
  } | null>(null);

  // Restaurant plan for language restrictions
  const [restaurantPlan, setRestaurantPlan] = useState<string>('free_trial');

  // Credit card surcharge settings
  const [surchargeSettings, setSurchargeSettings] = useState({
    credit_card_surcharge_enabled: false,
    credit_card_surcharge_rate: 2.50
  });

  // Language selection for customers
  const [selectedLanguage, setSelectedLanguage] = useState<string>('original'); // 'original', 'en', 'th', 'zh', 'ja', 'ko'
  const [translatingMenu, setTranslatingMenu] = useState(false);
  const [translatedMenusCache, setTranslatedMenusCache] = useState<{[lang: string]: MenuItem[]}>({});
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null); // Image preview modal
  const [editingCartItem, setEditingCartItem] = useState<{index: number, item: CartItem} | null>(null); // Edit cart item modal

  // All available languages (Enterprise gets all, others get only Original + English)
  const ALL_LANGUAGES = [
    { code: 'original', name: 'Original', flag: '📝' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  ];

  // Enterprise = all languages, others = Original + English only
  const isEnterprise = ['enterprise', 'admin', 'premium'].includes(restaurantPlan);
  const AVAILABLE_LANGUAGES = isEnterprise
    ? ALL_LANGUAGES
    : ALL_LANGUAGES.filter(lang => ['original', 'en'].includes(lang.code));
  
  // Service type and customer details
  const [serviceType, setServiceType] = useState<'dine_in' | 'pickup' | 'delivery'>('dine_in');
  const [customerDetails, setCustomerDetails] = useState({
    table_no: '',
    name: '',
    phone: '',
    pickup_time: '',
    address: '',
  });

  // Service Request (Call Waiter) states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedRequestType, setSelectedRequestType] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>(''); // Real restaurant ID from API

  useEffect(() => {
    if (restaurant_id) {
      fetchMenus();
      // Load cart from localStorage
      const savedCart = localStorage.getItem(`cart_${restaurant_id}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    }
  }, [restaurant_id]);

  useEffect(() => {
    // Save cart to localStorage
    if (restaurant_id) {
      localStorage.setItem(`cart_${restaurant_id}`, JSON.stringify(cart));
    }
  }, [cart, restaurant_id]);


  const fetchMenus = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/public/menu/${restaurant_id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch menus');
      }
      
      const data = await response.json();
      if (data.success) {
        // Set template from branding settings (default: grid)
        setMenuTemplate(data.branding?.menu_template || 'grid');
        setBranding(data.branding || {});

        // Set service options from restaurant settings
        if (data.service_options) {
          setServiceOptions(data.service_options);
          // Set default service type to first enabled option
          if (data.service_options.dine_in) {
            setServiceType('dine_in');
          } else if (data.service_options.pickup) {
            setServiceType('pickup');
          } else if (data.service_options.delivery) {
            setServiceType('delivery');
          }
        }

        // Set delivery rates from restaurant settings
        if (data.delivery_rates && data.delivery_rates.length > 0) {
          const sortedRates = [...data.delivery_rates].sort((a: DeliveryRate, b: DeliveryRate) => a.distance_km - b.distance_km);
          setDeliveryRates(sortedRates);
          // Set default delivery fee to first tier
          setSelectedDeliveryFee(sortedRates[0].price);
        }

        // Set delivery settings (per-km pricing)
        if (data.delivery_settings) {
          setDeliverySettings(data.delivery_settings);
        }

        // Set restaurant plan for language restrictions
        if (data.plan) {
          setRestaurantPlan(data.plan);
        }

        // Save the real restaurant ID for service requests
        if (data.restaurant?.id) {
          setRestaurantId(data.restaurant.id);

          // Fetch restaurant location for delivery calculation
          try {
            const locationResponse = await fetch(`${API_URL}/api/restaurant/${data.restaurant.id}/location`);
            if (locationResponse.ok) {
              const locationData = await locationResponse.json();
              if (locationData.success && locationData.location) {
                setRestaurantLocation({
                  latitude: locationData.location.latitude,
                  longitude: locationData.location.longitude
                });
              }
            }
          } catch (err) {
            console.log('Could not fetch restaurant location:', err);
          }

          // Fetch credit card surcharge settings
          try {
            const surchargeResponse = await fetch(`${API_URL}/api/restaurant/${data.restaurant.id}/surcharge-settings`);
            if (surchargeResponse.ok) {
              const surchargeData = await surchargeResponse.json();
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
        }

        // Fetch best sellers
        try {
          const bestSellersResponse = await fetch(`${API_URL}/api/best-sellers?restaurant_id=${data.restaurant.id}&days=7&limit=5`);
          if (bestSellersResponse.ok) {
            const bestSellersData = await bestSellersResponse.json();
            if (bestSellersData.success) {
              // Get best seller menu IDs
              const bestSellerIds = new Set(bestSellersData.best_sellers.map((item: any) => item.menu_id));
              
              // Merge best seller flag into menu items
              const menusWithBestSeller = (data.menu_items || []).map((menu: MenuItem) => ({
                ...menu,
                is_best_seller: bestSellerIds.has(menu.menu_id)
              }));

              setMenus(menusWithBestSeller);
              setOriginalMenus(menusWithBestSeller); // Keep original for kitchen
              
              // Convert best sellers format to MenuItem format
              const bestSellerItems: MenuItem[] = bestSellersData.best_sellers.map((item: any) => ({
                menu_id: item.menu_id,
                name: item.name || '',
                nameEn: item.nameEn || '',
                description: '',
                descriptionEn: '',
                price: item.price || '0',
                category: item.category || 'Main Course',
                photo_url: item.image_url,
                image_url: item.image_url,
                meats: [],
                addOns: [],
              }));
              setBestSellers(bestSellerItems);
            } else {
              // No best sellers data, just set menus without best seller flag
              setMenus(data.menu_items || []);
              setOriginalMenus(data.menu_items || []); // Keep original for kitchen
            }
          } else {
            // Best sellers API failed, just set menus without best seller flag
            setMenus(data.menu_items || []);
            setOriginalMenus(data.menu_items || []); // Keep original for kitchen
          }
        } catch (err) {
          console.error('Failed to fetch best sellers:', err);
          // Don't fail the whole page if best sellers fail
          setMenus(data.menu_items || []);
          setOriginalMenus(data.menu_items || []); // Keep original for kitchen
        }
      } else {
        throw new Error('Failed to fetch menus');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate delivery fee based on customer address
  const calculateDeliveryFee = async () => {
    if (!customerDetails.address.trim()) {
      setDeliveryCalculation(null);
      return;
    }

    if (!restaurantLocation.latitude || !restaurantLocation.longitude) {
      // Restaurant hasn't set their location - can't calculate automatically
      return;
    }

    setCalculatingDelivery(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/delivery/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          customer_address: customerDetails.address
        })
      });

      const data = await response.json();

      if (data.success !== false) {
        setDeliveryCalculation({
          success: true,
          distance_km: data.distance_km,
          distance_text: data.distance_text,
          duration_minutes: data.duration_minutes,
          duration_text: data.duration_text,
          delivery_fee: data.delivery_fee,
          is_within_range: data.is_within_range,
          formatted_address: data.formatted_address,
          message: data.message
        });

        // Update selected delivery fee if within range
        if (data.is_within_range && data.delivery_fee !== null) {
          setSelectedDeliveryFee(data.delivery_fee);
        }
      } else {
        setDeliveryCalculation({
          success: false,
          error: data.error || data.detail || 'Failed to calculate delivery fee'
        });
      }
    } catch (error) {
      console.error('Delivery calculation error:', error);
      setDeliveryCalculation({
        success: false,
        error: 'Failed to calculate delivery. Please try again.'
      });
    } finally {
      setCalculatingDelivery(false);
    }
  };

  // Auto-calculate delivery fee when address changes (debounced)
  useEffect(() => {
    if (serviceType !== 'delivery') return;
    if (!customerDetails.address.trim()) {
      setDeliveryCalculation(null);
      return;
    }
    if (!restaurantLocation.latitude || !restaurantLocation.longitude) return;

    // Debounce: wait 800ms after user stops typing
    const timeoutId = setTimeout(() => {
      calculateDeliveryFee();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [customerDetails.address, serviceType, restaurantLocation.latitude, restaurantLocation.longitude, restaurantId]);

  // Helper function to clean markdown/formatting artifacts from translations
  const cleanTranslation = (text: string | undefined): string => {
    if (!text) return '';
    // Remove markdown bold/italic markers
    let cleaned = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    return cleaned;
  };

  // Helper function to generate a simple hash for cache invalidation detection
  const generateSourceHash = (menu: MenuItem): string => {
    const sourceText = [
      menu.name || '',
      menu.description || '',
      menu.category || '',
      ...(menu.meats?.map(m => m.name) || []),
      ...(menu.addOns?.map(a => a.name) || []),
    ].join('|');
    // Simple hash - sum of char codes
    let hash = 0;
    for (let i = 0; i < sourceText.length; i++) {
      hash = ((hash << 5) - hash) + sourceText.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  // Function to translate menus to selected language
  const translateMenusToLanguage = async (targetLang: string) => {
    if (targetLang === 'original') {
      setMenus(originalMenus);
      return;
    }

    if (targetLang === 'en') {
      // English is already available as nameEn/descriptionEn/categoryEn
      // Map to use English versions
      const englishMenus = originalMenus.map(menu => ({
        ...menu,
        name: menu.nameEn || menu.name,
        description: menu.descriptionEn || menu.description,
        category: menu.categoryEn || menu.category,
        meats: menu.meats?.map(meat => ({
          ...meat,
          name: meat.nameEn || meat.name,
        })),
        addOns: menu.addOns?.map(addon => ({
          ...addon,
          name: addon.nameEn || addon.name,
        })),
        // Keep original for kitchen orders
        originalName: menu.name,
        originalDescription: menu.description,
      }));
      setMenus(englishMenus);
      return;
    }

    // Check local state cache first (for current session)
    if (translatedMenusCache[targetLang]) {
      setMenus(translatedMenusCache[targetLang]);
      return;
    }

    // Translate using AI with Supabase cache
    setTranslatingMenu(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Step 1: Check Supabase cache for existing translations
      let cachedTranslations: Record<string, any> = {};
      if (restaurantId) {
        try {
          const cacheResponse = await fetch(
            `${API_URL}/api/translations/menu/${restaurantId}?language_code=${targetLang}`
          );
          if (cacheResponse.ok) {
            const cacheData = await cacheResponse.json();
            if (cacheData.success) {
              cachedTranslations = cacheData.translations || {};
            }
          }
        } catch (err) {
          console.log('Cache fetch failed, will translate all:', err);
        }
      }

      // Step 2: Determine which menus need translation (not in cache or source changed)
      const menusNeedingTranslation: MenuItem[] = [];
      const menuHashes: Record<string, string> = {};

      originalMenus.forEach(menu => {
        const currentHash = generateSourceHash(menu);
        menuHashes[menu.menu_id] = currentHash;

        const cached = cachedTranslations[menu.menu_id];
        if (!cached || cached.source_hash !== currentHash) {
          menusNeedingTranslation.push(menu);
        }
      });

      // Step 3: If all menus are cached, use them directly
      if (menusNeedingTranslation.length === 0) {
        const translatedMenus = originalMenus.map(menu => {
          const cached = cachedTranslations[menu.menu_id];
          return {
            ...menu,
            name: cleanTranslation(cached.translated_name) || menu.name,
            description: cleanTranslation(cached.translated_description) || menu.description,
            category: cleanTranslation(cached.translated_category) || menu.category,
            meats: menu.meats?.map((meat, idx) => ({
              ...meat,
              name: cleanTranslation(cached.translated_meats?.[idx]) || meat.name,
            })),
            addOns: menu.addOns?.map((addon, idx) => ({
              ...addon,
              name: cleanTranslation(cached.translated_addons?.[idx]) || addon.name,
            })),
            originalName: menu.name,
            originalDescription: menu.description,
          };
        });

        // Save to local state cache
        setTranslatedMenusCache(prev => ({
          ...prev,
          [targetLang]: translatedMenus,
        }));
        setMenus(translatedMenus);
        return;
      }

      // Step 4: Prepare texts to translate for non-cached menus only
      const textsToTranslate: string[] = [];
      const menuStructure: Array<{menu: MenuItem, meatCount: number, addOnCount: number}> = [];

      menusNeedingTranslation.forEach(menu => {
        textsToTranslate.push(menu.name || '');
        textsToTranslate.push(menu.description || '');
        textsToTranslate.push(menu.category || '');

        const meatCount = menu.meats?.length || 0;
        menu.meats?.forEach(meat => {
          textsToTranslate.push(meat.name || '');
        });

        const addOnCount = menu.addOns?.length || 0;
        menu.addOns?.forEach(addon => {
          textsToTranslate.push(addon.name || '');
        });

        menuStructure.push({ menu, meatCount, addOnCount });
      });

      // Step 5: Call translate API
      const response = await fetch(`${API_URL}/api/translate/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: textsToTranslate,
          source_lang: 'auto',
          target_lang: targetLang,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translations: string[] = data.translations || [];

        // Step 6: Map translations back and create new translations map
        const newTranslations: Record<string, any> = {};
        let translationIndex = 0;

        menuStructure.forEach(({ menu, meatCount, addOnCount }) => {
          const rawTranslatedName = cleanTranslation(translations[translationIndex] || menu.name);
          // If name translation is too long (>200 chars), use original
          const translatedName = rawTranslatedName.length > 200 ? menu.name : rawTranslatedName;
          translationIndex++;
          const translatedDesc = cleanTranslation(translations[translationIndex] || menu.description);
          translationIndex++;
          const rawTranslatedCategory = cleanTranslation(translations[translationIndex] || menu.category);
          // If category translation is too long (>50 chars), use original
          const translatedCategory = rawTranslatedCategory.length > 50 ? menu.category : rawTranslatedCategory;
          translationIndex++;

          const translatedMeats: string[] = [];
          for (let i = 0; i < meatCount; i++) {
            const rawMeat = cleanTranslation(translations[translationIndex + i] || '');
            const originalMeat = menu.meats?.[i]?.name || '';
            // If translation is too long (likely corrupted/description), use original
            translatedMeats.push(rawMeat.length > 50 ? originalMeat : (rawMeat || originalMeat));
          }
          translationIndex += meatCount;

          const translatedAddons: string[] = [];
          for (let i = 0; i < addOnCount; i++) {
            const rawAddon = cleanTranslation(translations[translationIndex + i] || '');
            const originalAddon = menu.addOns?.[i]?.name || '';
            // If translation is too long (likely corrupted/description), use original
            translatedAddons.push(rawAddon.length > 50 ? originalAddon : (rawAddon || originalAddon));
          }
          translationIndex += addOnCount;

          newTranslations[menu.menu_id] = {
            translated_name: translatedName,
            translated_description: translatedDesc,
            translated_category: translatedCategory,
            translated_meats: translatedMeats,
            translated_addons: translatedAddons,
            source_hash: menuHashes[menu.menu_id],
          };
        });

        // Step 7: Merge cached and new translations
        const allTranslations = { ...cachedTranslations, ...newTranslations };

        // Step 8: Save new translations to Supabase cache
        if (restaurantId && Object.keys(newTranslations).length > 0) {
          try {
            const translationsToSave = Object.entries(newTranslations).map(([menuId, trans]) => ({
              menu_id: menuId,
              translated_name: trans.translated_name,
              translated_description: trans.translated_description,
              translated_category: trans.translated_category,
              translated_meats: trans.translated_meats,
              translated_addons: trans.translated_addons,
              source_hash: trans.source_hash,
            }));

            await fetch(`${API_URL}/api/translations/menu`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                restaurant_id: restaurantId,
                language_code: targetLang,
                translations: translationsToSave,
              }),
            });
          } catch (err) {
            console.log('Failed to save translations to cache:', err);
          }
        }

        // Step 9: Build final translated menus
        const translatedMenus = originalMenus.map(menu => {
          const trans = allTranslations[menu.menu_id];
          if (trans) {
            return {
              ...menu,
              name: cleanTranslation(trans.translated_name) || menu.name,
              description: cleanTranslation(trans.translated_description) || menu.description,
              category: cleanTranslation(trans.translated_category) || menu.category,
              meats: menu.meats?.map((meat, idx) => ({
                ...meat,
                name: cleanTranslation(trans.translated_meats?.[idx]) || meat.name,
              })),
              addOns: menu.addOns?.map((addon, idx) => ({
                ...addon,
                name: cleanTranslation(trans.translated_addons?.[idx]) || addon.name,
              })),
              originalName: menu.name,
              originalDescription: menu.description,
            };
          }
          return {
            ...menu,
            originalName: menu.name,
            originalDescription: menu.description,
          };
        });

        // Save to local state cache
        setTranslatedMenusCache(prev => ({
          ...prev,
          [targetLang]: translatedMenus,
        }));

        setMenus(translatedMenus);
      }
    } catch (err) {
      console.error('Translation failed:', err);
      // Fall back to original
      setMenus(originalMenus);
    } finally {
      setTranslatingMenu(false);
    }
  };

  // Handle language change
  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    setShowLanguageSelector(false);
    translateMenusToLanguage(langCode);
  };

  const openItemModal = (menu: MenuItem) => {
    setSelectedItem(menu);
    setShowItemModal(true);
  };

  const addToCart = (menu: MenuItem, selectedMeat?: string, selectedAddOns?: string[], notes?: string, quantity: number = 1) => {
    // Safely parse price - handle undefined, empty string, or invalid values
    const basePrice = parseFloat(menu.price) || 0;
    let totalPrice = basePrice;

    // Add meat price if selected
    if (selectedMeat && menu.meats) {
      const meat = menu.meats.find(m => (m.nameEn || m.name) === selectedMeat);
      if (meat && meat.price !== '0' && meat.price !== 'free') {
        totalPrice += parseFloat(meat.price) || 0;
      }
    }

    // Add add-ons prices
    if (selectedAddOns && menu.addOns) {
      selectedAddOns.forEach(addOnName => {
        const addOn = menu.addOns?.find(a => (a.nameEn || a.name) === addOnName);
        if (addOn) {
          totalPrice += parseFloat(addOn.price) || 0;
        }
      });
    }

    // Get original menu item for kitchen (use originalMenus to ensure correct language for kitchen)
    const originalMenu = originalMenus.find(m => m.menu_id === menu.menu_id);
    const originalName = originalMenu?.name || (menu as any).originalName || menu.name;
    const originalNameEn = originalMenu?.nameEn || menu.nameEn;

    const cartItem: CartItem = {
      menu_id: menu.menu_id,
      name: originalName, // Always use original language for kitchen
      nameEn: originalNameEn,
      price: totalPrice,
      quantity: quantity, // Use the quantity from ItemModal
      selectedMeat,
      selectedAddOns,
      notes,
    };

    setCart([...cart, cartItem]);
    setShowItemModal(false);
    setShowCart(true);
  };

  const updateQuantity = (menuId: string, delta: number) => {
    setCart(cart.map(item => 
      item.menu_id === menuId 
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ));
  };

  const removeFromCart = (menuId: string) => {
    setCart(cart.filter(item => item.menu_id !== menuId));
  };

  // Remove cart item by index (for cases where same item added multiple times)
  const removeCartItemByIndex = (index: number) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  // Update cart item after editing
  const updateCartItem = (index: number, updatedItem: CartItem) => {
    setCart(cart.map((item, idx) => idx === index ? updatedItem : item));
    setEditingCartItem(null);
  };

  // Open edit modal for cart item
  const openEditCartItem = (index: number) => {
    const item = cart[index];
    setEditingCartItem({ index, item });
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
  };

  const getDeliveryFee = () => {
    return serviceType === 'delivery' ? selectedDeliveryFee : 0;
  };

  // Credit card surcharge is now calculated in payment page when customer selects card payment
  // This keeps the restaurant menu page simpler and only shows base price
  const getSurchargeAmount = () => {
    // Return 0 here - surcharge will be calculated in payment page based on payment method
    return 0;
  };

  const getTotalPrice = () => {
    return getSubtotal() + getDeliveryFee();
  };

  // Check if surcharge will apply (for informational display only)
  const hasPotentialSurcharge = () => {
    return surchargeSettings.credit_card_surcharge_enabled && surchargeSettings.credit_card_surcharge_rate > 0;
  };

  // Calculate GST from inclusive price (NZ standard: 15% GST, formula: total * 3 / 23)
  const getGstAmount = () => {
    const total = getTotalPrice();
    return Math.round(total * 3 / 23 * 100) / 100; // Round to 2 decimal places
  };

  // Get translation based on selected language with English fallback
  const getCustomerLang = (): DashboardLanguage => {
    // Map selected language code to DashboardLanguage
    const langMap: Record<string, DashboardLanguage> = {
      'original': 'th', // Default to Thai for original
      'th': 'th',
      'en': 'en',
      'zh': 'zh',
      'ja': 'ja',
      'ko': 'ko',
      'vi': 'vi',
      'hi': 'hi',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'id': 'id',
      'ms': 'ms',
    };
    return langMap[selectedLanguage] || 'en';
  };

  const handlePlaceOrder = async () => {
    // Validation based on service type
    if (serviceType === 'dine_in' && !customerDetails.table_no.trim()) {
      alert('Please enter table number');
      return;
    }
    if (serviceType === 'pickup') {
      if (!customerDetails.name.trim()) {
        alert('Please enter your name');
        return;
      }
      if (!customerDetails.phone.trim()) {
        alert('Please enter your phone number');
        return;
      }
    }
    if (serviceType === 'delivery') {
      if (!customerDetails.name.trim()) {
        alert('Please enter your name');
        return;
      }
      if (!customerDetails.phone.trim()) {
        alert('Please enter your phone number');
        return;
      }
      if (!customerDetails.address.trim()) {
        alert('Please enter delivery address');
        return;
      }
      // Check delivery calculation when automatic calculation is available
      if (restaurantLocation.latitude && restaurantLocation.longitude && deliveryRates.length > 0) {
        if (!deliveryCalculation) {
          alert('Please click "Calculate Delivery Fee" to check if we can deliver to your address');
          return;
        }
        if (!deliveryCalculation.is_within_range) {
          alert('Sorry, your address is outside our delivery range');
          return;
        }
      }
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // Prepare order items
      const orderItems = cart.map(item => ({
        menu_id: item.menu_id,
        name: item.name,
        nameEn: item.nameEn,
        price: item.price,
        quantity: item.quantity,
        selectedMeat: item.selectedMeat,
        selectedAddOns: item.selectedAddOns,
        notes: item.notes,
        itemTotal: item.price * item.quantity,
      }));
      
      // Prepare customer_details based on service type
      let customerDetailsJson: any = {};
      if (serviceType === 'dine_in') {
        customerDetailsJson = { table_no: customerDetails.table_no };
      } else if (serviceType === 'pickup') {
        customerDetailsJson = {
          name: customerDetails.name,
          phone: customerDetails.phone,
          pickup_time: customerDetails.pickup_time || new Date().toISOString(),
        };
      } else if (serviceType === 'delivery') {
        customerDetailsJson = {
          name: customerDetails.name,
          phone: customerDetails.phone,
          address: customerDetails.address,
        };
      }
      
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant_id,
          items: orderItems,
          service_type: serviceType,
          customer_details: customerDetailsJson,
          table_no: serviceType === 'dine_in' ? customerDetails.table_no : null,
          customer_name: serviceType !== 'dine_in' ? customerDetails.name : null,
          customer_phone: serviceType !== 'dine_in' ? customerDetails.phone : null,
          tax: 0, // Can be calculated later
          delivery_fee: serviceType === 'delivery' ? getDeliveryFee() : 0,
          subtotal: getSubtotal(),
          surcharge_amount: getSurchargeAmount(),
          payment_method: 'card', // Default to card, will be updated in payment flow
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const orderId = data.order?.id;
        setOrderPlaced(true);
        setCart([]);
        localStorage.removeItem(`cart_${restaurant_id}`);

        // Save order to localStorage for tracking
        if (orderId) {
          try {
            const storedOrders = JSON.parse(localStorage.getItem('my_orders') || '[]');
            const newOrder = {
              orderId: orderId,
              restaurantId: restaurant_id,
              restaurantName: branding.name || 'Restaurant',
              createdAt: new Date().toISOString()
            };
            // Add to beginning of array and keep only last 20 orders
            const updatedOrders = [newOrder, ...storedOrders.filter((o: any) => o.orderId !== orderId)].slice(0, 20);
            localStorage.setItem('my_orders', JSON.stringify(updatedOrders));
          } catch (e) {
            console.error('Failed to save order to localStorage:', e);
          }
        }

        // Redirect to payment page after 2 seconds
        setTimeout(() => {
          if (orderId) {
            // Redirect to payment page with language and restaurant slug for back navigation
            const params = new URLSearchParams();
            params.set('lang', selectedLanguage);
            params.set('restaurant', restaurant_id);
            router.push(`/payment/${orderId}?${params.toString()}`);
          } else {
            setOrderPlaced(false);
            setShowCart(false);
          }
        }, 2000);
      } else {
        alert(dt('customer', 'orderFailed', getCustomerLang()));
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      alert(dt('customer', 'orderFailed', getCustomerLang()));
    }
  };

  // Handle Service Request (Call Waiter)
  const handleServiceRequest = async () => {
    const lang = getCustomerLang();

    if (!selectedRequestType) {
      alert(dt('customer', 'selectRequestType', lang));
      return;
    }

    // Require table number for dine-in requests
    if (!customerDetails.table_no.trim()) {
      alert(dt('customer', 'enterTableNumber', lang));
      return;
    }

    setSendingRequest(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${API_URL}/api/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_no: customerDetails.table_no,
          request_type: selectedRequestType,
          message: customMessage || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRequestSent(true);
        // Reset after 3 seconds
        setTimeout(() => {
          setRequestSent(false);
          setShowServiceModal(false);
          setSelectedRequestType('');
          setCustomMessage('');
        }, 3000);
      } else {
        alert(`${dt('alerts', 'error', lang)} - ${dt('alerts', 'tryAgain', lang)}`);
      }
    } catch (error) {
      console.error('Failed to send service request:', error);
      alert(`${dt('alerts', 'error', lang)} - ${dt('alerts', 'tryAgain', lang)}`);
    } finally {
      setSendingRequest(false);
    }
  };

  // Service request types with dynamic translations
  const SERVICE_REQUEST_TYPES = [
    { id: 'call_waiter', translationKey: 'callWaiter', icon: Bell, color: 'bg-orange-500' },
    { id: 'request_sauce', translationKey: 'requestSauce', icon: UtensilsCrossed, color: 'bg-amber-500' },
    { id: 'request_water', translationKey: 'requestWater', icon: Droplets, color: 'bg-blue-500' },
    { id: 'request_bill', translationKey: 'requestBill', icon: Receipt, color: 'bg-green-500' },
    { id: 'other', translationKey: 'other', icon: HelpCircle, color: 'bg-purple-500' },
  ];

  // Group menus by category - use menu.category which contains translated value
  // Add "Bestseller" category at the top with bestseller items
  const groupedMenus = (() => {
    const groups: Record<string, MenuItem[]> = {};

    // Add Bestseller category first if there are bestsellers
    if (bestSellers.length > 0) {
      // Convert bestSellers to MenuItem format with full details from menus
      const bestSellerItems = bestSellers.map(bs => {
        // Find full menu item details from menus array
        const fullMenu = menus.find(m => m.menu_id === bs.menu_id);
        if (fullMenu) {
          return { ...fullMenu, is_best_seller: true };
        }
        // Fallback to bestseller data if not found in menus
        return {
          ...bs,
          is_best_seller: true,
          category: 'Bestseller',
        };
      });
      groups['Bestseller'] = bestSellerItems;
    }

    // Add other categories
    menus.forEach(menu => {
      const category = menu.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(menu);
    });

    return groups;
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600 text-sm">Please check the menu link or contact the restaurant.</p>
        </div>
      </div>
    );
  }

  const themeColor = branding.theme_color || '#f97316'; // Default orange

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 pb-24">
      {/* Hero Section with Logo */}
      <div className="relative overflow-hidden">
        <div
          className="py-16 px-4 relative"
          style={{
            background: branding.cover_image_url
              ? `url(${branding.cover_image_url})`
              : `linear-gradient(135deg, ${themeColor}ee, ${themeColor}bb)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Dark overlay for better text readability on cover image */}
          {branding.cover_image_url && (
            <div className="absolute inset-0 bg-black/40" />
          )}
          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Restaurant Logo */}
            {branding.logo_url && (
              <div className="mb-6">
                <img
                  src={branding.logo_url}
                  alt={branding.name || 'Restaurant Logo'}
                  className="w-32 h-32 md:w-40 md:h-40 mx-auto rounded-full border-4 border-white shadow-2xl object-cover"
                />
              </div>
            )}
            
            {/* Restaurant Name */}
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {branding.name || 'Our Menu'}
            </h1>
            
            {/* Restaurant Info */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-white/90 text-sm md:text-base">
              {menus.length > 0 && (
                <div className="flex items-center gap-2">
                  <Utensils className="w-5 h-5" />
                  <span>{menus.length} Menu Items</span>
                </div>
              )}
              {Object.keys(groupedMenus).length > 0 && (
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  <span>{Object.keys(groupedMenus).length} Categories</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Decorative wave */}
        <div className="relative h-8 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
          <svg className="absolute top-0 w-full h-8" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path 
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              fill="currentColor"
              className="text-gradient-to-br from-orange-50 via-red-50 to-pink-50"
            />
          </svg>
        </div>
      </div>

      {/* Language Selector & My Orders */}
      <div className="container mx-auto px-4 max-w-6xl mt-4">
        <div className="flex items-center justify-between">
          {/* My Orders Link */}
          <button
            onClick={() => router.push('/order-status')}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">My Orders</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              <Globe className="w-4 h-4 inline mr-1" />
              Language:
            </span>
            <div className="relative">
              <button
                onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg">
                  {AVAILABLE_LANGUAGES.find(l => l.code === selectedLanguage)?.flag || '📝'}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {AVAILABLE_LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'Original'}
                </span>
                <Languages className="w-4 h-4 text-gray-500" />
              </button>

              {showLanguageSelector && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="py-2">
                    {AVAILABLE_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-orange-50 transition-colors ${
                          selectedLanguage === lang.code ? 'bg-orange-100 text-orange-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {selectedLanguage === lang.code && (
                          <CheckCircle className="w-4 h-4 ml-auto text-orange-500" />
                        )}
                      </button>
                    ))}
                    {/* Enterprise upgrade message for non-enterprise plans */}
                    {!isEnterprise && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          🌟 ต้องการแปลหลายภาษา?
                        </p>
                        <p className="text-xs text-indigo-600 font-medium mt-1">
                          อัปเกรด Enterprise
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Translation Loading Indicator */}
        {translatingMenu && (
          <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-blue-700 font-medium">Translating menu...</span>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 max-w-6xl mt-8">

        {/* Category Navigation Bar */}
        {Object.keys(groupedMenus).length > 0 && (
          <div className="sticky top-0 z-30 bg-white shadow-md mb-6 -mx-4 px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {Object.keys(groupedMenus).map((category, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const element = document.getElementById(`category-${category.replace(/\s+/g, '-')}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all hover:scale-105"
                  style={{
                    backgroundColor: themeColor,
                    color: 'white',
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu by Category - Using Selected Template */}
        {Object.keys(groupedMenus).length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Utensils className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              No menu items available
            </h3>
            <p className="text-gray-600">
              The restaurant hasn't added any items yet.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Menu - Show slider with 2 items per category */}
            <MobileMenuSection
              categories={Object.keys(groupedMenus)}
              groupedMenus={groupedMenus}
              themeColor={themeColor}
              onItemClick={openItemModal}
              selectedLanguage={selectedLanguage}
              itemsPerCategory={2}
            />

            {/* Desktop Menu - Show full templates */}
            <div className="hidden md:block">
              {menuTemplate === 'list' && (
                <ClassicList
                  menus={menus}
                  groupedMenus={groupedMenus}
                  themeColor={themeColor}
                  onItemClick={openItemModal}
                  selectedLanguage={selectedLanguage}
                />
              )}
              {menuTemplate === 'grid' && (
                <GridView
                  menus={menus}
                  groupedMenus={groupedMenus}
                  themeColor={themeColor}
                  onItemClick={openItemModal}
                  selectedLanguage={selectedLanguage}
                />
              )}
              {menuTemplate === 'magazine' && (
                <MagazineStyle
                  menus={menus}
                  groupedMenus={groupedMenus}
                  themeColor={themeColor}
                  onItemClick={openItemModal}
                  selectedLanguage={selectedLanguage}
                />
              )}
              {menuTemplate === 'elegant' && (
                <Elegant
                  menus={menus}
                  groupedMenus={groupedMenus}
                  themeColor={themeColor}
                  onItemClick={openItemModal}
                  selectedLanguage={selectedLanguage}
                />
              )}
              {menuTemplate === 'casual' && (
                <Casual
                  menus={menus}
                  groupedMenus={groupedMenus}
                  themeColor={themeColor}
                  onItemClick={openItemModal}
                  selectedLanguage={selectedLanguage}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Call Waiter Button (Floating) - Only for Dine-in */}
      {serviceOptions.dine_in && (
        <button
          onClick={() => setShowServiceModal(true)}
          className="fixed bottom-6 left-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-110 bg-gradient-to-br from-blue-500 to-blue-600 text-white"
          title={`${dt('customer', 'callWaiter', getCustomerLang())}${getCustomerLang() !== 'en' ? ` / ${dt('customer', 'callWaiter', 'en')}` : ''}`}
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Service Request Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center" onClick={() => !sendingRequest && setShowServiceModal(false)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success State */}
            {requestSent ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{dt('customer', 'requestSent', getCustomerLang())}</h2>
                {getCustomerLang() !== 'en' && (
                  <p className="text-sm text-gray-500 mt-1">{dt('customer', 'requestSent', 'en')}</p>
                )}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{dt('customer', 'callWaiter', getCustomerLang())}</h2>
                    {getCustomerLang() !== 'en' && (
                      <p className="text-sm text-gray-500">{dt('customer', 'callWaiter', 'en')}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowServiceModal(false)}
                    disabled={sendingRequest}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="p-4">
                  {/* Table Number Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {dt('customer', 'tableNumber', getCustomerLang())}
                      {getCustomerLang() !== 'en' && ` / ${dt('customer', 'tableNumber', 'en')}`}
                      <span className="text-red-500"> *</span>
                    </label>
                    <input
                      type="text"
                      value={customerDetails.table_no}
                      onChange={(e) => setCustomerDetails({ ...customerDetails, table_no: e.target.value })}
                      placeholder="5, A12..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900 bg-white text-lg"
                    />
                  </div>

                  {/* Request Type Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {getCustomerLang() === 'th' ? 'เลือกบริการที่ต้องการ' : dt('customer', 'selectRequestType', getCustomerLang()).replace('Please select a request type', 'Select Service')}
                      {getCustomerLang() !== 'en' && ' / Select Service'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {SERVICE_REQUEST_TYPES.map((type) => {
                        const IconComponent = type.icon;
                        const primaryText = dt('customer', type.translationKey, getCustomerLang());
                        const englishText = dt('customer', type.translationKey, 'en');
                        return (
                          <button
                            key={type.id}
                            onClick={() => setSelectedRequestType(type.id)}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              selectedRequestType === type.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${type.color} text-white`}>
                              <IconComponent className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{primaryText}</span>
                            {getCustomerLang() !== 'en' && (
                              <span className="text-xs text-gray-500">{englishText}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Message (for "Other" type) */}
                  {(selectedRequestType === 'other' || selectedRequestType) && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {dt('customer', 'additionalMessage', getCustomerLang())}
                        {getCustomerLang() !== 'en' && ` / ${dt('customer', 'additionalMessage', 'en')}`}
                        <span className="text-gray-400 text-xs ml-1">(Optional)</span>
                      </label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder={dt('customer', 'specialInstructions', getCustomerLang())}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900 bg-white resize-none"
                      />
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleServiceRequest}
                    disabled={!selectedRequestType || !customerDetails.table_no.trim() || sendingRequest}
                    className="w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700"
                  >
                    {sendingRequest ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {dt('common', 'loading', getCustomerLang())}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {dt('customer', 'sendRequest', getCustomerLang())}
                        {getCustomerLang() !== 'en' && ` / ${dt('customer', 'sendRequest', 'en')}`}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cart Button (Floating) */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 text-white px-6 py-4 rounded-full shadow-lg font-semibold flex items-center gap-3 z-40 transition-all hover:scale-105"
          style={{ backgroundColor: themeColor }}
        >
          <ShoppingCart className="w-6 h-6" />
          <span>{dt('customer', 'cart', getCustomerLang())} ({cart.length})</span>
          <span className="bg-white px-3 py-1 rounded-full" style={{ color: themeColor }}>
            ${getTotalPrice().toFixed(2)}
          </span>
        </button>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowCart(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{dt('customer', 'yourOrder', getCustomerLang())}</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">{dt('customer', 'emptyCart', getCustomerLang())}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {item.nameEn || item.name}
                            </h3>
                            {item.selectedMeat && (
                              <p className="text-sm text-gray-600">Meat: {item.selectedMeat}</p>
                            )}
                            {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                              <p className="text-sm text-gray-600">
                                Add-ons: {item.selectedAddOns.join(', ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-sm text-gray-500 italic">Note: {item.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditCartItem(idx)}
                              className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                              title="Edit item"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {/* Remove Button */}
                            <button
                              onClick={() => removeCartItemByIndex(idx)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                              title="Remove item"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                // Update quantity for this specific item by index
                                if (item.quantity > 1) {
                                  const newCart = [...cart];
                                  newCart[idx] = { ...item, quantity: item.quantity - 1 };
                                  setCart(newCart);
                                }
                              }}
                              className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-opacity hover:opacity-80"
                              style={{ backgroundColor: themeColor }}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-semibold text-gray-900">{item.quantity}</span>
                            <button
                              onClick={() => {
                                // Update quantity for this specific item by index
                                const newCart = [...cart];
                                newCart[idx] = { ...item, quantity: item.quantity + 1 };
                                setCart(newCart);
                              }}
                              className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-opacity hover:opacity-80"
                              style={{ backgroundColor: themeColor }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="font-bold" style={{ color: themeColor }}>
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Service Type Selection */}
                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{dt('customer', 'serviceType', getCustomerLang())}</h3>
                    {/* Show warning if no service types enabled */}
                    {!serviceOptions.dine_in && !serviceOptions.pickup && !serviceOptions.delivery ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                        ⚠️ {dt('customer', 'serviceNotAvailable', getCustomerLang())}
                      </div>
                    ) : (
                      <div className={`grid gap-2 mb-4 ${
                        [serviceOptions.dine_in, serviceOptions.pickup, serviceOptions.delivery].filter(Boolean).length === 1
                          ? 'grid-cols-1 max-w-xs'
                          : [serviceOptions.dine_in, serviceOptions.pickup, serviceOptions.delivery].filter(Boolean).length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-3'
                      }`}>
                        {serviceOptions.dine_in && (
                          <button
                            onClick={() => setServiceType('dine_in')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              serviceType === 'dine_in'
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Utensils className={`w-5 h-5 mx-auto mb-1 ${serviceType === 'dine_in' ? 'text-orange-500' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium ${serviceType === 'dine_in' ? 'text-orange-600' : 'text-gray-600'}`}>
                              {dt('customer', 'dineIn', getCustomerLang())}
                            </span>
                          </button>
                        )}
                        {serviceOptions.pickup && (
                          <button
                            onClick={() => setServiceType('pickup')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              serviceType === 'pickup'
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Store className={`w-5 h-5 mx-auto mb-1 ${serviceType === 'pickup' ? 'text-orange-500' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium ${serviceType === 'pickup' ? 'text-orange-600' : 'text-gray-600'}`}>
                              {dt('customer', 'pickup', getCustomerLang())}
                            </span>
                          </button>
                        )}
                        {serviceOptions.delivery && (
                          <button
                            onClick={() => setServiceType('delivery')}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              serviceType === 'delivery'
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <MapPin className={`w-5 h-5 mx-auto mb-1 ${serviceType === 'delivery' ? 'text-orange-500' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium ${serviceType === 'delivery' ? 'text-orange-600' : 'text-gray-600'}`}>
                              {dt('customer', 'delivery', getCustomerLang())}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Customer Details Forms */}
                    {serviceType === 'dine_in' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {dt('customer', 'tableNumber', getCustomerLang())} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customerDetails.table_no}
                          onChange={(e) => setCustomerDetails({ ...customerDetails, table_no: e.target.value })}
                          placeholder="5, A12..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                        />
                      </div>
                    )}

                    {serviceType === 'pickup' && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'name', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={customerDetails.name}
                            onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                            placeholder={dt('customer', 'name', getCustomerLang())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'phone', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={customerDetails.phone}
                            onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                            placeholder="+64 21 123 4567"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'pickupTime', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="datetime-local"
                            value={customerDetails.pickup_time}
                            min={(() => {
                              const minTime = new Date(Date.now() + 30 * 60 * 1000);
                              return minTime.toISOString().slice(0, 16);
                            })()}
                            onFocus={(e) => {
                              // Auto-set to 30 minutes from now when user clicks on empty field
                              if (!customerDetails.pickup_time) {
                                const minTime = new Date(Date.now() + 30 * 60 * 1000);
                                const defaultTime = minTime.toISOString().slice(0, 16);
                                setCustomerDetails({ ...customerDetails, pickup_time: defaultTime });
                              }
                            }}
                            onChange={(e) => {
                              const selectedTime = new Date(e.target.value).getTime();
                              const minAllowedTime = Date.now() + 30 * 60 * 1000;
                              if (selectedTime < minAllowedTime) {
                                // Auto-correct to minimum allowed time instead of just showing alert
                                const minTime = new Date(minAllowedTime);
                                const correctedTime = minTime.toISOString().slice(0, 16);
                                setCustomerDetails({ ...customerDetails, pickup_time: correctedTime });
                                alert('Pickup time must be at least 30 minutes from now. Auto-adjusted.');
                                return;
                              }
                              setCustomerDetails({ ...customerDetails, pickup_time: e.target.value });
                              // Auto-blur to close the picker
                              (e.target as HTMLInputElement).blur();
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {serviceType === 'delivery' && (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'name', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={customerDetails.name}
                            onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                            placeholder={dt('customer', 'name', getCustomerLang())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'phone', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={customerDetails.phone}
                            onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                            placeholder="+64 21 123 4567"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {dt('customer', 'address', getCustomerLang())} <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={customerDetails.address}
                            onChange={(e) => {
                              setCustomerDetails({ ...customerDetails, address: e.target.value });
                            }}
                            placeholder="123 Main Street, Auckland 1010"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white resize-none"
                          />
                          {/* Auto-calculating delivery fee indicator */}
                          {restaurantLocation.latitude && restaurantLocation.longitude && customerDetails.address.trim() && (
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              {calculatingDelivery ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                  <span className="text-gray-600">Calculating delivery fee...</span>
                                </>
                              ) : deliveryCalculation?.success && deliveryCalculation.is_within_range ? (
                                <>
                                  <Check className="w-4 h-4 text-green-500" />
                                  <span className="text-green-600">Delivery available</span>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {/* Delivery Calculation Result */}
                        {deliveryCalculation && (
                          <div className={`p-3 rounded-lg ${
                            deliveryCalculation.success && deliveryCalculation.is_within_range
                              ? 'bg-green-50 border border-green-200'
                              : deliveryCalculation.success && !deliveryCalculation.is_within_range
                              ? 'bg-red-50 border border-red-200'
                              : 'bg-yellow-50 border border-yellow-200'
                          }`}>
                            {deliveryCalculation.success && deliveryCalculation.is_within_range ? (
                              <>
                                <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                                  <Clock className="w-4 h-4" />
                                  <span>Delivery Available!</span>
                                </div>
                                <div className="text-sm text-green-600 space-y-1">
                                  <p>Distance: {deliveryCalculation.distance_text}</p>
                                  <p>Estimated Time: {deliveryCalculation.duration_text}</p>
                                  <p className="font-bold text-lg">
                                    Delivery Fee: ${deliveryCalculation.delivery_fee?.toFixed(2)}
                                  </p>
                                </div>
                                {deliveryCalculation.formatted_address && (
                                  <p className="text-xs text-green-500 mt-2">
                                    📍 {deliveryCalculation.formatted_address}
                                  </p>
                                )}
                              </>
                            ) : deliveryCalculation.success && !deliveryCalculation.is_within_range ? (
                              <div className="text-red-700">
                                <p className="font-medium">Out of Delivery Range</p>
                                <p className="text-sm mt-1">{deliveryCalculation.message}</p>
                                <p className="text-sm">Distance: {deliveryCalculation.distance_text}</p>
                              </div>
                            ) : (
                              <div className="text-yellow-700">
                                <p className="text-sm">{deliveryCalculation.error}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fallback: Manual Delivery Rate Selection (when restaurant location not set) */}
                        {(!restaurantLocation.latitude || !restaurantLocation.longitude) && deliveryRates.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Delivery Distance <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={selectedDeliveryFee}
                              onChange={(e) => setSelectedDeliveryFee(parseFloat(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900 bg-white"
                            >
                              {deliveryRates.map((rate) => (
                                <option key={rate.id} value={rate.price}>
                                  Within {rate.distance_km} km - ${rate.price.toFixed(2)}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Please select your approximate distance from the restaurant
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-6">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">{dt('customer', 'subtotal', getCustomerLang())}:</span>
                      <span className="text-gray-900 font-medium">
                        ${getSubtotal().toFixed(2)}
                      </span>
                    </div>

                    {/* Delivery Fee (only show when delivery is selected) */}
                    {serviceType === 'delivery' && (
                      <div className="mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">{dt('customer', 'deliveryFee', getCustomerLang())}:</span>
                          <span className="text-gray-900 font-medium">
                            ${getDeliveryFee().toFixed(2)}
                          </span>
                        </div>
                        {/* Show distance and ETA if calculated */}
                        {deliveryCalculation?.success && deliveryCalculation.is_within_range && (
                          <div className="text-xs text-gray-500 text-right mt-1">
                            {deliveryCalculation.distance_text} • ~{deliveryCalculation.duration_text}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Service Fee Notice (if card surcharge is enabled) */}
                    {hasPotentialSurcharge() && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mb-2">
                        💳 Card payment: +{surchargeSettings.credit_card_surcharge_rate}% service fee
                      </div>
                    )}

                    {/* Grand Total */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-xl font-bold text-gray-900">{dt('customer', 'total', getCustomerLang())}:</span>
                      <span className="text-2xl font-bold text-orange-500">
                        ${getTotalPrice().toFixed(2)} NZD
                      </span>
                    </div>

                    {/* GST Information */}
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                      <span>{dt('customer', 'gstIncluded', getCustomerLang())} (15%):</span>
                      <span>${getGstAmount().toFixed(2)}</span>
                    </div>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={
                        serviceType === 'delivery' &&
                        restaurantLocation.latitude !== null &&
                        restaurantLocation.longitude !== null &&
                        deliveryRates.length > 0 &&
                        (!deliveryCalculation || !deliveryCalculation.is_within_range)
                      }
                      className="w-full text-white py-4 rounded-lg font-bold text-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: themeColor }}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.disabled) {
                          e.currentTarget.style.opacity = '0.9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!e.currentTarget.disabled) {
                          e.currentTarget.style.opacity = '1';
                        }
                      }}
                    >
                      {serviceType === 'delivery' &&
                      restaurantLocation.latitude !== null &&
                      restaurantLocation.longitude !== null &&
                      deliveryRates.length > 0 &&
                      !deliveryCalculation
                        ? 'Calculate Delivery Fee First'
                        : serviceType === 'delivery' &&
                          deliveryCalculation &&
                          !deliveryCalculation.is_within_range
                        ? 'Out of Delivery Range'
                        : dt('customer', 'placeOrder', getCustomerLang())}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && selectedItem && (
        <ItemModal
          menu={selectedItem}
          themeColor={themeColor}
          branding={branding}
          onClose={() => {
            setShowItemModal(false);
            setSelectedItem(null);
          }}
          onAddToCart={(meat, addOns, notes, quantity) => {
            addToCart(selectedItem, meat, addOns, notes, quantity);
          }}
          onImageClick={(imageUrl) => setPreviewImage(imageUrl)}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 left-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors z-10"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={previewImage}
            alt="Food preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Edit Cart Item Modal */}
      {editingCartItem && (
        <EditCartItemModal
          cartItem={editingCartItem.item}
          cartIndex={editingCartItem.index}
          menus={originalMenus}
          themeColor={themeColor}
          onClose={() => setEditingCartItem(null)}
          onUpdate={updateCartItem}
        />
      )}

      {/* Order Placed - Redirect to Payment */}
      {orderPlaced && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Created!</h2>
            <p className="text-gray-600">Please complete your payment to confirm the order.</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to payment page...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Item Modal Component
function ItemModal({
  menu,
  themeColor,
  branding,
  onClose,
  onAddToCart,
  onImageClick
}: {
  menu: MenuItem;
  themeColor: string;
  branding: any;
  onClose: () => void;
  onAddToCart: (meat?: string, addOns?: string[], notes?: string, quantity?: number) => void;
  onImageClick?: (imageUrl: string) => void;
}) {
  const [selectedMeat, setSelectedMeat] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  const calculatePrice = () => {
    let total = (parseFloat(menu.price) || 0) * quantity;

    if (selectedMeat && menu.meats) {
      const meat = menu.meats.find(m => (m.nameEn || m.name) === selectedMeat);
      if (meat && meat.price !== '0' && meat.price !== 'free') {
        total += (parseFloat(meat.price) || 0) * quantity;
      }
    }

    if (selectedAddOns.length > 0 && menu.addOns) {
      selectedAddOns.forEach(addOnName => {
        const addOn = menu.addOns?.find(a => (a.nameEn || a.name) === addOnName);
        if (addOn) {
          total += (parseFloat(addOn.price) || 0) * quantity;
        }
      });
    }

    return total;
  };

  const handleAddToCart = () => {
    // Pass quantity directly instead of calling multiple times
    onAddToCart(selectedMeat || undefined, selectedAddOns.length > 0 ? selectedAddOns : undefined, notes || undefined, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl overflow-y-auto mobile-modal-height md:h-auto md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {menu.name}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Photo - Clickable for Preview */}
          {menu.photo_url && (
            <div className="mb-4">
              <img
                src={menu.photo_url}
                alt={menu.name}
                className="w-full h-64 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(menu.photo_url!)}
              />
              <p className="text-xs text-gray-400 text-center mt-1">Tap image to view full size</p>
            </div>
          )}

          {/* Description */}
          {menu.description && (
            <p className="text-gray-600 mb-6">
              {menu.description}
            </p>
          )}

          {/* Meats Selection - Required when meats exist */}
          {menu.meats && menu.meats.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Choose Meat: <span className="text-red-500">*</span>
              </h3>
              <div className="space-y-2">
                {menu.meats.map((meat, idx) => {
                  const displayName = meat.nameEn || meat.name;
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{
                        borderColor: selectedMeat === displayName ? themeColor : '#e5e7eb',
                        backgroundColor: selectedMeat === displayName ? `${themeColor}15` : 'white'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="meat"
                          value={displayName}
                          checked={selectedMeat === displayName}
                          onChange={(e) => setSelectedMeat(e.target.value)}
                          className="w-4 h-4"
                          style={{ accentColor: themeColor }}
                        />
                        <span className="font-medium text-gray-900">{displayName}</span>
                        {meat.nameEn && meat.name !== meat.nameEn && (
                          <span className="text-sm text-gray-500">({meat.name})</span>
                        )}
                      </div>
                      <span className="text-gray-700 font-medium">
                        {meat.price === '0' || meat.price === 'free' ? 'Free' : `+$${meat.price}`}
                      </span>
                    </label>
                  );
                })}
              </div>
              {!selectedMeat && (
                <p className="text-sm text-red-500 mt-2">Please select a meat option</p>
              )}
            </div>
          )}

          {/* Add-ons Selection */}
          {menu.addOns && menu.addOns.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Add-ons (Optional):</h3>
              <div className="space-y-2">
                {menu.addOns.map((addon, idx) => {
                  const displayName = addon.nameEn || addon.name;
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{
                        borderColor: selectedAddOns.includes(displayName) ? themeColor : '#e5e7eb',
                        backgroundColor: selectedAddOns.includes(displayName) ? `${themeColor}15` : 'white'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAddOns.includes(displayName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddOns([...selectedAddOns, displayName]);
                            } else {
                              setSelectedAddOns(selectedAddOns.filter(a => a !== displayName));
                            }
                          }}
                          className="w-4 h-4"
                          style={{ accentColor: themeColor }}
                        />
                        <span className="font-medium text-gray-900">{displayName}</span>
                        {addon.nameEn && addon.name !== addon.nameEn && (
                          <span className="text-sm text-gray-500">({addon.name})</span>
                        )}
                      </div>
                      <span className="text-gray-700 font-medium">+${addon.price}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Quantity:</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-all hover:opacity-80"
                style={{ backgroundColor: themeColor }}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-bold text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-all hover:opacity-80"
                style={{ backgroundColor: themeColor }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Special Instructions (Optional):</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., No spicy, Extra sauce..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
              rows={3}
            />
          </div>

          {/* Price and Add Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Total Price:</p>
              <p className="text-3xl font-bold text-orange-500">
                ${calculatePrice().toFixed(2)} NZD
              </p>
            </div>
            <button
              onClick={() => {
                // Validate meat selection if meats exist
                if (menu.meats && menu.meats.length > 0 && !selectedMeat) {
                  alert('Please select a meat option before adding to cart');
                  return;
                }
                handleAddToCart();
              }}
              disabled={menu.meats && menu.meats.length > 0 && !selectedMeat}
              className={`px-8 py-3 text-white rounded-lg font-bold text-lg transition-opacity flex items-center gap-2 ${
                menu.meats && menu.meats.length > 0 && !selectedMeat ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ backgroundColor: themeColor }}
              onMouseEnter={(e) => {
                if (!(menu.meats && menu.meats.length > 0 && !selectedMeat)) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!(menu.meats && menu.meats.length > 0 && !selectedMeat)) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      {/* Footer - Powered by Smart Menu (hide for Enterprise plan) */}
      {!branding.hide_powered_by && (
        <div className="container mx-auto px-4 max-w-6xl mt-12 pb-8">
          <div className="text-center py-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Powered by{' '}
              <a
                href="https://smartmenu.co.nz"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:text-orange-500 transition-colors"
                style={{ color: themeColor }}
              >
                Smart Menu
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Edit Cart Item Modal Component
function EditCartItemModal({
  cartItem,
  cartIndex,
  menus,
  themeColor,
  onClose,
  onUpdate
}: {
  cartItem: CartItem;
  cartIndex: number;
  menus: MenuItem[];
  themeColor: string;
  onClose: () => void;
  onUpdate: (index: number, updatedItem: CartItem) => void;
}) {
  // Find the original menu item to get meats and add-ons options
  const menu = menus.find(m => m.menu_id === cartItem.menu_id);

  const [selectedMeat, setSelectedMeat] = useState<string>(cartItem.selectedMeat || '');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(cartItem.selectedAddOns || []);
  const [notes, setNotes] = useState(cartItem.notes || '');
  const [quantity, setQuantity] = useState(cartItem.quantity);

  const calculatePrice = () => {
    if (!menu) return cartItem.price || 0;

    let basePrice = parseFloat(menu.price) || 0;

    if (selectedMeat && menu.meats) {
      const meat = menu.meats.find(m => (m.nameEn || m.name) === selectedMeat);
      if (meat && meat.price !== '0' && meat.price !== 'free') {
        basePrice += parseFloat(meat.price) || 0;
      }
    }

    if (selectedAddOns.length > 0 && menu.addOns) {
      selectedAddOns.forEach(addOnName => {
        const addOn = menu.addOns?.find(a => (a.nameEn || a.name) === addOnName);
        if (addOn) {
          basePrice += parseFloat(addOn.price) || 0;
        }
      });
    }

    return basePrice;
  };

  const handleUpdate = () => {
    const updatedItem: CartItem = {
      ...cartItem,
      price: calculatePrice(),
      quantity,
      selectedMeat: selectedMeat || undefined,
      selectedAddOns: selectedAddOns.length > 0 ? selectedAddOns : undefined,
      notes: notes || undefined,
    };
    onUpdate(cartIndex, updatedItem);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Item</h2>
              <p className="text-gray-600">{cartItem.nameEn || cartItem.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900 p-2">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Meats Selection */}
          {menu?.meats && menu.meats.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Choose Meat: <span className="text-red-500">*</span>
              </h3>
              <div className="space-y-2">
                {menu.meats.map((meat, idx) => {
                  const displayName = meat.nameEn || meat.name;
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{
                        borderColor: selectedMeat === displayName ? themeColor : '#e5e7eb',
                        backgroundColor: selectedMeat === displayName ? `${themeColor}15` : 'white'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="meat"
                          value={displayName}
                          checked={selectedMeat === displayName}
                          onChange={(e) => setSelectedMeat(e.target.value)}
                          className="w-4 h-4"
                          style={{ accentColor: themeColor }}
                        />
                        <span className="font-medium text-gray-900">{displayName}</span>
                      </div>
                      <span className="text-gray-700 font-medium">
                        {meat.price === '0' || meat.price === 'free' ? 'Free' : `+$${meat.price}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons Selection */}
          {menu?.addOns && menu.addOns.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Add-ons (Optional):</h3>
              <div className="space-y-2">
                {menu.addOns.map((addon, idx) => {
                  const displayName = addon.nameEn || addon.name;
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50"
                      style={{
                        borderColor: selectedAddOns.includes(displayName) ? themeColor : '#e5e7eb',
                        backgroundColor: selectedAddOns.includes(displayName) ? `${themeColor}15` : 'white'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAddOns.includes(displayName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddOns([...selectedAddOns, displayName]);
                            } else {
                              setSelectedAddOns(selectedAddOns.filter(a => a !== displayName));
                            }
                          }}
                          className="w-4 h-4"
                          style={{ accentColor: themeColor }}
                        />
                        <span className="font-medium text-gray-900">{displayName}</span>
                      </div>
                      <span className="text-gray-700 font-medium">+${addon.price}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Quantity:</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-all hover:opacity-80"
                style={{ backgroundColor: themeColor }}
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-bold text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center transition-all hover:opacity-80"
                style={{ backgroundColor: themeColor }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Special Instructions (Optional):</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., No spicy, Extra sauce..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
              rows={3}
            />
          </div>

          {/* Price and Update Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Total Price:</p>
              <p className="text-2xl font-bold" style={{ color: themeColor }}>
                ${(calculatePrice() * quantity).toFixed(2)} NZD
              </p>
            </div>
            <button
              onClick={() => {
                if (menu?.meats && menu.meats.length > 0 && !selectedMeat) {
                  alert('Please select a meat option');
                  return;
                }
                handleUpdate();
              }}
              disabled={menu?.meats && menu.meats.length > 0 && !selectedMeat}
              className={`px-6 py-3 text-white rounded-lg font-bold text-lg transition-opacity flex items-center gap-2 ${
                menu?.meats && menu.meats.length > 0 && !selectedMeat ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ backgroundColor: themeColor }}
            >
              <Check className="w-5 h-5" />
              Update Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
