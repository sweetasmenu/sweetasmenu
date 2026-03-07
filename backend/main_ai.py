"""
Smart Menu SaaS - Full AI Backend
รวมทุก AI features: Translation, Image Enhancement, Generation
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import os
import base64
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="../.env")

# Import AI services
from services.ai_service import ai_service  # Unified AI service (cost-optimized)
from services.menu_storage import menu_storage  # Keep for backward compatibility
from services.menu_service import menu_service  # New: Supabase-based menu service
from services.stripe_service import stripe_service
from services.stripe_subscription_service import stripe_subscription_service, STRIPE_PRICE_IDS
from services.trial_limits import trial_limits_service
from services.customization_service import customization_service
from services.user_role_service import user_role_service
from services.restaurant_service import restaurant_service
from services.orders_service import orders_service
from services.best_sellers_service import best_sellers_service
from services.email_service import email_service  # Email notifications
from services.file_validation import validate_image_upload, get_safe_filename  # File upload validation
from services.analytics_service import analytics_service  # Analytics & Reports
from services.staff_service import staff_service  # Staff Management
from services.image_library_service import image_library_service  # Shared Image Library
from services.delivery_service import delivery_service  # Delivery distance calculation
from services.admin_service import admin_service  # Super Admin Dashboard
from services.security_middleware import setup_security  # Security: Rate limiting, headers
from services.ai_assistant_service import ai_assistant_service  # AI Assistant (Enterprise)

# Initialize Supabase client for direct database access (menu_translations, etc.)
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    SUPABASE_KEY = (
        os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
        os.getenv('SUPABASE_KEY') or
        os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    )
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase client initialized for main_ai.py")
    else:
        supabase = None
        print("⚠️ Supabase credentials not found for main_ai.py")
except Exception as e:
    supabase = None
    print(f"⚠️ Failed to initialize Supabase client: {str(e)}")

# Lifespan handler for graceful startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application lifespan events"""
    # Startup
    try:
        print("🚀 Smart Menu AI API starting up...")
        # Services will be initialized lazily on first use
        yield
    except asyncio.CancelledError:
        # This is normal during reload/shutdown - don't log as error, just pass through
        pass
    except Exception as e:
        print(f"⚠️ Startup error: {str(e)}")
        raise
    finally:
        # Shutdown
        try:
            print("🛑 Smart Menu AI API shutting down gracefully...")
            # Clean up resources if needed
            pass
        except Exception as e:
            # Don't raise during shutdown cleanup
            pass

# Initialize FastAPI with lifespan handler
app = FastAPI(
    title="Smart Menu AI API",
    description="Full AI-powered backend: Translation, Image Enhancement, Generation",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================
# Security Configuration
# ============================================================

# Allowed origins for CORS (production domains)
ALLOWED_ORIGINS = [
    # Production domains
    "https://sweetasmenu.com",
    "https://www.sweetasmenu.com",
    "https://app.sweetasmenu.com",
    # Netlify deployments
    "https://sweetasmenu.netlify.app",
    "https://*.netlify.app",
    # Vercel preview deployments
    "https://*.vercel.app",
    # Local development
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Get additional origins from environment variable
EXTRA_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
ALLOWED_ORIGINS.extend([o.strip() for o in EXTRA_ORIGINS if o.strip()])

# CORS middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"],
    expose_headers=["X-Request-ID"],
    max_age=600,  # Cache preflight for 10 minutes
)

# Setup security middleware (Rate limiting, Security headers, Health check)
setup_security(app)

# ============================================================
# Models
# ============================================================

class TranslateRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str = "English"
    user_id: Optional[str] = None  # For plan-based language restriction

class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str

class BatchTranslateRequest(BaseModel):
    texts: List[str]
    source_lang: str = "auto"
    target_lang: str = "en"
    user_id: Optional[str] = None  # For plan-based language restriction

class BatchTranslateResponse(BaseModel):
    translations: List[str]
    source_lang: str
    target_lang: str
    count: int

class DetectLanguageRequest(BaseModel):
    text: str

class EnhancementStyle(BaseModel):
    style: str = "professional"  # natural, vivid, professional

class MenuItemInput(BaseModel):
    name: str
    description: str
    category: str = "Main Course"
    language: str = "English"

class SaveMenuItemRequest(BaseModel):
    name: str
    nameEn: Optional[str] = ""
    description: Optional[str] = ""
    descriptionEn: Optional[str] = ""
    price: str
    category: str
    categoryEn: Optional[str] = ""
    photo_url: Optional[str] = ""
    menu_type: Optional[str] = "food"  # NEW: food, snack, beverage
    meats: Optional[List[Dict[str, Any]]] = []  # Choose Meat options (only for food type)
    addOns: Optional[List[Dict[str, Any]]] = []
    showBothLanguages: Optional[bool] = True
    primaryLanguage: Optional[str] = "original"
    restaurant_id: Optional[str] = "default"
    is_best_seller: Optional[bool] = False  # Best Seller flag
    is_active: Optional[bool] = True  # Visible on menu flag

class StripeCheckoutRequest(BaseModel):
    user_id: str
    user_email: str
    plan_id: str
    interval: str = "monthly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class StripePortalRequest(BaseModel):
    user_id: str
    return_url: Optional[str] = None

class BillingCancelRequest(BaseModel):
    user_id: str

class TrialStatusRequest(BaseModel):
    user_id: str

class UpdateThemeColorRequest(BaseModel):
    restaurant_id: str
    theme_color: str
    user_id: str  # For plan checking

class UploadCoverImageRequest(BaseModel):
    restaurant_id: str
    image_base64: str
    user_id: str  # For plan checking

class UpdateProfileRequest(BaseModel):
    restaurant_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    theme_color: Optional[str] = None
    menu_template: Optional[str] = None  # list, grid, magazine, elegant, casual
    user_id: str  # For plan checking
    # Tax/Business info for NZ
    gst_registered: Optional[bool] = None
    gst_number: Optional[str] = None
    ird_number: Optional[str] = None
    # Operating hours
    operating_hours: Optional[dict] = None  # {weekday: {enabled, open, close}, weekend: {enabled, open, close}, holiday: {enabled, name, start_date, end_date, reopen_date}}

# Payment System Models
class CreatePaymentIntentRequest(BaseModel):
    order_id: str
    amount: float
    currency: str = "nzd"
    restaurant_id: str
    customer_email: Optional[str] = None
    surcharge_amount: Optional[float] = None  # Credit card surcharge for card payments

class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str
    order_id: str

class CreateRefundRequest(BaseModel):
    payment_intent_id: str
    amount: Optional[float] = None  # None for full refund
    reason: str = "requested_by_customer"

class BankAccount(BaseModel):
    bank_name: str
    account_name: str
    account_number: str

class UpdatePaymentSettingsRequest(BaseModel):
    accept_card: Optional[bool] = None
    accept_bank_transfer: Optional[bool] = None
    accept_qr_code: Optional[bool] = None
    accept_pay_at_cashier: Optional[bool] = None
    bank_accounts: Optional[List[BankAccount]] = None

class UpdateStripeKeysRequest(BaseModel):
    stripe_publishable_key: str
    stripe_secret_key: str

class UpdateSurchargeSettingsRequest(BaseModel):
    credit_card_surcharge_enabled: Optional[bool] = None
    credit_card_surcharge_rate: Optional[float] = None

class UploadPaymentSlipRequest(BaseModel):
    order_id: str
    slip_image_base64: str

# ============================================================
# Translation Routes (Existing)
# ============================================================

@app.get("/")
async def root():
    """API health check"""
    return {
        "status": "ok",
        "message": "Smart Menu AI API is running",
        "version": "1.0.0",
        "features": [
            "Translation (50+ languages)",
            "AI Photo Enhancement (Analysis)",
            "AI Image Generation (Prompt creation)",
            "Food Image Analysis"
        ],
        "note": "Full AI capabilities. Imagen generation requires Paid tier."
    }

@app.get("/health")
async def health_check():
    """
    Comprehensive health check for all services
    Returns status of each service and overall health
    """
    import time
    start_time = time.time()

    services_status = {}
    overall_healthy = True

    # 1. Check AI service (Google Gemini)
    try:
        ai_status = "connected" if (hasattr(ai_service, 'ready') and ai_service.ready) else "disconnected"
        services_status["ai_service"] = {
            "status": ai_status,
            "provider": "Google Gemini"
        }
        if ai_status != "connected":
            overall_healthy = False
    except Exception as e:
        services_status["ai_service"] = {"status": "error", "error": str(e)}
        overall_healthy = False

    # 2. Check Supabase Database
    try:
        if supabase:
            # Try a simple query
            result = supabase.table("restaurants").select("id").limit(1).execute()
            services_status["database"] = {
                "status": "connected",
                "provider": "Supabase PostgreSQL"
            }
        else:
            services_status["database"] = {"status": "disconnected", "error": "Client not initialized"}
            overall_healthy = False
    except Exception as e:
        services_status["database"] = {"status": "error", "error": str(e)}
        overall_healthy = False

    # 3. Check Stripe
    try:
        if stripe_service and hasattr(stripe_service, 'stripe'):
            services_status["payment"] = {
                "status": "configured",
                "provider": "Stripe"
            }
        else:
            services_status["payment"] = {"status": "not_configured"}
    except Exception as e:
        services_status["payment"] = {"status": "error", "error": str(e)}

    # 4. Check Supabase Storage
    try:
        if supabase:
            # Check if we can access storage buckets
            buckets = supabase.storage.list_buckets()
            services_status["storage"] = {
                "status": "connected",
                "provider": "Supabase Storage",
                "buckets_count": len(buckets) if buckets else 0
            }
        else:
            services_status["storage"] = {"status": "disconnected"}
    except Exception as e:
        services_status["storage"] = {"status": "error", "error": str(e)}

    # 5. Check Email Service (SendGrid)
    try:
        if email_service and hasattr(email_service, 'api_key') and email_service.api_key:
            services_status["email"] = {
                "status": "configured",
                "provider": "SendGrid"
            }
        else:
            services_status["email"] = {"status": "not_configured"}
    except Exception as e:
        services_status["email"] = {"status": "error", "error": str(e)}

    response_time = round((time.time() - start_time) * 1000, 2)  # in ms

    return {
        "status": "healthy" if overall_healthy else "degraded",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "response_time_ms": response_time,
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "services": services_status,
        "capabilities": {
            "translation": services_status.get("ai_service", {}).get("status") == "connected",
            "image_enhancement": services_status.get("ai_service", {}).get("status") == "connected",
            "image_generation": services_status.get("ai_service", {}).get("status") == "connected",
            "orders": services_status.get("database", {}).get("status") == "connected",
            "payments": services_status.get("payment", {}).get("status") == "configured",
            "email_notifications": services_status.get("email", {}).get("status") == "configured",
        }
    }


@app.get("/health/db")
async def health_check_database():
    """Check database connectivity and response time"""
    import time
    start_time = time.time()

    try:
        if not supabase:
            return {"status": "error", "error": "Database client not initialized"}

        # Test read operation
        result = supabase.table("restaurants").select("id").limit(1).execute()

        response_time = round((time.time() - start_time) * 1000, 2)

        return {
            "status": "connected",
            "response_time_ms": response_time,
            "provider": "Supabase PostgreSQL"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "response_time_ms": round((time.time() - start_time) * 1000, 2)
        }


@app.get("/health/ai")
async def health_check_ai():
    """Check AI service (Google Gemini) connectivity and status"""
    try:
        # Import to check API key status
        from services.ai_service import GEMINI_API_KEY, TEXT_MODEL_NAME, IMAGE_ENHANCEMENT_MODEL, IMAGE_GENERATION_MODEL

        api_key_status = "configured" if GEMINI_API_KEY else "missing"
        api_key_preview = f"{GEMINI_API_KEY[:8]}..." if GEMINI_API_KEY else None

        if not ai_service or not ai_service.ready:
            return {
                "status": "disconnected",
                "error": "AI service not ready - GEMINI_API_KEY or GOOGLE_API_KEY is missing",
                "api_key_status": api_key_status,
                "provider": "Google Gemini",
                "fix": "Please set GEMINI_API_KEY or GOOGLE_API_KEY in your Render environment variables"
            }

        return {
            "status": "connected",
            "provider": "Google Gemini",
            "api_key_status": api_key_status,
            "api_key_preview": api_key_preview,
            "models": {
                "translation": TEXT_MODEL_NAME,
                "image_enhancement": IMAGE_ENHANCEMENT_MODEL,
                "image_generation": IMAGE_GENERATION_MODEL
            },
            "features": {
                "image_generation": True,
                "image_enhancement": True,
                "translation": True
            }
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.get("/health/storage")
async def health_check_storage():
    """Check Supabase Storage connectivity"""
    try:
        if not supabase:
            return {"status": "error", "error": "Supabase client not initialized"}

        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets] if buckets else []

        return {
            "status": "connected",
            "provider": "Supabase Storage",
            "buckets": bucket_names
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/health/stripe")
async def health_check_stripe():
    """Check Stripe connectivity"""
    try:
        if not stripe_service:
            return {"status": "not_configured", "error": "Stripe service not initialized"}

        # Check if API key is configured
        import stripe as stripe_lib
        if not stripe_lib.api_key:
            return {"status": "not_configured", "error": "Stripe API key not set"}

        return {
            "status": "configured",
            "provider": "Stripe",
            "mode": "test" if "test" in (stripe_lib.api_key or "") else "live"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/api/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """
    แปลข้อความจากภาษาใดก็ได้ → อังกฤษ
    ใช้ Gemini API (Free Tier OK)
    """
    try:
        # Validate input
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text to translate cannot be empty")

        if not request.source_lang:
            raise HTTPException(status_code=400, detail="Source language is required")

        # Check language restriction based on plan (Enterprise = 13+ languages, others = English only)
        if request.user_id:
            target = (request.target_lang or "").lower().strip()
            allowed_targets = ['en', 'english']
            if target not in allowed_targets:
                user_status = trial_limits_service.get_user_status(request.user_id)
                user_role = user_status.get('role', 'free_trial')
                if user_role not in ['enterprise', 'admin']:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Translation to {request.target_lang} is only available in Enterprise plan. Your plan supports English translation only."
                    )

        # Translate using AI Service (cost-optimized: gemini-1.5-flash)
        if not ai_service.ready:
            raise HTTPException(status_code=503, detail="AI service is not available. Please check API key configuration.")

        translated = await ai_service.translate(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )

        # Note: If translated == original, it's likely already in target language
        # The ai_service handles logging, no need to duplicate warning here

        return TranslateResponse(
            original_text=request.text,
            translated_text=translated,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Translate endpoint error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/api/translate/batch", response_model=BatchTranslateResponse)
async def translate_batch(request: BatchTranslateRequest):
    """
    แปลข้อความหลายรายการพร้อมกัน (Batch Translation)
    ใช้สำหรับแปลเมนูทั้งหมดในครั้งเดียว
    """
    try:
        # Validate input
        if not request.texts or len(request.texts) == 0:
            raise HTTPException(status_code=400, detail="Texts array cannot be empty")

        # Check language restriction based on plan
        if request.user_id:
            target = (request.target_lang or "").lower().strip()
            allowed_targets = ['en', 'english']
            if target not in allowed_targets:
                user_status = trial_limits_service.get_user_status(request.user_id)
                user_role = user_status.get('role', 'free_trial')
                if user_role not in ['enterprise', 'admin']:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Translation to {request.target_lang} is only available in Enterprise plan. Your plan supports English translation only."
                    )

        # Check AI service
        if not ai_service.ready:
            raise HTTPException(status_code=503, detail="AI service is not available. Please check API key configuration.")

        # Language code mapping
        lang_names = {
            'en': 'English',
            'th': 'Thai',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'vi': 'Vietnamese',
            'hi': 'Hindi',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'id': 'Indonesian',
            'ms': 'Malay',
        }

        target_lang_name = lang_names.get(request.target_lang, request.target_lang)

        print(f"📝 Batch Translation Request: {len(request.texts)} texts → {target_lang_name}")

        # Translate all texts in a single Gemini API call (much faster)
        translations = await ai_service.translate_batch(
            texts=request.texts,
            target_lang=target_lang_name,
            source_lang=request.source_lang if request.source_lang != 'auto' else 'auto'
        )

        print(f"✅ Batch Translation Complete: {len(translations)} texts translated")

        return BatchTranslateResponse(
            translations=translations,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            count=len(translations)
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Batch translate error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Batch translation failed: {str(e)}")

@app.post("/api/detect-language")
async def detect_language(request: DetectLanguageRequest):
    """ตรวจจับภาษาของข้อความ"""
    try:
        # Validate input
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text to detect cannot be empty")
        
        # Detect language using AI Service (cost-optimized: gemini-1.5-flash)
        if not ai_service.ready:
            raise HTTPException(status_code=503, detail="AI service is not available. Please check API key configuration.")
        
        detected = await ai_service.detect_language(request.text)
        
        return {
            "text": request.text,
            "detected_language": detected,
            "confidence": 0.95
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Detect language error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Language detection failed: {str(e)}")

# ============================================================
# Translation Cache API (Menu Translations)
# ============================================================

class SaveMenuTranslationsRequest(BaseModel):
    restaurant_id: str
    language_code: str
    translations: List[Dict[str, Any]]  # List of {menu_id, name, description, category, meats, addons, source_hash}

@app.get("/api/translations/menu/{restaurant_id}", summary="Get Cached Menu Translations")
async def get_menu_translations(restaurant_id: str, language_code: str):
    """
    ดึง cached translations สำหรับเมนูของร้าน

    Args:
        restaurant_id: Restaurant ID หรือ slug
        language_code: รหัสภาษา (th, en, zh, ja, ko, etc.)

    Returns:
        Dictionary with cached translations
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        # Get cached translations
        result = supabase.table("menu_translations") \
            .select("*") \
            .eq("restaurant_id", actual_restaurant_id) \
            .eq("language_code", language_code) \
            .execute()

        # Convert to dictionary keyed by menu_id
        translations_map = {}
        if result.data:
            for item in result.data:
                translations_map[item["menu_id"]] = {
                    "translated_name": item.get("translated_name"),
                    "translated_description": item.get("translated_description"),
                    "translated_category": item.get("translated_category"),
                    "translated_meats": item.get("translated_meats", []),
                    "translated_addons": item.get("translated_addons", []),
                    "source_hash": item.get("source_hash"),
                    "updated_at": item.get("updated_at")
                }

        return {
            "success": True,
            "restaurant_id": actual_restaurant_id,
            "language_code": language_code,
            "count": len(translations_map),
            "translations": translations_map
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get menu translations error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translations/menu", summary="Save Menu Translations to Cache")
async def save_menu_translations(request: SaveMenuTranslationsRequest):
    """
    บันทึก translations ลง cache เพื่อไม่ต้องแปลซ้ำ

    Args:
        restaurant_id: Restaurant ID
        language_code: รหัสภาษา
        translations: List of translations to cache

    Returns:
        Dictionary with save result
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(request.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {request.restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        saved_count = 0
        for trans in request.translations:
            try:
                # Upsert translation - support both field naming conventions
                # Frontend sends: translated_name, translated_description, etc.
                # Also support: name, description (for backwards compatibility)
                data = {
                    "restaurant_id": actual_restaurant_id,
                    "menu_id": trans.get("menu_id"),
                    "language_code": request.language_code,
                    "translated_name": trans.get("translated_name") or trans.get("name"),
                    "translated_description": trans.get("translated_description") or trans.get("description"),
                    "translated_category": trans.get("translated_category") or trans.get("category"),
                    "translated_meats": trans.get("translated_meats") or trans.get("meats", []),
                    "translated_addons": trans.get("translated_addons") or trans.get("addons", []),
                    "source_hash": trans.get("source_hash"),
                    "updated_at": "now()"
                }

                # Use upsert (insert or update on conflict)
                supabase.table("menu_translations").upsert(
                    data,
                    on_conflict="restaurant_id,menu_id,language_code"
                ).execute()

                saved_count += 1
            except Exception as e:
                print(f"⚠️ Failed to save translation for menu {trans.get('menu_id')}: {str(e)}")

        print(f"✅ Saved {saved_count} menu translations for restaurant {actual_restaurant_id}, lang: {request.language_code}")

        return {
            "success": True,
            "saved_count": saved_count,
            "language_code": request.language_code
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Save menu translations error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/translations/menu/{restaurant_id}/{menu_id}", summary="Invalidate Menu Translation Cache")
async def invalidate_menu_translation(restaurant_id: str, menu_id: str):
    """
    ลบ cache ของเมนูที่ถูกแก้ไข (เพื่อให้แปลใหม่)

    Args:
        restaurant_id: Restaurant ID
        menu_id: Menu ID ที่ต้องการ invalidate cache

    Returns:
        Dictionary with delete result
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        # Delete all language translations for this menu item
        result = menu_service.supabase_client.table("menu_translations") \
            .delete() \
            .eq("restaurant_id", actual_restaurant_id) \
            .eq("menu_id", menu_id) \
            .execute()

        print(f"✅ Invalidated translation cache for menu {menu_id}")

        return {
            "success": True,
            "menu_id": menu_id,
            "message": "Translation cache invalidated"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Invalidate menu translation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/translations/menu/{restaurant_id}", summary="Clear All Menu Translation Cache")
async def clear_all_menu_translations(restaurant_id: str, language_code: Optional[str] = None):
    """
    ลบ cache ทั้งหมดของร้าน (หรือเฉพาะภาษา)

    Args:
        restaurant_id: Restaurant ID
        language_code: รหัสภาษา (optional - ถ้าไม่ระบุจะลบทุกภาษา)

    Returns:
        Dictionary with delete result
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        # Build delete query
        query = supabase.table("menu_translations") \
            .delete() \
            .eq("restaurant_id", actual_restaurant_id)

        if language_code:
            query = query.eq("language_code", language_code)

        result = query.execute()

        print(f"✅ Cleared translation cache for restaurant {actual_restaurant_id}" +
              (f", language: {language_code}" if language_code else ""))

        return {
            "success": True,
            "message": f"Translation cache cleared" + (f" for {language_code}" if language_code else "")
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Clear menu translations error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# AI Image Enhancement Routes (NEW)
# ============================================================

# DEPRECATED: Use /api/ai/enhance-image-upload instead
# Note: This endpoint is defined after enhance_image_upload to avoid forward reference


# ============================================================
# AI Image Generation Routes (NEW)
# ============================================================

# DEPRECATED: Use /api/ai/generate-image instead (accepts JSON)
@app.post("/api/ai/generate-photo", deprecated=True)
async def generate_photo(menu_item: MenuItemInput):
    """
    DEPRECATED: Use /api/ai/generate-image instead
    
    This endpoint is kept for backward compatibility.
    New code should use /api/ai/generate-image which accepts JSON.
    """
    try:
        result = ai_service.generate_food_image_from_description(
            menu_item.name,
            menu_item.description or "",
            "general",
            "professional"
        )
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {str(e)}"
        )


# ============================================================
# Tier/Feature Info Routes
# ============================================================

@app.get("/api/features")
async def get_features():
    """
    Get available features and tier requirements
    """
    return {
        "free_tier": {
            "translation": True,
            "language_detection": True,
            "image_analysis": True,
            "limits": {
                "requests_per_minute": 15,
                "max_file_size": "10MB"
            }
        },
        "pro_tier": {
            "all_free_features": True,
            "image_enhancement_analysis": True,
            "generation_prompts": True,
            "batch_processing": True,
            "limits": {
                "requests_per_minute": 60,
                "max_file_size": "50MB",
                "ai_enhancements_per_month": 50
            },
            "price": "$69/month"
        },
        "premium_tier": {
            "all_pro_features": True,
            "unlimited_enhancements": True,
            "ai_image_generation": "Coming soon (Requires Imagen API)",
            "priority_support": True,
            "limits": {
                "requests_per_minute": "unlimited",
                "max_file_size": "100MB",
                "ai_generations_per_month": 200
            },
            "price": "$99/month"
        },
        "note": (
            "Actual image generation/editing requires Imagen API. "
            "Currently providing analysis and prompt generation only."
        )
    }

@app.get("/api/pricing")
async def get_pricing():
    """Get pricing information"""
    return {
        "starter": {
            "name": "Starter",
            "price": 39,
            "currency": "NZD",
            "billing": "monthly",
            "features": [
                "Smart Menu with QR Code",
                "Translation (50+ languages)",
                "Manual photo upload",
                "Up to 20 menu items",
                "Basic analytics"
            ]
        },
        "pro": {
            "name": "Pro",
            "price": 69,
            "currency": "NZD",
            "billing": "monthly",
            "features": [
                "Everything in Starter",
                "AI Photo Enhancement (Analysis)",
                "Food image analysis",
                "Up to 50 menu items",
                "50 AI analyses/month",
                "Priority support"
            ],
            "most_popular": True
        },
        "premium": {
            "name": "Premium",
            "price": 99,
            "currency": "NZD",
            "billing": "monthly",
            "features": [
                "Everything in Pro",
                "AI Image Generation (Coming soon)",
                "Batch processing",
                "Up to 200 menu items",
                "200 AI generations/month",
                "Custom branding",
                "Dedicated support"
            ]
        }
    }

# ============================================================
# Menu Management Routes (NEW)
# ============================================================

@app.post("/api/menu", summary="Save Menu Item")
async def save_menu_item(menu_item: SaveMenuItemRequest):
    """
    บันทึก menu item ใหม่
    
    รองรับ:
    - ชื่อภาษาท้องถิ่น + อังกฤษ
    - คำอธิบายภาษาท้องถิ่น + อังกฤษ
    - Category
    - Add-ons
    - รูปภาพ
    """
    try:
        menu_data = menu_item.dict()
        
        # Allow saving without image_url if generation failed
        if not menu_data.get("image_url") and menu_data.get("photo_url"):
            menu_data["image_url"] = menu_data["photo_url"]
        
        # Validate restaurant_id
        if not menu_item.restaurant_id or menu_item.restaurant_id == 'default':
            raise HTTPException(status_code=400, detail="Valid restaurant_id is required. Please select a restaurant.")
        
        # Check menu items limit based on plan
        try:
            rest_result = restaurant_service.supabase_client.table('restaurants').select('user_id').eq('id', menu_item.restaurant_id).limit(1).execute()
            if rest_result.data and rest_result.data[0].get('user_id'):
                owner_user_id = rest_result.data[0]['user_id']
                current_count = menu_service.count_menu_items(menu_item.restaurant_id)
                owner_status = trial_limits_service.get_user_status(owner_user_id)
                menu_limit = owner_status.get('limits', {}).get('menu_items', 20)
                if menu_limit < 999999 and current_count >= menu_limit:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Menu items limit reached ({current_count}/{menu_limit}). Please upgrade your plan to add more items."
                    )
        except HTTPException:
            raise
        except Exception as limit_err:
            print(f"⚠️ Menu limit check failed (allowing save): {limit_err}")

        print(f"🔄 Saving menu item for restaurant: {menu_item.restaurant_id}")
        print(f"   Name: {menu_data.get('name', 'N/A')}")
        print(f"   Price: {menu_data.get('price', 'N/A')}")
        print(f"   Category: {menu_data.get('category', 'N/A')}")
        print(f"   Menu Type: {menu_data.get('menu_type', 'food')}")
        print(f"   Meats: {len(menu_data.get('meats', []))} options")
        print(f"   AddOns: {len(menu_data.get('addOns', []))} options")
        print(f"   Is Best Seller: {menu_data.get('is_best_seller', False)}")

        # Save to Supabase (NO FALLBACK!)
        saved_item = menu_service.create_menu_item(menu_item.restaurant_id, menu_data)
        
        if not saved_item:
            raise HTTPException(status_code=500, detail="Failed to save menu item to database. Please check logs.")
        
        print(f"✅ Menu item saved successfully with ID: {saved_item.get('menu_id')}")
        
        return {
            "success": True,
            "message": "Menu item saved successfully",
            "menu_item": saved_item
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to save menu item: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save menu item: {str(e)}")

@app.get("/api/menus", summary="Get All Menu Items")
async def get_menu_items(restaurant_id: str = "default"):
    """
    ดึง menu items ทั้งหมดของร้าน (สำหรับ owner view - รวม hidden items)
    IMPORTANT: ดึงจาก Supabase Database เท่านั้น (ไม่ใช้ mock data)
    """
    try:
        # Use menu_service (Supabase) instead of menu_storage (in-memory)
        # First, try to get restaurant_id from user_id if restaurant_id is "default"
        if restaurant_id == "default":
            # Try to get restaurant for current user (if authenticated)
            # For now, return empty if default
            items = []
        else:
            # Validate UUID format
            if menu_service._is_valid_uuid(restaurant_id):
                # Owner view: include hidden items (is_active=false)
                items = menu_service.get_menu_items(restaurant_id, include_hidden=True)
            else:
                # Fallback to menu_storage for backward compatibility (will be removed)
                items = menu_storage.get_menu_items(restaurant_id)
        
        return {
            "success": True,
            "count": len(items),
            "items": items
        }
    except Exception as e:
        print(f"❌ Failed to fetch menu items: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch menu items: {str(e)}")

@app.get("/api/menu/{menu_id}", summary="Get Single Menu Item")
async def get_menu_item(menu_id: str, restaurant_id: str = "default"):
    """
    ดึง menu item เดียว (from Supabase)
    """
    try:
        # Try Supabase first
        item = None
        if menu_service._is_valid_uuid(menu_id):
            item = menu_service.get_menu_item(menu_id)
        
        # Fallback to in-memory if not found
        if not item:
            item = menu_storage.get_menu_item(menu_id, restaurant_id)
        
        if not item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        return {
            "success": True,
            "menu_item": item
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch menu item: {str(e)}")

@app.put("/api/menu/{menu_id}", summary="Update Menu Item")
async def update_menu_item(menu_id: str, menu_item: SaveMenuItemRequest):
    """
    แก้ไข menu item
    Updates menu item in Supabase database
    """
    try:
        menu_data = menu_item.dict()

        # Debug logging for is_best_seller and is_active
        print(f"📝 PUT /api/menu/{menu_id}")
        print(f"   is_best_seller in request: {menu_data.get('is_best_seller')}")
        print(f"   is_active in request: {menu_data.get('is_active')}")

        # Try Supabase first (preferred)
        updated_item = None
        try:
            updated_item = menu_service.update_menu_item(menu_id, menu_data)
        except Exception as e:
            print(f"❌ Menu Service update failed: {str(e)}")
            # Fallback to in-memory storage for backward compatibility
            updated_item = menu_storage.update_menu_item(menu_id, menu_data, menu_item.restaurant_id or "default")
        
        if not updated_item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        return {
            "success": True,
            "message": "Menu item updated successfully",
            "menu_item": updated_item
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to update menu item: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update menu item: {str(e)}")

@app.delete("/api/menu/{menu_id}", summary="Delete Menu Item")
async def delete_menu_item(menu_id: str, restaurant_id: str = "default"):
    """
    ลบ menu item
    """
    try:
        success = menu_storage.delete_menu_item(menu_id, restaurant_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        return {
            "success": True,
            "message": "Menu item deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete menu item: {str(e)}")

@app.get("/api/menu-stats", summary="Get Menu Statistics")
async def get_menu_stats(restaurant_id: str = "default"):
    """
    สถิติของร้าน (from Supabase)
    """
    try:
        # Use Supabase instead of in-memory storage
        if restaurant_id == "default" or not menu_service._is_valid_uuid(restaurant_id):
            # Return empty stats if invalid restaurant_id
            return {
                "success": True,
                "stats": {
                    "total_items": 0,
                    "categories": 0,
                    "with_images": 0
                }
            }
        
        # Get menus from Supabase
        menus = menu_service.get_menu_items(restaurant_id)
        
        # Calculate stats
        categories = set()
        with_images = 0
        
        for menu in menus:
            if menu.get('category'):
                categories.add(menu.get('category'))
            if menu.get('image_url') or menu.get('photo_url'):
                with_images += 1
        
        stats = {
            "total_items": len(menus),
            "categories": len(categories),
            "with_images": with_images
        }
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        print(f"❌ Failed to fetch menu stats: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

# ============================================================
# AI Image Generation Routes
# ============================================================

@app.post("/api/ai/enhance-image", summary="AI Image Enhancement (JSON)", deprecated=True)
async def enhance_image(request: Dict[str, Any]):
    """
    DEPRECATED: Use /api/ai/enhance-image-upload instead for better performance.
    
    This endpoint accepts JSON with base64 image for backward compatibility.
    New code should use /api/ai/enhance-image-upload which accepts file upload directly.
    """
    try:
        image = request.get("image", "")
        style = request.get("style", "professional")
        
        if not image:
            raise HTTPException(status_code=400, detail="image is required")
        
        # Convert base64 to bytes for enhance_image_with_ai
        if ',' in image:
            image = image.split(',')[1]
        
        import base64
        image_bytes = base64.b64decode(image)
        
        # Use the new enhance_image_with_ai function
        result = ai_service.enhance_image_with_ai(image_bytes, style)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image enhancement failed: {str(e)}")

@app.post("/api/ai/enhance-image-upload", summary="AI Image Enhancement (Upload File)")
async def enhance_image_upload(
    file: UploadFile = File(...),
    style: Optional[str] = Form("professional"),
    user_instruction: Optional[str] = Form(None),  # User's custom instruction
    user_id: Optional[str] = Form("default"),  # Default for testing, should come from auth
    logo_overlay: Optional[str] = Form(None)  # JSON string with logo overlay config
):
    """
    อัปเกรดรูปภาพถ่ายให้สวยระดับมืออาชีพ
    
    รับไฟล์รูปภาพที่อัปโหลดมา แล้วใช้ AI (gemini-3-pro-image-preview) 
    เพื่อปรับแต่งให้เป็นภาพถ่ายอาหารระดับมืออาชีพ พร้อมอัปโหลดไปยัง Supabase Storage
    
    Trial Limit: 1 image enhancement สำหรับ Free Trial
    
    Args:
        file: ไฟล์รูปภาพที่อัปโหลด
        style: สไตล์การปรับแต่ง (professional, natural, vibrant) - default: professional
        user_instruction: คำสั่งเพิ่มเติมจากผู้ใช้ (optional, e.g., "make it brighter", "change plate to white")
        user_id: User ID สำหรับตรวจสอบ trial limits
        
    Returns:
        Dictionary with:
        - success: bool
        - enhanced_image_url: Public URL จาก Supabase Storage
        - enhanced_image: Base64 data URL สำหรับ preview
        - style: สไตล์ที่ใช้
        - model_used: Model ที่ใช้
        - note: ข้อความอธิบาย
    """
    try:
        # Check trial limits
        limit_check = trial_limits_service.check_limit(user_id, "image_enhancement")
        if not limit_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Trial limit exceeded",
                    "message": limit_check["message"],
                    "limit": limit_check["limit"],
                    "remaining": limit_check["remaining"]
                }
            )
        # Check storage limit
        storage_check = trial_limits_service.check_storage_limit(user_id)
        if not storage_check["allowed"]:
            raise HTTPException(status_code=403, detail=storage_check["message"])

        # Validate file using comprehensive validation
        image_bytes, detected_type = await validate_image_upload(
            file,
            max_size_mb=10,  # 10MB max for image enhancement
            allowed_types=['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )
        
        # Validate style
        valid_styles = ["professional", "natural", "vibrant"]
        if style not in valid_styles:
            style = "professional"
        
        print(f"📸 Image Enhancement Request:")
        print(f"   File: {file.filename}")
        print(f"   Size: {len(image_bytes)} bytes")
        print(f"   Style: {style}")
        
        # Parse logo_overlay if provided
        logo_overlay_config = None
        if logo_overlay:
            try:
                import json
                logo_overlay_config = json.loads(logo_overlay)
                print(f"   Logo Overlay: {logo_overlay_config.get('position', 'N/A')}")
            except:
                print("   ⚠️ Failed to parse logo_overlay, ignoring")

        # Get user's plan for watermark (Enterprise = no watermark)
        user_plan = user_role_service.get_user_role(user_id) if user_id != "default" else "free_trial"
        print(f"   User Plan: {user_plan}")

        # Call AI enhancement service
        result = ai_service.enhance_image_with_ai(image_bytes, style, user_instruction, logo_overlay_config, user_plan)
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Image enhancement failed")
            )
        
        print(f"✅ Image Enhancement Result: success={result.get('success')}")
        if result.get("enhanced_image_url"):
            print(f"   Public URL: {result.get('enhanced_image_url')}")
        
        # Increment usage count if successful
        if result.get("success"):
            trial_limits_service.increment_usage(user_id, "image_enhancement")
            status = trial_limits_service.get_user_status(user_id)
            # Handle infinity values for JSON serialization
            remaining = limit_check["remaining"]
            limit = limit_check["limit"]
            if remaining == float('inf') or remaining >= 999999:
                remaining = 999999
            if limit == float('inf') or limit >= 999999:
                limit = 999999
            
            result["trial_info"] = {
                "remaining": max(0, remaining - 1) if remaining < 999999 else 999999,
                "limit": limit,
                "message": f"{max(0, remaining - 1) if remaining < 999999 else 'Unlimited'} enhancements remaining"
            }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Image enhancement error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Image enhancement failed: {str(e)}"
        )

@app.post("/api/image/apply-logo", summary="Apply Logo Only (No AI Enhancement)")
async def apply_logo_only(
    file: UploadFile = File(...),
    logo_url: str = Form(...),
    position: Optional[str] = Form("top-right"),
    logo_size: Optional[str] = Form("medium")  # small, medium, large
):
    """
    ใส่โลโก้ร้านอาหารบนรูปภาพโดยไม่มีการแก้ไขภาพใดๆ

    ฟังก์ชันนี้จะใส่โลโก้อย่างเดียว ไม่มี AI enhancement, ไม่มี sharpening, ไม่มี contrast adjustment
    เหมาะสำหรับเมื่อผู้ใช้ต้องการใส่โลโก้บนรูปที่มีอยู่แล้วโดยไม่ต้องการเปลี่ยนแปลงภาพ

    Args:
        file: ไฟล์รูปภาพที่ต้องการใส่โลโก้
        logo_url: URL ของโลโก้ร้านอาหาร
        position: ตำแหน่งของโลโก้ (top-left, top-center, top-right, bottom-left, bottom-center, bottom-right)
        logo_size: ขนาดของโลโก้ (small=12%, medium=18%, large=25%)

    Returns:
        Dictionary with:
        - success: bool
        - image_url: Public URL ของภาพที่ใส่โลโก้แล้ว
        - position: ตำแหน่งที่ใส่โลโก้
        - note: ข้อความอธิบาย
    """
    try:
        # Validate file using comprehensive validation
        image_bytes, detected_type = await validate_image_upload(
            file,
            max_size_mb=10,  # 10MB max
            allowed_types=['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )

        # Validate logo_url
        if not logo_url or not logo_url.startswith('http'):
            raise HTTPException(
                status_code=400,
                detail="Valid logo URL is required"
            )

        # Validate position
        valid_positions = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]
        if position not in valid_positions:
            position = "top-right"

        # Validate logo_size
        valid_sizes = ["small", "medium", "large"]
        if logo_size not in valid_sizes:
            logo_size = "medium"

        print(f"🎨 Apply Logo Only Request:")
        print(f"   File: {file.filename}")
        print(f"   Size: {len(image_bytes)} bytes")
        print(f"   Logo URL: {logo_url[:50]}...")
        print(f"   Position: {position}")
        print(f"   Logo Size: {logo_size}")

        # Call AI service to apply logo (no enhancement)
        result = ai_service.apply_logo_only(image_bytes, logo_url, position, logo_size)

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to apply logo")
            )

        print(f"✅ Logo Applied Successfully: {result.get('image_url', '')[:50]}...")

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Apply logo error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply logo: {str(e)}"
        )

@app.post("/api/ai/generate-image", summary="AI Image Generation from Description")
async def generate_image(request: Dict[str, Any]):
    """
    สร้างรูปอาหารจากคำอธิบายด้วย AI
    
    Trial Limit: 2 image generations สำหรับ Free Trial
    
    Args:
        dish_name: ชื่ออาหาร
        description: คำอธิบายอาหาร
        cuisine_type: ประเภทอาหาร
        style: สไตล์ภาพ
        user_id: User ID สำหรับตรวจสอบ trial limits (optional, default: "default")
    """
    try:
        dish_name = request.get("dish_name", "")
        description = request.get("description", "")
        cuisine_type = request.get("cuisine_type", "general")
        style = request.get("style", "professional")
        user_id = request.get("user_id", "default")  # Default for testing, should come from auth
        logo_overlay = request.get("logo_overlay")  # Logo overlay configuration
        
        print(f"🎨 Image Generation Request:")
        print(f"   Dish: {dish_name}")
        print(f"   Description: {description[:50]}...")
        print(f"   Cuisine: {cuisine_type}")
        print(f"   Style: {style}")
        print(f"   User ID: {user_id}")
        if logo_overlay:
            print(f"   Logo Overlay: {logo_overlay.get('position', 'N/A')}")
        
        if not dish_name:
            raise HTTPException(status_code=400, detail="dish_name is required")
        
        # Check trial limits
        limit_check = trial_limits_service.check_limit(user_id, "image_generation")
        if not limit_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Trial limit exceeded",
                    "message": limit_check["message"],
                    "limit": limit_check["limit"],
                    "remaining": limit_check["remaining"]
                }
            )

        # Check storage limit
        storage_check = trial_limits_service.check_storage_limit(user_id)
        if not storage_check["allowed"]:
            raise HTTPException(status_code=403, detail=storage_check["message"])

        # Get user's plan for watermark (Enterprise = no watermark)
        user_plan = user_role_service.get_user_role(user_id) if user_id != "default" else "free_trial"
        print(f"   User Plan: {user_plan}")

        result = ai_service.generate_food_image_from_description(
            dish_name, description, cuisine_type, style, logo_overlay, user_plan
        )
        
        print(f"✅ Image Generation Result: success={result.get('success', False)}")
        if result.get('error'):
            print(f"   Error: {result.get('error')}")
        if result.get('generated_image'):
            print(f"   Image generated! Size: {len(result.get('generated_image_base64', ''))} bytes")
        else:
            print(f"   Note: {result.get('note', 'No note')}")
        
        # Increment usage count if successful
        if result.get("success"):
            trial_limits_service.increment_usage(user_id, "image_generation")
            # Handle infinity values for JSON serialization
            remaining = limit_check["remaining"]
            limit = limit_check["limit"]
            if remaining == float('inf') or remaining >= 999999:
                remaining = 999999
            if limit == float('inf') or limit >= 999999:
                limit = 999999
            
            result["trial_info"] = {
                "remaining": max(0, remaining - 1) if remaining < 999999 else 999999,
                "limit": limit,
                "message": f"{max(0, remaining - 1) if remaining < 999999 else 'Unlimited'} generations remaining"
            }
            
            # If menu_id is provided, update image_url in database
            menu_id = request.get("menu_id")
            if menu_id and result.get("generated_image_url"):
                try:
                    updated = menu_service.update_menu_image_url(menu_id, result.get("generated_image_url"))
                    if updated:
                        print(f"✅ Updated image_url for menu {menu_id}")
                        result["menu_updated"] = True
                    else:
                        print(f"⚠️ Failed to update image_url for menu {menu_id}")
                except Exception as e:
                    print(f"⚠️ Error updating menu image_url: {str(e)}")
                    # Don't fail the request if menu update fails
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Image Generation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@app.post("/api/ai/upload-image", summary="Upload Base64 Image to Supabase")
async def upload_image_to_supabase(request: Dict[str, Any]):
    """
    อัปโหลดรูปภาพจาก Base64 ไปยัง Supabase Storage
    
    ใช้สำหรับอัปโหลดรูปภาพที่ generate/enhance ไปแล้วก่อนหน้านี้
    หรือรูปภาพที่มี base64 อยู่แล้ว
    
    Args:
        image_base64: Base64 encoded image (with or without data URL prefix)
        folder: Folder name in Supabase Storage (default: "generated")
        bucket_name: Bucket name (default: "menu-images")
        
    Returns:
        Dictionary with:
        - success: bool
        - public_url: Public URL จาก Supabase Storage
        - filename: ชื่อไฟล์ที่อัปโหลด
    """
    try:
        image_base64 = request.get("image_base64", "")
        folder = request.get("folder", "generated")
        bucket_name = request.get("bucket_name", "menu-images")
        
        if not image_base64:
            raise HTTPException(
                status_code=400,
                detail="image_base64 is required"
            )
        
        print(f"📤 Upload Image Request:")
        print(f"   Folder: {folder}")
        print(f"   Bucket: {bucket_name}")
        print(f"   Image size: {len(image_base64)} chars")
        
        # Upload to Supabase Storage
        public_url = ai_service.upload_image_to_supabase(
            image_base64=image_base64,
            bucket_name=bucket_name,
            folder=folder
        )
        
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to upload image to Supabase Storage"
            )
        
        # Extract filename from URL
        filename = public_url.split('/')[-1] if '/' in public_url else "unknown"
        
        print(f"✅ Image uploaded successfully: {public_url}")
        
        return {
            "success": True,
            "public_url": public_url,
            "filename": filename,
            "folder": folder,
            "bucket_name": bucket_name,
            "note": f"Image uploaded successfully to {bucket_name}/{folder}/"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Image upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Image upload failed: {str(e)}"
        )


@app.get("/api/trial/status/{user_id}", summary="Get Trial Status")
async def get_trial_status(user_id: str):
    """
    ดูสถานะ Trial และจำนวนการใช้งานที่เหลือ
    
    Args:
        user_id: User ID
        
    Returns:
        Dictionary with trial status and limits
    """
    try:
        status = trial_limits_service.get_user_status(user_id)
        return {
            "success": True,
            **status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trial/initialize", summary="Initialize Trial for User")
async def initialize_trial(request: TrialStatusRequest):
    """
    เริ่มต้น Trial สำหรับ user ใหม่
    
    Args:
        user_id: User ID
        
    Returns:
        Dictionary with trial information
    """
    try:
        status = trial_limits_service.initialize_user(request.user_id)
        return {
            "success": True,
            **status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Stripe Subscription Billing Routes
# ============================================================

PLAN_PRICES = {
    'basic': {'monthly': 39.00, 'yearly': 390.00},
    'pro': {'monthly': 89.00, 'yearly': 890.00},
    'enterprise': {'monthly': 199.00, 'yearly': 1990.00},
}

PLAN_TO_ROLE = {
    'basic': 'starter',
    'pro': 'professional',
    'enterprise': 'enterprise',
}


@app.post("/api/billing/create-checkout-session", summary="Create Stripe Checkout Session")
async def billing_create_checkout_session(request: StripeCheckoutRequest):
    """
    Create a Stripe Checkout Session for subscription billing.
    Returns a URL to redirect the user to Stripe's hosted checkout page.
    """
    try:
        # Validate plan and interval
        price_id = STRIPE_PRICE_IDS.get(request.plan_id, {}).get(request.interval)
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Invalid plan or interval: {request.plan_id}/{request.interval}")

        # Get or create Stripe Customer
        customer_id = stripe_subscription_service.get_or_create_customer(
            supabase_client=restaurant_service.supabase_client,
            user_id=request.user_id,
            email=request.user_email,
        )

        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        success_url = request.success_url or f"{frontend_url}/checkout/success"
        cancel_url = request.cancel_url or f"{frontend_url}/checkout?plan={request.plan_id}&interval={request.interval}"

        result = stripe_subscription_service.create_checkout_session(
            customer_id=customer_id,
            price_id=price_id,
            user_id=request.user_id,
            plan_id=request.plan_id,
            interval=request.interval,
            success_url=success_url,
            cancel_url=cancel_url,
        )

        return {
            "success": True,
            "url": result['url'],
            "session_id": result['session_id'],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/billing/create-portal-session", summary="Create Stripe Customer Portal Session")
async def billing_create_portal_session(request: StripePortalRequest):
    """
    Create a Stripe Customer Portal session for self-service subscription management.
    """
    try:
        # Get user's stripe_customer_id
        profile = user_role_service.supabase_client.table('user_profiles').select(
            'stripe_customer_id'
        ).eq('user_id', request.user_id).single().execute()

        customer_id = profile.data.get('stripe_customer_id') if profile.data else None
        if not customer_id:
            raise HTTPException(status_code=400, detail="No Stripe customer found. Please subscribe first.")

        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        return_url = request.return_url or f"{frontend_url}/dashboard/settings"

        result = stripe_subscription_service.create_portal_session(
            customer_id=customer_id,
            return_url=return_url,
        )

        return {
            "success": True,
            "url": result['url'],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Stripe portal error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/billing/cancel", summary="Cancel Stripe Subscription")
async def billing_cancel(request: BillingCancelRequest):
    """
    Cancel subscription at end of current billing period.
    """
    try:
        profile = user_role_service.supabase_client.table('user_profiles').select(
            'stripe_subscription_id'
        ).eq('user_id', request.user_id).single().execute()

        subscription_id = profile.data.get('stripe_subscription_id') if profile.data else None
        if not subscription_id:
            raise HTTPException(status_code=400, detail="No active subscription found")

        result = stripe_subscription_service.cancel_subscription(subscription_id)

        # Update cancel_at_period_end in DB
        now = datetime.now()
        user_role_service.supabase_client.table('user_profiles').update({
            'cancel_at_period_end': True,
            'updated_at': now.isoformat(),
        }).eq('user_id', request.user_id).execute()

        print(f"Cancelled subscription for user {request.user_id} at period end")

        return {
            "success": True,
            "status": "cancelling",
            "cancel_at_period_end": True,
            "current_period_end": result.get('current_period_end'),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Billing cancel error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/billing/subscription/{user_id}", summary="Get Subscription Details")
async def get_billing_subscription(user_id: str):
    """
    Get current subscription details for a user.
    """
    try:
        profile = user_role_service.supabase_client.table('user_profiles').select(
            'plan, subscription_status, billing_interval, stripe_subscription_id, '
            'stripe_customer_id, billing_provider, subscription_start_date, '
            'subscription_end_date, next_billing_date, cancel_at_period_end'
        ).eq('user_id', user_id).single().execute()

        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "success": True,
            "subscription": profile.data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhooks/stripe-subscription", summary="Stripe Subscription Webhook Handler")
async def stripe_subscription_webhook(request: Request):
    """
    Handle Stripe webhook events for subscription lifecycle.
    Events: checkout.session.completed, customer.subscription.updated,
    customer.subscription.deleted, invoice.payment_failed
    """
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature', '')

        result = stripe_subscription_service.handle_webhook_event(
            payload=payload,
            sig_header=sig_header,
            supabase_client=restaurant_service.supabase_client,
        )

        return result

    except Exception as e:
        print(f"Stripe subscription webhook error: {str(e)}")
        return {"received": True, "error": str(e)}

# ============================================================
# Payment System Routes (Order Payments)
# ============================================================

@app.post("/api/payments/create-intent", summary="Create Payment Intent")
async def create_payment_intent(request: CreatePaymentIntentRequest):
    """
    สร้าง Stripe Payment Intent สำหรับการชำระเงินของ Order

    Args:
        order_id: Order ID
        amount: ยอดเงิน (NZD)
        restaurant_id: Restaurant ID
        customer_email: Optional email for receipt
    """
    try:
        # Validate amount
        if not request.amount or request.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid amount. Amount must be greater than 0")

        # Get order to verify it exists
        order = orders_service.get_order(request.order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Check if restaurant has its own Stripe keys
        restaurant_stripe_key = None
        try:
            restaurant_result = supabase_client.table('restaurants').select(
                'stripe_secret_key, stripe_publishable_key, name'
            ).eq('id', request.restaurant_id).limit(1).execute()

            if restaurant_result.data and restaurant_result.data[0].get('stripe_secret_key'):
                restaurant_stripe_key = restaurant_result.data[0]['stripe_secret_key']
                print(f"✅ Using restaurant's own Stripe key for {request.restaurant_id}")
        except Exception as db_error:
            print(f"⚠️ Failed to check restaurant Stripe keys: {db_error}")

        # Fallback to platform key if restaurant has no keys
        if not restaurant_stripe_key and not stripe_service.api_key:
            raise HTTPException(status_code=500, detail="Payment system not configured. Please contact the restaurant.")

        # Create payment intent using restaurant's key or platform key
        import stripe as stripe_module
        try:
            api_key = restaurant_stripe_key or stripe_service.api_key
            amount_cents = int(round(request.amount * 100))

            intent = stripe_module.PaymentIntent.create(
                amount=amount_cents,
                currency=request.currency,
                api_key=api_key,
                automatic_payment_methods={"enabled": True},
                metadata={
                    "order_id": request.order_id,
                    "restaurant_id": request.restaurant_id,
                    "platform": "sweetasmenu",
                },
                receipt_email=request.customer_email if request.customer_email else None,
                description=f"Order payment - SweetAsMenu",
            )

            result = {
                "payment_intent_id": intent.id,
                "client_secret": intent.client_secret,
            }
        except Exception as stripe_error:
            print(f"❌ Stripe error in create_payment_intent: {str(stripe_error)}")
            raise HTTPException(status_code=500, detail=f"Payment service error: {str(stripe_error)}")

        # Update order with payment_intent_id and surcharge if applicable
        update_data = {
            "payment_intent_id": result["payment_intent_id"],
            "payment_status": "processing",
            "payment_method": "card"
        }

        # Update surcharge and total if provided (card payment surcharge)
        if request.surcharge_amount is not None and request.surcharge_amount > 0:
            # Get current order to calculate new total
            current_subtotal = order.get("subtotal", 0) or 0
            current_delivery_fee = order.get("delivery_fee", 0) or 0
            new_total = current_subtotal + current_delivery_fee + request.surcharge_amount

            update_data["surcharge_amount"] = request.surcharge_amount
            update_data["total_price"] = new_total

        orders_service.update_order(
            order_id=request.order_id,
            data=update_data
        )

        return {
            "success": True,
            "client_secret": result["client_secret"],
            "payment_intent_id": result["payment_intent_id"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error in create_payment_intent: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payments/confirm", summary="Confirm Payment")
async def confirm_payment(request: ConfirmPaymentRequest):
    """
    ยืนยันว่า Payment สำเร็จแล้ว และอัปเดต Order status
    """
    try:
        print(f"🔄 Confirming payment for order {request.order_id}, payment_intent: {request.payment_intent_id}")

        # Verify payment with Stripe
        result = stripe_service.confirm_payment(
            payment_intent_id=request.payment_intent_id,
            order_id=request.order_id
        )

        print(f"📋 Stripe confirmation result: paid={result.get('paid')}, status={result.get('status')}")

        if result["paid"]:
            # Update order status to paid and move to kitchen queue
            from datetime import datetime
            updated_order = orders_service.update_order(
                order_id=request.order_id,
                data={
                    "payment_status": "paid",
                    "paid_at": datetime.now().isoformat(),
                    "payment_receipt_url": result.get("receipt_url"),
                    "status": "verifying_payment"  # Staff will verify payment before sending to kitchen
                }
            )

            if updated_order:
                print(f"✅ Order {request.order_id} status updated to 'verifying_payment' - awaiting staff verification in POS")
            else:
                print(f"⚠️ Failed to update order {request.order_id} status")

            return {
                "success": True,
                "paid": True,
                "receipt_url": result.get("receipt_url"),
                "message": "Payment successful. Awaiting staff verification."
            }
        else:
            print(f"⚠️ Payment not completed for order {request.order_id}: status={result.get('status')}")
            return {
                "success": False,
                "paid": False,
                "status": result["status"],
                "message": "Payment not completed"
            }

    except Exception as e:
        print(f"❌ Payment confirmation error for order {request.order_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/payments/status/{payment_intent_id}", summary="Get Payment Status")
async def get_payment_status(payment_intent_id: str):
    """
    ตรวจสอบสถานะการชำระเงินจาก Stripe Payment Intent
    Used by POS to verify payment before confirming order
    """
    try:
        result = stripe_service.retrieve_payment_intent(payment_intent_id)

        return {
            "success": True,
            "payment_intent_id": result["payment_intent_id"],
            "status": result["status"],
            "paid": result["paid"],
            "amount": result["amount"],
            "currency": result["currency"],
            "receipt_url": result.get("receipt_url"),
        }

    except Exception as e:
        print(f"❌ Error checking payment status: {str(e)}")
        return {
            "success": False,
            "status": "unknown",
            "paid": False,
            "error": str(e)
        }


@app.post("/api/payments/refund", summary="Create Refund")
async def create_refund(request: CreateRefundRequest):
    """
    สร้าง Refund สำหรับ Order ที่ยกเลิก
    """
    try:
        result = stripe_service.create_refund(
            payment_intent_id=request.payment_intent_id,
            amount=request.amount,
            reason=request.reason
        )

        return {
            "success": True,
            "refund_id": result["refund_id"],
            "status": result["status"],
            "amount": result["amount"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payments/bank-transfer/confirm", summary="Confirm Bank Transfer Payment")
async def confirm_bank_transfer(order_id: str):
    """
    เจ้าของร้านยืนยันว่าได้รับเงินจาก Bank Transfer แล้ว (Manual verification)
    """
    try:
        from datetime import datetime

        # Update order payment status
        updated = orders_service.update_order(
            order_id=order_id,
            data={
                "payment_status": "paid",
                "paid_at": datetime.now().isoformat(),
                "status": "pending"  # Move to kitchen queue
            }
        )

        if not updated:
            raise HTTPException(status_code=404, detail="Order not found")

        return {
            "success": True,
            "message": "Bank transfer confirmed. Order sent to kitchen."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/payments/upload-slip", summary="Upload Payment Slip")
async def upload_payment_slip(request: UploadPaymentSlipRequest):
    """
    ลูกค้าอัปโหลดสลิปการโอนเงิน
    """
    try:
        import base64
        import uuid

        # Decode base64 image
        try:
            image_data = base64.b64decode(request.slip_image_base64)
        except Exception as decode_error:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(decode_error)}")

        # Upload to Supabase Storage using ai_service's supabase client
        if not ai_service.supabase_client:
            raise HTTPException(status_code=500, detail="Storage service not available")

        # Use unique filename to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        file_path = f"payment-slips/{request.order_id}_{unique_id}.jpg"

        try:
            # Try to upload image - use file_options dict properly
            result = ai_service.supabase_client.storage.from_("payment-slips").upload(
                path=file_path,
                file=image_data,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
        except Exception as upload_error:
            # If bucket doesn't exist or other storage error, try to handle gracefully
            error_msg = str(upload_error).lower()
            if "bucket" in error_msg or "not found" in error_msg:
                raise HTTPException(
                    status_code=500,
                    detail="Payment slip storage is not configured. Please contact the restaurant."
                )
            raise HTTPException(status_code=500, detail=f"Failed to upload slip: {str(upload_error)}")

        # Get public URL
        public_url = ai_service.supabase_client.storage.from_("payment-slips").get_public_url(file_path)

        # Update order with slip URL
        try:
            orders_service.update_order(
                order_id=request.order_id,
                data={
                    "payment_slip_url": public_url,
                    "payment_status": "processing",  # Waiting for verification
                    "payment_method": "bank_transfer",
                    "status": "verifying_payment"  # Staff will verify payment before sending to kitchen
                }
            )
        except Exception as update_error:
            print(f"⚠️ Warning: Failed to update order with slip URL: {str(update_error)}")
            # Still return success since slip was uploaded

        return {
            "success": True,
            "slip_url": public_url,
            "message": "Payment slip uploaded. Waiting for verification."
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Upload slip error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================================
# Restaurant Payment Settings Routes
# ============================================================

@app.get("/api/restaurant/{restaurant_id}/payment-settings", summary="Get Payment Settings")
async def get_payment_settings(restaurant_id: str):
    """
    ดึงข้อมูล Payment Settings ของร้าน
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        payment_settings = restaurant.get("payment_settings", {
            "accept_card": True,
            "accept_bank_transfer": False,
            "accept_qr_code": True,
            "accept_pay_at_cashier": True,
            "bank_accounts": []
        })
        # Ensure defaults for existing restaurants
        if "accept_qr_code" not in payment_settings:
            payment_settings["accept_qr_code"] = True
        if "accept_pay_at_cashier" not in payment_settings:
            payment_settings["accept_pay_at_cashier"] = True

        # Include Stripe connection status and publishable key for payment page
        stripe_pub_key = restaurant.get("stripe_publishable_key") or ""
        stripe_sec_key = restaurant.get("stripe_secret_key") or ""
        stripe_connected = bool(stripe_pub_key and stripe_sec_key)

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "payment_settings": payment_settings,
            "stripe_connected": stripe_connected,
            "stripe_publishable_key": stripe_pub_key if stripe_connected else "",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}/payment-settings", summary="Update Payment Settings")
async def update_payment_settings(restaurant_id: str, request: UpdatePaymentSettingsRequest):
    """
    อัปเดต Payment Settings ของร้าน

    Args:
        accept_card: รับชำระด้วยบัตร (Stripe)
        accept_bank_transfer: รับชำระด้วยโอนเงิน
        bank_accounts: รายการบัญชีธนาคาร
    """
    try:
        # Get current settings
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        current_settings = restaurant.get("payment_settings", {
            "accept_card": True,
            "accept_bank_transfer": False,
            "accept_qr_code": True,
            "accept_pay_at_cashier": True,
            "bank_accounts": []
        })
        # Ensure defaults for existing restaurants
        if "accept_qr_code" not in current_settings:
            current_settings["accept_qr_code"] = True
        if "accept_pay_at_cashier" not in current_settings:
            current_settings["accept_pay_at_cashier"] = True

        # Update only provided fields
        if request.accept_card is not None:
            current_settings["accept_card"] = request.accept_card
        if request.accept_bank_transfer is not None:
            current_settings["accept_bank_transfer"] = request.accept_bank_transfer
        if request.accept_qr_code is not None:
            current_settings["accept_qr_code"] = request.accept_qr_code
        if request.accept_pay_at_cashier is not None:
            current_settings["accept_pay_at_cashier"] = request.accept_pay_at_cashier
        if request.bank_accounts is not None:
            current_settings["bank_accounts"] = [acc.dict() for acc in request.bank_accounts]

        # Validate: At least one payment method must be enabled
        if not current_settings.get("accept_card") and not current_settings.get("accept_bank_transfer"):
            raise HTTPException(
                status_code=400,
                detail="At least one payment method must be enabled"
            )

        # Save to database using restaurant_service's supabase client
        if not restaurant_service.supabase_client:
            raise HTTPException(status_code=500, detail="Database connection not available")

        result = restaurant_service.supabase_client.table("restaurants").update({
            "payment_settings": current_settings
        }).eq("id", restaurant_id).execute()

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "payment_settings": current_settings,
            "message": "Payment settings updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Restaurant Stripe API Keys Routes
# ============================================================

@app.get("/api/restaurant/{restaurant_id}/stripe-keys", summary="Get Stripe API Keys")
async def get_stripe_keys(restaurant_id: str):
    """Get Stripe API keys status for a restaurant (secret key is masked)"""
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        pub_key = restaurant.get("stripe_publishable_key") or ""
        sec_key = restaurant.get("stripe_secret_key") or ""

        connected = bool(pub_key and sec_key)

        # Mask secret key — only show last 4 chars
        masked_secret = ""
        if sec_key:
            prefix = "sk_live_" if sec_key.startswith("sk_live_") else "sk_test_"
            masked_secret = f"{prefix}...{sec_key[-4:]}"

        return {
            "success": True,
            "connected": connected,
            "stripe_publishable_key": pub_key,
            "stripe_secret_key_masked": masked_secret,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}/stripe-keys", summary="Save & Test Stripe API Keys")
async def save_stripe_keys(restaurant_id: str, request: UpdateStripeKeysRequest):
    """Validate, test, and save Stripe API keys for a restaurant"""
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        pk = request.stripe_publishable_key.strip()
        sk = request.stripe_secret_key.strip()

        # Validate key format
        if not pk.startswith("pk_"):
            raise HTTPException(status_code=400, detail="Publishable key must start with 'pk_test_' or 'pk_live_'")
        if not sk.startswith("sk_"):
            raise HTTPException(status_code=400, detail="Secret key must start with 'sk_test_' or 'sk_live_'")

        # Test the secret key by retrieving account info
        import stripe as stripe_module
        try:
            account = stripe_module.Account.retrieve(api_key=sk)
            account_name = account.get("business_profile", {}).get("name") or account.get("settings", {}).get("dashboard", {}).get("display_name") or "Stripe Account"
        except stripe_module.error.AuthenticationError:
            raise HTTPException(status_code=400, detail="Invalid Secret Key. Please check your key and try again.")
        except Exception as stripe_err:
            raise HTTPException(status_code=400, detail=f"Could not connect to Stripe: {str(stripe_err)}")

        # Save to database
        result = restaurant_service.supabase_client.table("restaurants").update({
            "stripe_publishable_key": pk,
            "stripe_secret_key": sk,
        }).eq("id", restaurant_id).execute()

        return {
            "success": True,
            "message": "Stripe keys saved and verified successfully",
            "account_name": account_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/restaurant/{restaurant_id}/stripe-keys", summary="Disconnect Stripe")
async def delete_stripe_keys(restaurant_id: str):
    """Remove Stripe API keys from a restaurant"""
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        result = restaurant_service.supabase_client.table("restaurants").update({
            "stripe_publishable_key": None,
            "stripe_secret_key": None,
        }).eq("id", restaurant_id).execute()

        return {
            "success": True,
            "message": "Stripe disconnected successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Restaurant Surcharge Settings Routes
# ============================================================

@app.get("/api/restaurant/{restaurant_id}/surcharge-settings", summary="Get Surcharge Settings")
async def get_surcharge_settings(restaurant_id: str):
    """
    Get credit card surcharge settings for a restaurant
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "credit_card_surcharge_enabled": restaurant.get("credit_card_surcharge_enabled", False),
            "credit_card_surcharge_rate": float(restaurant.get("credit_card_surcharge_rate", 2.50) or 2.50)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}/surcharge-settings", summary="Update Surcharge Settings")
async def update_surcharge_settings(restaurant_id: str, request: UpdateSurchargeSettingsRequest):
    """
    Update credit card surcharge settings for a restaurant

    Args:
        credit_card_surcharge_enabled: Whether to pass credit card fees to customer
        credit_card_surcharge_rate: Surcharge rate as percentage (e.g., 2.5 for 2.5%)
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        update_data = {}

        if request.credit_card_surcharge_enabled is not None:
            update_data["credit_card_surcharge_enabled"] = request.credit_card_surcharge_enabled

        if request.credit_card_surcharge_rate is not None:
            # Validate rate is between 0 and 10%
            if request.credit_card_surcharge_rate < 0 or request.credit_card_surcharge_rate > 10:
                raise HTTPException(
                    status_code=400,
                    detail="Surcharge rate must be between 0 and 10%"
                )
            update_data["credit_card_surcharge_rate"] = request.credit_card_surcharge_rate

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        # Save to database
        if not restaurant_service.supabase_client:
            raise HTTPException(status_code=500, detail="Database connection not available")

        result = restaurant_service.supabase_client.table("restaurants").update(
            update_data
        ).eq("id", restaurant_id).execute()

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "credit_card_surcharge_enabled": update_data.get(
                "credit_card_surcharge_enabled",
                restaurant.get("credit_card_surcharge_enabled", False)
            ),
            "credit_card_surcharge_rate": update_data.get(
                "credit_card_surcharge_rate",
                float(restaurant.get("credit_card_surcharge_rate", 2.50) or 2.50)
            ),
            "message": "Surcharge settings updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Food/Holiday Surcharge Settings Routes
# ============================================================

class UpdateFoodSurchargeSettingsRequest(BaseModel):
    food_surcharge_enabled: bool = False
    food_surcharge_rate: float = 10.0
    food_surcharge_name: str = "Holiday Surcharge"

@app.get("/api/restaurant/{restaurant_id}/food-surcharge-settings", summary="Get Food Surcharge Settings")
async def get_food_surcharge_settings(restaurant_id: str):
    """
    Get food/holiday surcharge settings for a restaurant
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "food_surcharge_enabled": restaurant.get("food_surcharge_enabled", False),
            "food_surcharge_rate": float(restaurant.get("food_surcharge_rate", 10.0) or 10.0),
            "food_surcharge_name": restaurant.get("food_surcharge_name", "Holiday Surcharge") or "Holiday Surcharge"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}/food-surcharge-settings", summary="Update Food Surcharge Settings")
async def update_food_surcharge_settings(restaurant_id: str, request: UpdateFoodSurchargeSettingsRequest):
    """
    Update food/holiday surcharge settings for a restaurant

    Args:
        food_surcharge_enabled: Whether to add surcharge to food prices
        food_surcharge_rate: Surcharge rate as percentage (e.g., 10.0 for 10%)
        food_surcharge_name: Name to display on receipt (e.g., "Holiday Surcharge", "Festival Fee")
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Validate surcharge rate (0-50%)
        if request.food_surcharge_rate < 0 or request.food_surcharge_rate > 50:
            raise HTTPException(status_code=400, detail="Surcharge rate must be between 0% and 50%")

        # Prepare update data
        update_data = {
            "food_surcharge_enabled": request.food_surcharge_enabled,
            "food_surcharge_rate": request.food_surcharge_rate,
            "food_surcharge_name": request.food_surcharge_name or "Holiday Surcharge"
        }

        # Save to database
        if not restaurant_service.supabase_client:
            raise HTTPException(status_code=500, detail="Database connection not available")

        result = restaurant_service.supabase_client.table("restaurants").update(
            update_data
        ).eq("id", restaurant_id).execute()

        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "food_surcharge_enabled": request.food_surcharge_enabled,
            "food_surcharge_rate": request.food_surcharge_rate,
            "food_surcharge_name": request.food_surcharge_name,
            "message": "Food surcharge settings updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Customization Routes (Theme Color & Cover Image)
# ============================================================

@app.get("/api/customization/{restaurant_id}", summary="Get Restaurant Customization")
async def get_customization(restaurant_id: str):
    """
    ดึงข้อมูล Customization ของร้าน (Theme Color และ Cover Image)
    
    Args:
        restaurant_id: Restaurant ID
        
    Returns:
        Dictionary with customization data
    """
    try:
        # TODO: Query from database
        # For now, return default values
        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "theme_color": "#000000",
            "cover_image_url": None,
            "note": "Default values. Database integration needed."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/customization/theme-color", summary="Update Theme Color")
async def update_theme_color(request: UpdateThemeColorRequest):
    """
    อัปเดต Theme Color ของร้าน
    
    Plan Requirements:
    - Starter: ไม่สามารถปรับได้
    - Standard/Pro: ปรับได้
    - Premium: ปรับได้
    
    Args:
        restaurant_id: Restaurant ID
        theme_color: Hex color (e.g., '#FF5733' or 'FF5733')
        user_id: User ID สำหรับตรวจสอบ plan
        
    Returns:
        Dictionary with updated theme color
    """
    try:
        # Check user plan
        user_status = trial_limits_service.get_user_status(request.user_id)
        user_role = user_status.get('role', 'free_trial')

        # Free Trial and Starter cannot customize theme color
        if user_role in ['free_trial', 'starter']:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Plan restriction",
                    "message": "Theme color customization is not available in your plan. Please upgrade to Professional or Enterprise plan.",
                    "current_plan": user_role
                }
            )
        
        # Validate theme color
        if not customization_service.validate_theme_color(request.theme_color):
            raise HTTPException(
                status_code=400,
                detail="Invalid theme color format. Please use hex color (e.g., '#FF5733' or 'FF5733')"
            )
        
        # Normalize theme color
        normalized_color = customization_service.normalize_theme_color(request.theme_color)
        
        # Update theme_color in Supabase
        restaurant = restaurant_service.get_restaurant_by_id(request.restaurant_id)
        if not restaurant:
            # Try to get by user_id
            restaurant = restaurant_service.get_restaurant_by_user_id(request.user_id)
        
        if restaurant:
            updated = restaurant_service.update_restaurant(
                restaurant.get('id'),
                request.user_id,
                {'theme_color': normalized_color}
            )
            if not updated:
                print(f"⚠️ Failed to update theme_color in database")
        else:
            print(f"⚠️ Restaurant not found")
        
        print(f"🎨 Theme color updated:")
        print(f"   Restaurant ID: {request.restaurant_id}")
        print(f"   Theme Color: {normalized_color}")
        print(f"   Plan: {plan}")
        
        return {
            "success": True,
            "restaurant_id": request.restaurant_id,
            "theme_color": normalized_color,
            "plan": plan,
            "message": f"Theme color updated to {normalized_color}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Theme color update error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/customization/logo", summary="Upload Logo")
async def upload_logo(
    restaurant_id: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Form("default")
):
    """
    อัปโหลด Logo สำหรับร้าน
    
    Args:
        restaurant_id: Restaurant ID
        file: ไฟล์รูปภาพ (JPEG, PNG, WebP)
        user_id: User ID
        
    Returns:
        Dictionary with logo URL
    """
    try:
        # Validate file using comprehensive validation (4MB max for logo)
        image_bytes, detected_type = await validate_image_upload(
            file,
            max_size_mb=4,  # 4MB max for logo
            allowed_types=['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )

        # Convert to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        image_data_url = f"data:{detected_type};base64,{image_base64}"

        print(f"📸 Logo Upload Request:")
        print(f"   Restaurant ID: {restaurant_id}")
        print(f"   File: {file.filename}")
        print(f"   Size: {len(image_bytes)} bytes ({len(image_bytes) / 1024 / 1024:.2f} MB)")
        print(f"   Content type: {detected_type}")
        
        # Upload to Supabase Storage
        logo_url = await customization_service.upload_logo(image_data_url, restaurant_id, file.content_type)
        
        if not logo_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to upload logo to Supabase Storage"
            )
        
        # Update logo_url in Supabase
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            # Try to get by user_id
            restaurant = restaurant_service.get_restaurant_by_user_id(user_id)
        
        if restaurant:
            updated = restaurant_service.update_restaurant_logo(
                restaurant.get('id'),
                user_id,
                logo_url
            )
            if not updated:
                print(f"⚠️ Failed to update logo_url in database, but image uploaded successfully")
        else:
            print(f"⚠️ Restaurant not found, but image uploaded successfully")
        
        print(f"✅ Logo uploaded successfully: {logo_url}")
        
        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "logo_url": logo_url,
            "message": "Logo uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Logo upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/customization/cover-image", summary="Upload Cover Image")
async def upload_cover_image(
    restaurant_id: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Form("default")
):
    """
    อัปโหลด Cover Image (Banner) สำหรับร้าน

    Plan Requirements:
    - Enterprise plan หรือ Admin role เท่านั้นที่อัปโหลดได้

    Args:
        restaurant_id: Restaurant ID
        file: ไฟล์รูปภาพ (JPEG, PNG, WebP)
        user_id: User ID สำหรับตรวจสอบ plan

    Returns:
        Dictionary with cover image URL
    """
    try:
        # Check user plan and role
        user_status = trial_limits_service.get_user_status(user_id)
        plan = user_status.get('subscription_plan', 'starter') if user_status.get('is_subscribed') else 'starter'
        role = user_status.get('role', 'free_trial')

        # Only Enterprise or Admin can upload cover image (check both plan and role)
        if plan not in ['enterprise'] and role not in ['enterprise', 'admin']:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Plan restriction",
                    "message": "Cover image upload is only available in Enterprise plan. Please upgrade to Enterprise plan.",
                    "current_plan": plan,
                    "current_role": role
                }
            )

        # Validate file using comprehensive validation (4MB max for cover)
        image_bytes, detected_type = await validate_image_upload(
            file,
            max_size_mb=4,  # 4MB max for cover image
            allowed_types=['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )

        # Convert to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        image_data_url = f"data:{detected_type};base64,{image_base64}"

        print(f"📸 Cover Image Upload Request:")
        print(f"   Restaurant ID: {restaurant_id}")
        print(f"   File: {file.filename}")
        print(f"   Size: {len(image_bytes)} bytes ({len(image_bytes) / 1024 / 1024:.2f} MB)")
        print(f"   Content type: {detected_type}")
        print(f"   Plan: {plan}")
        
        # Upload to Supabase Storage
        cover_image_url = await customization_service.upload_cover_image(image_data_url, restaurant_id, file.content_type)
        
        if not cover_image_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to upload cover image to Supabase Storage"
            )
        
        # Update cover_image_url in Supabase
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            # Try to get by user_id
            restaurant = restaurant_service.get_restaurant_by_user_id(user_id)
        
        if restaurant:
            updated = restaurant_service.update_restaurant_banner(
                restaurant.get('id'),
                user_id,
                cover_image_url
            )
            if not updated:
                print(f"⚠️ Failed to update cover_image_url in database, but image uploaded successfully")
        else:
            print(f"⚠️ Restaurant not found, but image uploaded successfully")
        
        print(f"✅ Cover image uploaded successfully: {cover_image_url}")
        
        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "cover_image_url": cover_image_url,
            "plan": plan,
            "message": "Cover image uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Cover image upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/customization/cover-image/{restaurant_id}", summary="Delete Cover Image")
async def delete_cover_image(
    restaurant_id: str,
    user_id: str = Form("default")
):
    """
    ลบ Cover Image ของร้าน

    Plan Requirements:
    - Enterprise plan หรือ Admin role เท่านั้นที่ลบได้

    Args:
        restaurant_id: Restaurant ID
        user_id: User ID สำหรับตรวจสอบ plan

    Returns:
        Dictionary with deletion status
    """
    try:
        # Check user plan and role
        user_status = trial_limits_service.get_user_status(user_id)
        plan = user_status.get('subscription_plan', 'starter') if user_status.get('is_subscribed') else 'starter'
        role = user_status.get('role', 'free_trial')

        # Only Enterprise or Admin can delete cover image (check both plan and role)
        if plan not in ['enterprise'] and role not in ['enterprise', 'admin']:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Plan restriction",
                    "message": "Cover image deletion is only available in Enterprise plan.",
                    "current_plan": plan,
                    "current_role": role
                }
            )
        
        # TODO: Get cover_image_url from database
        # SELECT cover_image_url FROM restaurants WHERE id = restaurant_id
        
        # For now, return success (actual deletion will happen when database is integrated)
        return {
            "success": True,
            "restaurant_id": restaurant_id,
            "message": "Cover image deletion requested (database integration needed)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# User Profile & Billing Routes
# ============================================================

@app.get("/api/user/profile", summary="Get User Profile")
async def get_user_profile(
    user_id: str,
    restaurant_id: Optional[str] = None
):
    """
    ดึงข้อมูล Profile ของ User และร้านอาหาร
    
    รวมข้อมูล:
    - ข้อมูลร้าน (ชื่อ, โลโก้, สีธีม, รูปปก)
    - Subscription จาก Stripe (Plan, สถานะ, วันหมดอายุ)
    
    Args:
        user_id: User ID
        restaurant_id: Restaurant ID (optional, ถ้าไม่ระบุจะดึงร้านแรกของ user)
        
    Returns:
        Dictionary with user profile and subscription data
    """
    try:
        # Validate user_id is a valid UUID
        import re
        is_valid_uuid = re.match(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            user_id,
            re.IGNORECASE
        )
        
        # Get restaurant data from Supabase
        restaurant = None
        if is_valid_uuid:
            if restaurant_id:
                # SECURITY: Validate that the restaurant belongs to this user
                # Handle NULL user_id (from early migrations) - allow access if user_id is NULL or matches
                candidate_restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
                if candidate_restaurant:
                    restaurant_user_id = candidate_restaurant.get('user_id')
                    # Allow access if: user_id is NULL OR user_id matches
                    if restaurant_user_id is None or restaurant_user_id == user_id:
                        restaurant = candidate_restaurant
                    else:
                        # Restaurant belongs to different user - ignore the restaurant_id
                        print(f"⚠️ Restaurant {restaurant_id} does not belong to user {user_id}, ignoring")
                        restaurant = None
                else:
                    restaurant = None

            if not restaurant:
                # Get active restaurant first, or fallback to first restaurant
                all_restaurants = restaurant_service.get_all_restaurants_by_user_id(user_id)
                if all_restaurants:
                    # Find active restaurant
                    active = next((r for r in all_restaurants if r.get('is_active')), None)
                    restaurant = active or all_restaurants[0]
                else:
                    restaurant = None
            
            # If restaurant doesn't exist, create a default one
            if not restaurant:
                print(f"⚠️ No restaurant found for user {user_id}, creating default...")
                default_restaurant_data = {
                    "name": "My Restaurant",
                    "phone": "",
                    "email": "",
                    "address": ""
                }
                # Only add theme_color if column exists (will be handled in service)
                restaurant = restaurant_service.create_restaurant(user_id, default_restaurant_data)
        else:
            print(f"⚠️ Invalid UUID format for user_id: {user_id}, skipping restaurant lookup")
        
        # Prepare restaurant data response
        if restaurant:
            # Get service options (default all enabled)
            service_options = restaurant.get("service_options") or {
                "dine_in": True,
                "pickup": True,
                "delivery": True
            }

            restaurant_data = {
                "restaurant_id": restaurant.get("id"),
                "id": restaurant.get("id"),  # Add id for compatibility
                "slug": restaurant.get("slug"),  # ⭐ ADD SLUG HERE
                "name": restaurant.get("name", ""),
                "phone": restaurant.get("phone", ""),
                "email": restaurant.get("email", ""),
                "address": restaurant.get("address", ""),
                "logo_url": restaurant.get("logo_url"),
                "theme_color": restaurant.get("theme_color", "#000000"),
                "cover_image_url": restaurant.get("cover_image_url"),
                "menu_template": restaurant.get("menu_template", "grid"),
                "service_options": service_options,
                "primary_language": restaurant.get("primary_language", "th"),
                "pos_theme_color": restaurant.get("pos_theme_color", "orange"),
                "delivery_rates": restaurant.get("delivery_rates") or [],
                # Tax/Business info for NZ
                "gst_registered": restaurant.get("gst_registered", True),
                "gst_number": restaurant.get("gst_number", ""),
                "ird_number": restaurant.get("ird_number", ""),
                # Operating hours
                "operating_hours": restaurant.get("operating_hours"),
            }
        else:
            # Fallback if creation failed
            restaurant_data = {
                "restaurant_id": None,
                "id": None,
                "slug": None,  # ⭐ ADD SLUG HERE
                "name": "",
                "phone": "",
                "email": "",
                "address": "",
                "logo_url": None,
                "theme_color": "#000000",
                "cover_image_url": None,
                "menu_template": "grid",
                "service_options": {"dine_in": True, "pickup": True, "delivery": True},
                "delivery_rates": [],
                # Tax/Business info for NZ
                "gst_registered": True,
                "gst_number": "",
                "ird_number": "",
            }
        
        # ⚡ OPTIMIZED: Get user profile first (includes role) - single DB call instead of multiple
        user_profile = user_role_service.get_user_profile(user_id)

        # Extract role from profile (avoids duplicate DB call)
        user_role = user_profile.get('role', 'free_trial') if user_profile else 'free_trial'

        # Map role to subscription plan
        role_to_plan = {
            'free_trial': 'trial',
            'starter': 'starter',
            'professional': 'pro',
            'enterprise': 'premium',
            'admin': 'premium'  # Admin gets premium features
        }

        plan_from_role = role_to_plan.get(user_role, 'trial')

        # ⚡ OPTIMIZED: Pass role to avoid another duplicate DB call inside get_user_status
        user_status = trial_limits_service.get_user_status(user_id, user_role=user_role)

        # Determine if subscribed based on role (not trial)
        is_subscribed = user_role not in ['free_trial', None]

        # Extract subscription data from user_profiles table
        subscription_start_date = user_profile.get('subscription_start_date') if user_profile else None
        subscription_end_date = user_profile.get('subscription_end_date') if user_profile else None
        next_billing_date = user_profile.get('next_billing_date') if user_profile else None
        cancel_at_period_end = user_profile.get('cancel_at_period_end', False) if user_profile else False
        billing_provider = user_profile.get('billing_provider') if user_profile else None

        subscription_data = {
            "plan": plan_from_role,
            "role": user_role,
            "status": "active" if is_subscribed else ("trial" if user_role == 'free_trial' else "expired"),
            "is_subscribed": is_subscribed,
            "trial_days_remaining": user_status.get('trial_days_remaining', 0) if user_role == 'free_trial' else 0,
            "current_period_start": subscription_start_date,
            "current_period_end": subscription_end_date,
            "next_billing_date": next_billing_date,
            "cancel_at_period_end": cancel_at_period_end,
            "billing_provider": billing_provider,
        }
        
        return {
            "success": True,
            "user_id": user_id,
            "restaurant": restaurant_data,
            "subscription": subscription_data
        }
        
    except Exception as e:
        print(f"❌ Get user profile error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/user/profile", summary="Update User Profile")
async def update_user_profile(request: UpdateProfileRequest):
    """
    อัปเดตข้อมูล Profile ของร้าน
    
    Plan Restrictions:
    - Starter: ไม่สามารถแก้ Theme Color ได้
    - Pro/Premium: แก้ได้ทั้งหมด
    
    Args:
        restaurant_id: Restaurant ID
        name: ชื่อร้าน (optional)
        phone: เบอร์โทร (optional)
        email: อีเมล (optional)
        address: ที่อยู่ (optional)
        theme_color: สีธีม (optional, ต้องเช็ค plan)
        user_id: User ID สำหรับตรวจสอบ plan
        
    Returns:
        Dictionary with updated profile data
    """
    try:
        # Check user plan
        user_status = trial_limits_service.get_user_status(request.user_id)
        plan = user_status.get('subscription_plan', 'starter') if user_status.get('is_subscribed') else 'starter'
        
        # Check theme color permission - silently ignore for restricted plans instead of blocking entire save
        if request.theme_color and plan in ('free_trial', 'starter'):
            request.theme_color = None  # Skip theme_color update, allow other fields to save
        
        # Validate theme color if provided
        if request.theme_color:
            if not customization_service.validate_theme_color(request.theme_color):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid theme color format. Please use hex color (e.g., '#FF5733' or 'FF5733')"
                )
            request.theme_color = customization_service.normalize_theme_color(request.theme_color)
        
        # Prepare update data (only include fields that are provided)
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.phone is not None:
            update_data['phone'] = request.phone
        if request.email is not None:
            update_data['email'] = request.email
        if request.address is not None:
            update_data['address'] = request.address
        if request.theme_color is not None:
            update_data['theme_color'] = request.theme_color
        if request.menu_template is not None:
            # Validate menu_template
            valid_templates = ['list', 'grid', 'magazine', 'elegant', 'casual']
            if request.menu_template in valid_templates:
                update_data['menu_template'] = request.menu_template
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid menu template. Must be one of: {', '.join(valid_templates)}"
                )

        # Tax/Business info for NZ
        if request.gst_registered is not None:
            update_data['gst_registered'] = request.gst_registered
        if request.gst_number is not None:
            update_data['gst_number'] = request.gst_number
        if request.ird_number is not None:
            update_data['ird_number'] = request.ird_number

        # Operating hours
        if request.operating_hours is not None:
            update_data['operating_hours'] = request.operating_hours
            print(f"📅 Operating hours to save: {request.operating_hours}")

        # Update in database using restaurant_service
        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="No fields to update. Please provide at least one field to update."
            )
        
        updated_restaurant = restaurant_service.update_restaurant(
            request.restaurant_id,
            request.user_id,
            update_data
        )
        
        if not updated_restaurant:
            raise HTTPException(
                status_code=500,
                detail="Failed to update restaurant profile in database. Please check restaurant_id and try again."
            )
        
        print(f"📝 Profile updated successfully:")
        print(f"   Restaurant ID: {request.restaurant_id}")
        print(f"   Plan: {plan}")
        print(f"   Updated fields: {update_data}")
        
        return {
            "success": True,
            "restaurant_id": request.restaurant_id,
            "plan": plan,
            "updated_fields": update_data,
            "message": "Profile updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update profile error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Service Options API
# ============================================================

class DeliveryRateItem(BaseModel):
    id: str
    distance_km: float
    price: float

class DeliverySettingsItem(BaseModel):
    pricing_mode: str = 'per_km'  # 'tier' or 'per_km'
    price_per_km: float = 1.50
    base_fee: float = 3.00
    max_distance_km: float = 15
    free_delivery_above: float = 0  # 0 = no free delivery

class UpdateServiceOptionsRequest(BaseModel):
    restaurant_id: str
    user_id: str
    service_options: Dict[str, bool]  # {"dine_in": true, "pickup": false, "delivery": true}
    primary_language: Optional[str] = None  # 'th', 'en', 'zh', 'ja', 'ko', etc.
    pos_theme_color: Optional[str] = None  # 'orange', 'blue', 'green', 'purple', 'red', 'teal', 'amber', 'pink'
    delivery_rates: Optional[List[DeliveryRateItem]] = None  # [{"id": "uuid", "distance_km": 5, "price": 3.50}]
    delivery_settings: Optional[DeliverySettingsItem] = None  # Per-km pricing settings

@app.put("/api/restaurant/service-options", summary="Update Service Options")
async def update_service_options(request: UpdateServiceOptionsRequest):
    """
    อัปเดตตัวเลือกบริการ (Dine-in, Pickup, Delivery) และภาษาหลัก

    Args:
        restaurant_id: Restaurant ID
        user_id: User ID
        service_options: Object with service toggles
        primary_language: Primary language code (optional)

    Returns:
        Dictionary with updated service options
    """
    try:
        # Validate service_options
        valid_keys = {'dine_in', 'pickup', 'delivery'}
        for key in request.service_options:
            if key not in valid_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid service option key: {key}. Valid keys: {valid_keys}"
                )

        # Validate primary_language if provided
        valid_languages = ['th', 'en', 'zh', 'ja', 'ko', 'vi', 'hi', 'es', 'fr', 'de', 'id', 'ms']
        if request.primary_language and request.primary_language not in valid_languages:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid primary_language: {request.primary_language}. Valid: {valid_languages}"
            )

        # Validate pos_theme_color if provided
        valid_themes = ['orange', 'blue', 'green', 'purple', 'red', 'teal', 'amber', 'pink']
        if request.pos_theme_color and request.pos_theme_color not in valid_themes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid pos_theme_color: {request.pos_theme_color}. Valid: {valid_themes}"
            )

        # Update in database
        update_data = {"service_options": request.service_options}
        if request.primary_language:
            update_data["primary_language"] = request.primary_language
        if request.pos_theme_color:
            update_data["pos_theme_color"] = request.pos_theme_color
        if request.delivery_rates is not None:
            # Convert to list of dicts for JSON storage
            update_data["delivery_rates"] = [rate.model_dump() for rate in request.delivery_rates]
        if request.delivery_settings is not None:
            # Save delivery settings (per-km pricing)
            update_data["delivery_settings"] = request.delivery_settings.model_dump()

        updated_restaurant = restaurant_service.update_restaurant(
            request.restaurant_id,
            request.user_id,
            update_data
        )

        if not updated_restaurant:
            raise HTTPException(
                status_code=500,
                detail="Failed to update service options"
            )

        delivery_rates_count = len(request.delivery_rates) if request.delivery_rates else 0
        print(f"✅ Service options updated for restaurant {request.restaurant_id}: {request.service_options}, language: {request.primary_language}, pos_theme: {request.pos_theme_color}, delivery_rates: {delivery_rates_count} tiers")

        return {
            "success": True,
            "restaurant_id": request.restaurant_id,
            "service_options": request.service_options,
            "primary_language": request.primary_language,
            "pos_theme_color": request.pos_theme_color,
            "delivery_rates": [rate.model_dump() for rate in request.delivery_rates] if request.delivery_rates else [],
            "delivery_settings": request.delivery_settings.model_dump() if request.delivery_settings else None,
            "message": "Service options updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update service options error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Run Server
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("🚀 Smart Menu AI API Starting...")
    print("=" * 60)
    print("✅ Translation: Enabled")
    print("✅ Image Analysis: Enabled")
    print("⚠️  Image Generation: Prompt creation only (Imagen API required)")
    print("=" * 60)
    print(f"📍 Docs: http://localhost:8000/docs")
    print(f"🔧 API: http://localhost:8000/api")
    print(f"💰 Pricing: http://localhost:8000/api/pricing")
    print("=" * 60)
    
# ============================================================
# User Role Management API
# ============================================================

class GetUserRoleRequest(BaseModel):
    user_id: str

class SetUserRoleRequest(BaseModel):
    user_id: str  # User to change
    role: str  # New role
    admin_user_id: str  # Admin making the change

class GetAllUsersRequest(BaseModel):
    admin_user_id: str

@app.get("/api/user/role")
async def get_user_role(user_id: str):
    """
    ดึง role ของ user
    
    Returns:
        Role string
    """
    try:
        role = user_role_service.get_user_role(user_id)
        return {
            "success": True,
            "user_id": user_id,
            "role": role
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/role")
async def set_user_role(request: SetUserRoleRequest):
    """
    ตั้งค่า role ของ user (admin only)
    
    Roles: free_trial, starter, professional, enterprise, admin
    """
    try:
        result = user_role_service.set_user_role(
            request.user_id,
            request.role,
            request.admin_user_id
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=403 if "admin" in result.get("error", "").lower() else 400,
                detail=result.get("error", "Failed to set user role")
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/users")
async def get_all_users(request: GetAllUsersRequest):
    """
    ดึงรายชื่อ users ทั้งหมด (admin only)
    """
    try:
        users = user_role_service.get_all_users(request.admin_user_id)
        return {
            "success": True,
            "users": users
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/role/limits")
async def get_role_limits(role: str):
    """
    ดึง limits ตาม role
    """
    try:
        limits = user_role_service.get_role_limits(role)
        return {
            "success": True,
            "role": role,
            "limits": limits
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/setup-roles")
async def setup_user_roles_table(admin_user_id: str):
    """
    สร้างตาราง user_profiles ใน Supabase (admin only)
    ใช้สำหรับ setup ครั้งแรก
    """
    try:
        # Check if user is admin
        if not user_role_service.is_admin(admin_user_id):
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if not user_role_service.supabase_client:
            raise HTTPException(status_code=500, detail="Supabase client not available")
        
        # Try to create table using Supabase client
        # Note: Supabase Python client doesn't support DDL operations directly
        # This endpoint will verify table exists and create initial data if needed
        
        # Check if table exists by trying to query it
        try:
            result = user_role_service.supabase_client.table('user_profiles').select('*').limit(1).execute()
            return {
                "success": True,
                "message": "Table 'user_profiles' already exists",
                "table_exists": True
            }
        except Exception as e:
            # Table doesn't exist - need to create via SQL Editor
            return {
                "success": False,
                "message": "Table 'user_profiles' does not exist. Please run migration SQL in Supabase Dashboard.",
                "table_exists": False,
                "instructions": [
                    "1. Go to Supabase Dashboard > SQL Editor",
                    "2. Copy contents from: backend/migrations/add_user_roles.sql",
                    "3. Paste and run the SQL",
                    "4. Verify table exists in Table Editor"
                ]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/check-table")
async def check_user_profiles_table(user_id: str):
    """
    ตรวจสอบว่าตาราง user_profiles มีอยู่หรือไม่
    """
    try:
        if not user_role_service.supabase_client:
            return {
                "success": False,
                "table_exists": False,
                "message": "Supabase client not available"
            }
        
        try:
            # Try to query the table
            result = user_role_service.supabase_client.table('user_profiles').select('*').limit(1).execute()
            return {
                "success": True,
                "table_exists": True,
                "message": "Table 'user_profiles' exists and is accessible"
            }
        except Exception as e:
            return {
                "success": False,
                "table_exists": False,
                "message": f"Table 'user_profiles' does not exist: {str(e)}",
                "action_required": "Run migration SQL in Supabase Dashboard > SQL Editor"
            }
    except Exception as e:
        return {
            "success": False,
            "table_exists": False,
            "message": str(e)
        }

# ============================================================
# Public Menu API (for customer-facing menu page)
# ============================================================

@app.get("/api/public/menu/{restaurant_id}", summary="Get Public Menu with Branding")
async def get_public_menu(restaurant_id: str, response: Response):
    """
    ดึงเมนูสาธารณะพร้อมข้อมูล branding, location, surcharges, bestsellers
    (Consolidated endpoint - ลดจาก 5 API calls เหลือ 1 call)

    Args:
        restaurant_id: Restaurant ID หรือ slug (ไม่รองรับ "default")

    Returns:
        Dictionary with menu items, restaurant branding, location, surcharges, bestsellers
    """
    try:
        # Handle "default" case - return helpful error
        if restaurant_id == "default":
            raise HTTPException(
                status_code=400,
                detail="Invalid restaurant_id: 'default' is not allowed for public menu. Please use a valid restaurant ID or slug."
            )

        # Get restaurant info (supports both UUID and slug)
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)

        if not restaurant:
            raise HTTPException(
                status_code=404,
                detail=f"Restaurant not found: '{restaurant_id}'. Please check the restaurant ID or slug."
            )

        rid = restaurant.get("id")

        # Get menu items
        try:
            menu_items = menu_service.get_menu_items(rid)
        except Exception as e:
            print(f"❌ Get public menu items error: {str(e)}")
            menu_items = []

        # Get bestsellers (non-blocking - gracefully handle failure)
        best_sellers_data = []
        try:
            best_sellers_data = best_sellers_service.get_best_sellers(rid, days=7, limit=5)
        except Exception as e:
            print(f"⚠️ Get bestsellers error (non-fatal): {str(e)}")

        # Get restaurant owner's plan for branding restrictions
        owner_user_id = restaurant.get("user_id")
        owner_plan = "free_trial"  # Default
        if owner_user_id:
            owner_role = user_role_service.get_user_role(owner_user_id)
            owner_plan = owner_role or "free_trial"

        # Determine if "Powered by Smart Menu" should be hidden (Enterprise only)
        is_enterprise = owner_plan in ["enterprise", "admin"]

        # Get restaurant branding
        branding = {
            "logo_url": restaurant.get("logo_url"),
            "theme_color": restaurant.get("theme_color", "#000000"),
            "cover_image_url": restaurant.get("cover_image_url"),
            "name": restaurant.get("name"),
            "menu_template": restaurant.get("menu_template", "grid"),
            "hide_powered_by": is_enterprise,
            "primary_language": restaurant.get("primary_language", "en"),
            "category_order": restaurant.get("category_order") or [],
            "operating_hours": restaurant.get("operating_hours"),
        }

        # Get service options (default all enabled)
        service_options = restaurant.get("service_options") or {
            "dine_in": True,
            "pickup": True,
            "delivery": True
        }

        # Get delivery rates
        delivery_rates = restaurant.get("delivery_rates") or []

        # Location data (previously separate API call)
        location = {
            "latitude": restaurant.get("latitude"),
            "longitude": restaurant.get("longitude"),
            "address": restaurant.get("address"),
        }

        # Surcharge settings (previously separate API call)
        surcharge_settings = {
            "credit_card_surcharge_enabled": restaurant.get("credit_card_surcharge_enabled", False),
            "credit_card_surcharge_rate": float(restaurant.get("credit_card_surcharge_rate", 2.50) or 2.50),
        }

        # Food surcharge settings (previously separate API call)
        food_surcharge_settings = {
            "food_surcharge_enabled": restaurant.get("food_surcharge_enabled", False),
            "food_surcharge_rate": float(restaurant.get("food_surcharge_rate", 10.0) or 10.0),
            "food_surcharge_name": restaurant.get("food_surcharge_name", "Holiday Surcharge") or "Holiday Surcharge",
        }

        # Cache-Control: allow Vercel edge + browser to cache for 60s, serve stale for 5min while revalidating
        response.headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300"

        return {
            "success": True,
            "restaurant": {
                "id": rid,
                "name": restaurant.get("name"),
                "slug": restaurant.get("slug"),
                "description": restaurant.get("description"),
                "address": restaurant.get("address"),
                "phone": restaurant.get("phone"),
                "email": restaurant.get("email"),
            },
            "branding": branding,
            "service_options": service_options,
            "delivery_rates": delivery_rates,
            "plan": owner_plan,
            "menu_items": menu_items,
            "count": len(menu_items),
            # Consolidated data (eliminates 4 extra API calls from frontend)
            "location": location,
            "surcharge_settings": surcharge_settings,
            "food_surcharge_settings": food_surcharge_settings,
            "best_sellers": best_sellers_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get public menu error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Orders API
# ============================================================

class CreateOrderRequest(BaseModel):
    restaurant_id: str
    items: List[Dict[str, Any]]
    table_no: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    special_instructions: Optional[str] = None
    tax: Optional[float] = 0
    delivery_fee: Optional[float] = 0  # Delivery fee for delivery orders
    subtotal: Optional[float] = 0  # Subtotal before fees
    service_type: Optional[str] = "dine_in"  # 'dine_in', 'pickup', 'delivery'
    customer_details: Optional[Dict[str, Any]] = None
    surcharge_amount: Optional[float] = None  # Credit card surcharge (calculated in payment page)
    food_surcharge_amount: Optional[float] = None  # Food/holiday surcharge
    food_surcharge_name: Optional[str] = None  # Display name for food surcharge
    payment_method: Optional[str] = "card"  # Payment method: card, bank_transfer, cash_at_counter

@app.post("/api/orders", summary="Create New Order")
async def create_order(request: CreateOrderRequest):
    """
    สร้างออเดอร์ใหม่จากลูกค้า
    
    Args:
        restaurant_id: Restaurant ID หรือ slug
        items: List of menu items with quantities and options
        table_no: Table number (optional)
        customer_name: Customer name (optional)
        customer_phone: Customer phone (optional)
        special_instructions: Special instructions (optional)
        tax: Tax amount (optional, default: 0)
        
    Returns:
        Dictionary with created order
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(request.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {request.restaurant_id}")
        
        actual_restaurant_id = restaurant.get("id")
        
        order_data = {
            "items": request.items,
            "table_no": request.table_no,
            "customer_name": request.customer_name,
            "customer_phone": request.customer_phone,
            "special_instructions": request.special_instructions,
            "tax": request.tax or 0,
            "delivery_fee": request.delivery_fee or 0,
            "subtotal": request.subtotal or 0,
            "service_type": request.service_type or "dine_in",
            "customer_details": request.customer_details or {},
            "surcharge_amount": request.surcharge_amount,
            "food_surcharge_amount": request.food_surcharge_amount,
            "food_surcharge_name": request.food_surcharge_name,
            "payment_method": request.payment_method or "card",
        }
        
        order = orders_service.create_order(actual_restaurant_id, order_data)
        
        if not order:
            raise HTTPException(status_code=500, detail="Failed to create order")
        
        # Send order confirmation email if customer email is provided
        customer_email = request.customer_details.get('email') if request.customer_details else None
        if customer_email:
            try:
                # Use already fetched restaurant data
                restaurant_name = restaurant.get('name', 'Restaurant') if restaurant else 'Restaurant'
                
                email_service.send_order_confirmation(
                    to_email=customer_email,
                    order=order,
                    restaurant_name=restaurant_name
                )
                print(f"✅ Order confirmation email sent to {customer_email}")
            except Exception as e:
                # Don't fail order creation if email fails
                print(f"⚠️ Failed to send order confirmation email: {str(e)}")
        
        return {
            "success": True,
            "message": "Order created successfully",
            "order": order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create order error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/orders", summary="Get Orders")
async def get_orders(restaurant_id: str, status: Optional[str] = None):
    """
    ดึงออเดอร์ทั้งหมดของร้าน
    
    Args:
        restaurant_id: Restaurant ID
        status: Filter by status (optional: pending, preparing, ready, completed, cancelled)
        
    Returns:
        List of orders
    """
    try:
        orders = orders_service.get_orders(restaurant_id, status)
        
        return {
            "success": True,
            "count": len(orders),
            "orders": orders
        }
    except Exception as e:
        print(f"❌ Get orders error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/orders/summary", summary="Get Orders Summary with Filters")
async def get_orders_summary(
    restaurant_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    payment_status: Optional[str] = None,
    service_type: Optional[str] = None
):
    """
    ดึงสรุป Orders พร้อม Filter สำหรับหน้า Dashboard

    Args:
        restaurant_id: Restaurant ID
        start_date: Start date (YYYY-MM-DD format)
        end_date: End date (YYYY-MM-DD format)
        payment_status: Filter by payment status (pending, paid, failed)
        service_type: Filter by service type (dine_in, pickup, delivery)

    Returns:
        Dictionary with orders list and summary statistics
    """
    try:
        result = orders_service.get_orders_summary(
            restaurant_id=restaurant_id,
            start_date=start_date,
            end_date=end_date,
            payment_status=payment_status,
            service_type=service_type
        )

        return {
            "success": True,
            "orders": result["orders"],
            "summary": result["summary"],
            "filters": {
                "start_date": start_date,
                "end_date": end_date,
                "payment_status": payment_status,
                "service_type": service_type
            }
        }
    except Exception as e:
        print(f"❌ Get orders summary error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class UpdateOrderStatusRequest(BaseModel):
    status: str
    cancel_reason: Optional[str] = None  # Reason for cancellation (e.g., 'payment_rejected')

@app.put("/api/orders/{order_id}/status", summary="Update Order Status")
async def update_order_status(order_id: str, request: UpdateOrderStatusRequest):
    """
    อัปเดตสถานะออเดอร์

    Args:
        order_id: Order ID
        status: New status (pending, preparing, ready, completed, cancelled)
        cancel_reason: Optional reason for cancellation

    Returns:
        Dictionary with updated order
    """
    try:
        order = orders_service.update_order_status(order_id, request.status, request.cancel_reason)
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {
            "success": True,
            "message": f"Order status updated to {request.status}",
            "order": order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update order status error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class UpdateEstimatedTimeRequest(BaseModel):
    estimated_minutes: int  # Estimated cooking time in minutes

@app.put("/api/orders/{order_id}/estimated-time", summary="Update Order Estimated Time")
async def update_order_estimated_time(order_id: str, request: UpdateEstimatedTimeRequest):
    """
    อัปเดทเวลาประมาณในการทำอาหาร (โดยครัว)

    Args:
        order_id: Order ID
        estimated_minutes: Estimated cooking time in minutes

    Returns:
        Dictionary with updated order
    """
    try:
        if request.estimated_minutes < 1 or request.estimated_minutes > 180:
            raise HTTPException(status_code=400, detail="Estimated time must be between 1 and 180 minutes")

        update_data = {
            "estimated_minutes": request.estimated_minutes,
            "cooking_started_at": datetime.now().isoformat()
        }

        updated_order = orders_service.update_order(order_id, update_data)

        if not updated_order:
            raise HTTPException(status_code=404, detail="Order not found")

        return {
            "success": True,
            "message": f"Estimated time updated to {request.estimated_minutes} minutes",
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update estimated time error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Pay at Cashier API (for Dine-in and Pickup orders)
# ============================================================

class PayAtCashierRequest(BaseModel):
    payment_method: str = "cash_at_cashier"

@app.post("/api/orders/{order_id}/pay-at-cashier", summary="Request Pay at Cashier")
async def pay_at_cashier(order_id: str, request: PayAtCashierRequest):
    """
    ขอจ่ายเงินที่แคชเชียร์สำหรับ Dine-in และ Pickup orders

    Order จะเข้าไปใน POS เลย (status: pending) แล้วเข้าครัวตามปกติ
    หลังจากอาหารเสร็จ พนักงานจะเลือกว่าลูกค้าจ่าย Cash หรือ EFTPOS

    Args:
        order_id: Order ID
        payment_method: Payment method (default: cash_at_cashier)

    Returns:
        Dictionary with updated order
    """
    try:
        # Get order
        order = orders_service.get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Verify it's a dine-in or pickup order
        if order.get("service_type") not in ("dine_in", "pickup"):
            raise HTTPException(status_code=400, detail="Pay at cashier is only available for dine-in and pickup orders")

        # Update order - goes directly to POS as pending (same as paid orders)
        # Food will be prepared first, payment collected after serving
        update_data = {
            "payment_method": request.payment_method,
            "payment_status": "pending",
            "status": "pending"  # Goes to POS immediately, kitchen after staff confirms
        }

        updated_order = orders_service.update_order(order_id, update_data)

        if not updated_order:
            raise HTTPException(status_code=500, detail="Failed to update order")

        return {
            "success": True,
            "message": "Order received! Your food will be prepared shortly. Please pay at the cashier when ready.",
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Pay at cashier error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Keep the old endpoint for backwards compatibility (redirects to new one)
@app.post("/api/orders/{order_id}/pay-at-counter", summary="Confirm Pay at Counter (Deprecated)")
async def pay_at_counter(order_id: str, request: PayAtCashierRequest):
    """Deprecated: Use /pay-at-cashier instead"""
    return await pay_at_cashier(order_id, request)

# ============================================================
# Staff Confirm Cashier Payment API
# ============================================================

class ConfirmCashierPaymentRequest(BaseModel):
    payment_type: str = "cashier_cash"  # 'cashier_cash' or 'cashier_eftpos'

@app.post("/api/orders/{order_id}/confirm-cashier-payment", summary="Staff Confirm Cashier Payment")
async def confirm_cashier_payment(order_id: str, request: ConfirmCashierPaymentRequest = None):
    """
    พนักงานยืนยันว่าลูกค้าจ่ายเงินที่แคชเชียร์แล้ว (Cash หรือ EFTPOS)
    - New flow: order อยู่ที่ ready → จ่ายเงิน → completed
    - Legacy flow: order อยู่ที่ awaiting_cashier_payment → จ่ายเงิน → confirmed (ส่งครัว)

    Args:
        order_id: Order ID
        request: Request body with payment_type ('cashier_cash' or 'cashier_eftpos')

    Returns:
        Dictionary with updated order
    """
    try:
        # Get order
        order = orders_service.get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Verify order is in a valid state for cashier payment confirmation
        valid_statuses = ["awaiting_cashier_payment", "pending", "confirmed", "preparing", "ready", "completed"]
        current_status = order.get("status")
        if current_status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Order is not in a valid state for cashier payment confirmation")

        # Verify this is a cashier payment order
        if order.get("payment_method") not in ("cash_at_cashier", "cashier_cash", "cashier_eftpos", None):
            raise HTTPException(status_code=400, detail="Order is not a cashier payment order")

        # Get payment type from request or default to cashier_cash
        payment_type = "cashier_cash"
        if request and request.payment_type in ["cashier_cash", "cashier_eftpos"]:
            payment_type = request.payment_type

        # Legacy flow: awaiting_cashier_payment → confirmed (send to kitchen)
        if current_status == "awaiting_cashier_payment":
            update_data = {
                "payment_method": payment_type,
                "payment_status": "paid",
                "status": "confirmed"  # Send to kitchen (legacy flow)
            }
        else:
            # New flow: mark as completed with payment
            update_data = {
                "payment_method": payment_type,
                "payment_status": "paid",
                "status": "completed",
                "completed_at": datetime.now().isoformat()
            }

        updated_order = orders_service.update_order(order_id, update_data)

        if not updated_order:
            raise HTTPException(status_code=500, detail="Failed to update order")

        message = "Payment confirmed. Order sent to kitchen." if current_status == "awaiting_cashier_payment" else "Payment confirmed. Order completed."

        return {
            "success": True,
            "message": message,
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Confirm cashier payment error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Confirm Paid Order API (fallback for payment confirmation)
# ============================================================

@app.post("/api/orders/{order_id}/confirm-paid", summary="Confirm Order Paid (Fallback)")
async def confirm_order_paid(order_id: str):
    """
    Fallback endpoint to confirm an order as paid and move to kitchen queue.
    Used when the main payment confirmation fails but Stripe payment succeeded.

    Args:
        order_id: Order ID

    Returns:
        Dictionary with updated order
    """
    try:
        from datetime import datetime

        # Get current order
        order = orders_service.get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Only update if order is in pending_payment status
        if order.get("status") != "pending_payment":
            return {
                "success": True,
                "message": f"Order already in status: {order.get('status')}",
                "order": order
            }

        # Update order status to verifying_payment (staff will verify before kitchen)
        updated_order = orders_service.update_order(
            order_id=order_id,
            data={
                "status": "verifying_payment",
                "payment_status": "paid",
                "paid_at": datetime.now().isoformat()
            }
        )

        if not updated_order:
            raise HTTPException(status_code=500, detail="Failed to update order")

        print(f"✅ Order {order_id} confirmed as paid via fallback endpoint - awaiting staff verification")

        return {
            "success": True,
            "message": "Payment confirmed. Awaiting staff verification.",
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Confirm paid error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Void Order API (for Cashier)
# ============================================================

class VoidOrderRequest(BaseModel):
    void_reason: str
    voided_by: Optional[str] = None  # Staff ID

@app.post("/api/orders/{order_id}/void", summary="Void Order")
async def void_order(order_id: str, request: VoidOrderRequest):
    """
    Void/Cancel an order (for Cashier)

    Args:
        order_id: Order ID
        void_reason: Reason for voiding
        voided_by: Staff ID who voided (optional)

    Returns:
        Dictionary with voided order
    """
    try:
        # Get order
        order = orders_service.get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Check if already voided
        if order.get("is_voided"):
            raise HTTPException(status_code=400, detail="Order is already voided")

        # Update order to void
        update_data = {
            "is_voided": True,
            "voided_at": datetime.utcnow().isoformat(),
            "void_reason": request.void_reason,
            "status": "cancelled"
        }

        if request.voided_by:
            update_data["voided_by"] = request.voided_by

        updated_order = orders_service.update_order(order_id, update_data)

        if not updated_order:
            raise HTTPException(status_code=500, detail="Failed to void order")

        return {
            "success": True,
            "message": "Order voided successfully",
            "order": updated_order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Void order error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Cashier Daily Summary API
# ============================================================

@app.get("/api/cashier/daily-summary/{restaurant_id}", summary="Get Cashier Daily Summary")
async def get_cashier_daily_summary(restaurant_id: str, date: Optional[str] = None):
    """
    Get daily summary for cashier dashboard

    Args:
        restaurant_id: Restaurant ID
        date: Date in YYYY-MM-DD format (default: today)

    Returns:
        Dictionary with daily summary data
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        actual_restaurant_id = restaurant.get("id")

        # Use today if no date provided
        if not date:
            from datetime import datetime
            date = datetime.now().strftime("%Y-%m-%d")

        # Get orders for the day
        start_datetime = f"{date}T00:00:00"
        end_datetime = f"{date}T23:59:59"

        result = supabase.table("orders").select("*").eq(
            "restaurant_id", actual_restaurant_id
        ).gte("created_at", start_datetime).lte("created_at", end_datetime).execute()

        orders = result.data if result.data else []

        # Calculate summary
        # For cashier dashboard: "completed" = payment received (paid), not kitchen status
        total_orders = len(orders)
        completed_orders = len([o for o in orders if o.get("payment_status") == "paid" and not o.get("is_voided")])
        voided_orders = len([o for o in orders if o.get("is_voided")])
        pending_payment = len([o for o in orders if o.get("payment_status") == "pending" and not o.get("is_voided")])

        # Calculate revenue by payment method
        revenue_by_method = {
            "card": 0,
            "bank_transfer": 0,
            "cashier_cash": 0,
            "cashier_eftpos": 0,
            "unpaid": 0
        }

        total_revenue = 0

        for order in orders:
            if order.get("is_voided"):
                continue

            amount = float(order.get("total_price", 0))
            payment_method = order.get("payment_method")
            payment_status = order.get("payment_status")

            if payment_status == "paid":
                total_revenue += amount
                # Map cashier payment types to separate buckets
                if payment_method == "cashier_eftpos":
                    revenue_by_method["cashier_eftpos"] += amount
                elif payment_method in ("cashier_cash", "cash_at_cashier", "cash_at_counter"):
                    revenue_by_method["cashier_cash"] += amount
                elif payment_method in revenue_by_method:
                    revenue_by_method[payment_method] += amount
                else:
                    revenue_by_method["card"] += amount  # Default to card
            else:
                revenue_by_method["unpaid"] += amount

        # Get void reasons
        void_reasons = []
        for order in orders:
            if order.get("is_voided") and order.get("void_reason"):
                void_reasons.append({
                    "order_id": order.get("id"),
                    "reason": order.get("void_reason"),
                    "amount": float(order.get("total_price", 0))
                })

        return {
            "success": True,
            "date": date,
            "summary": {
                "total_orders": total_orders,
                "completed_orders": completed_orders,
                "voided_orders": voided_orders,
                "pending_payment": pending_payment,
                "total_revenue": round(total_revenue, 2),
                "revenue_by_method": {
                    k: round(v, 2) for k, v in revenue_by_method.items()
                },
                "void_reasons": void_reasons
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Cashier summary error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cashier/orders/{restaurant_id}", summary="Get Cashier Orders by Filter")
async def get_cashier_orders(restaurant_id: str, date: Optional[str] = None, filter: str = "all"):
    """
    Get orders for cashier dashboard with filter

    Args:
        restaurant_id: Restaurant ID
        date: Date in YYYY-MM-DD format (default: today)
        filter: Filter type - 'all', 'completed', 'voided', 'pending_payment'

    Returns:
        List of orders matching the filter
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        actual_restaurant_id = restaurant.get("id")

        # Use today if no date provided
        if not date:
            from datetime import datetime
            date = datetime.now().strftime("%Y-%m-%d")

        # Get orders for the day
        start_datetime = f"{date}T00:00:00"
        end_datetime = f"{date}T23:59:59"

        result = supabase.table("orders").select("*").eq(
            "restaurant_id", actual_restaurant_id
        ).gte("created_at", start_datetime).lte("created_at", end_datetime).order(
            "created_at", desc=True
        ).execute()

        orders = result.data if result.data else []

        # Filter orders based on filter type
        filtered_orders = []
        for order in orders:
            include_order = False

            if filter == "all":
                include_order = True
            elif filter == "completed":
                # For cashier: "completed" = payment received (paid), not kitchen status
                include_order = order.get("payment_status") == "paid" and not order.get("is_voided")
            elif filter == "voided":
                include_order = order.get("is_voided") == True
            elif filter == "pending_payment":
                include_order = order.get("payment_status") == "pending" and not order.get("is_voided")

            if include_order:
                # Parse items from JSON string if needed
                items = order.get("items", [])
                if isinstance(items, str):
                    import json
                    try:
                        items = json.loads(items)
                    except:
                        items = []

                filtered_orders.append({
                    "id": order.get("id"),
                    "table_no": order.get("table_no"),
                    "customer_name": order.get("customer_name"),
                    "service_type": order.get("service_type"),
                    "status": "voided" if order.get("is_voided") else order.get("status"),
                    "payment_status": order.get("payment_status"),
                    "payment_method": order.get("payment_method"),
                    "total_price": float(order.get("total_price", 0)),
                    "created_at": order.get("created_at"),
                    "items": items,
                    "void_reason": order.get("void_reason") if order.get("is_voided") else None
                })

        return {
            "success": True,
            "date": date,
            "filter": filter,
            "orders": filtered_orders
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Cashier orders error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Service Requests API (Call Waiter, Request Sauce, etc.)
# ============================================================

class CreateServiceRequestRequest(BaseModel):
    restaurant_id: str
    table_no: str
    request_type: str  # 'call_waiter', 'request_sauce', 'request_water', 'request_bill', 'other'
    message: Optional[str] = None

@app.post("/api/service-requests", summary="Create Service Request")
async def create_service_request(request: CreateServiceRequestRequest):
    """
    สร้างคำขอบริการใหม่ (เรียกพนักงาน, ขอซอส, ขอน้ำ, ขอบิล, อื่นๆ)

    Args:
        restaurant_id: Restaurant ID
        table_no: Table number
        request_type: Type of request
        message: Additional message (optional)

    Returns:
        Dictionary with created service request
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(request.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {request.restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        # Validate request type
        valid_types = ['call_waiter', 'request_sauce', 'request_water', 'request_bill', 'other']
        if request.request_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid request_type. Must be one of: {valid_types}")

        # Create service request in Supabase
        service_request_data = {
            "restaurant_id": actual_restaurant_id,
            "table_no": request.table_no,
            "request_type": request.request_type,
            "message": request.message,
            "status": "pending"
        }

        result = supabase.table("service_requests").insert(service_request_data).execute()

        if result.data:
            return {
                "success": True,
                "message": "Service request created successfully",
                "service_request": result.data[0]
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create service request")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create service request error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/service-requests", summary="Get Service Requests")
async def get_service_requests(restaurant_id: str, status: Optional[str] = None):
    """
    ดึงคำขอบริการทั้งหมดของร้าน

    Args:
        restaurant_id: Restaurant ID
        status: Filter by status (optional: pending, acknowledged, completed)

    Returns:
        List of service requests
    """
    try:
        # Convert slug to UUID if needed
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant not found: {restaurant_id}")

        actual_restaurant_id = restaurant.get("id")

        # Build query
        query = supabase.table("service_requests") \
            .select("*") \
            .eq("restaurant_id", actual_restaurant_id) \
            .order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()

        return {
            "success": True,
            "count": len(result.data) if result.data else 0,
            "service_requests": result.data or []
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get service requests error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class UpdateServiceRequestStatusRequest(BaseModel):
    status: str  # 'pending', 'acknowledged', 'completed'
    acknowledged_by: Optional[str] = None  # Staff ID who acknowledged

@app.put("/api/service-requests/{request_id}/status", summary="Update Service Request Status")
async def update_service_request_status(request_id: str, request: UpdateServiceRequestStatusRequest):
    """
    อัปเดตสถานะคำขอบริการ

    Args:
        request_id: Service Request ID
        status: New status (pending, acknowledged, completed)
        acknowledged_by: Staff ID who acknowledged (optional)

    Returns:
        Dictionary with updated service request
    """
    try:
        valid_statuses = ['pending', 'acknowledged', 'completed']
        if request.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        update_data = {"status": request.status}

        # Add timestamps based on status
        from datetime import datetime
        if request.status == 'acknowledged':
            update_data["acknowledged_at"] = datetime.now().isoformat()
            if request.acknowledged_by:
                update_data["acknowledged_by"] = request.acknowledged_by
        elif request.status == 'completed':
            update_data["completed_at"] = datetime.now().isoformat()

        result = supabase.table("service_requests") \
            .update(update_data) \
            .eq("id", request_id) \
            .execute()

        if result.data:
            return {
                "success": True,
                "message": f"Service request status updated to {request.status}",
                "service_request": result.data[0]
            }
        else:
            raise HTTPException(status_code=404, detail="Service request not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update service request status error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Best Sellers API
# ============================================================

@app.get("/api/best-sellers", summary="Get Best Selling Menu Items")
async def get_best_sellers(
    restaurant_id: str,
    days: int = 7,
    limit: int = 5
):
    """
    ดึงเมนูขายดีจากยอดขายย้อนหลัง N วัน

    Args:
        restaurant_id: Restaurant ID
        days: จำนวนวันย้อนหลัง (default: 7)
        limit: จำนวนเมนูที่ต้องการ (default: 5)

    Returns:
        List of best selling menu items with sales count
    """
    try:
        print(f"📊 GET /api/best-sellers: restaurant_id={restaurant_id}, days={days}, limit={limit}")
        best_sellers = best_sellers_service.get_best_sellers(restaurant_id, days, limit)
        print(f"📊 Best sellers result: {len(best_sellers)} items")

        return {
            "success": True,
            "count": len(best_sellers),
            "best_sellers": best_sellers,
            "period_days": days
        }
    except Exception as e:
        print(f"❌ Get best sellers error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/best-sellers/update", summary="Update Bestseller Flags for Restaurant")
async def update_bestseller_flags(restaurant_id: str, days: int = 14):
    """
    อัพเดท is_best_seller flag ตามยอดสั่งซื้อ

    - เมนูที่ถูก checkbox ไว้จะยังคงเป็น bestseller (pinned)
    - เมนูที่มียอดสั่งสูงสุด 5 อันดับแรกจะได้รับ flag เช่นกัน
    - ลำดับจะเรียงตามยอดสั่ง โดย pinned items มาก่อน

    Args:
        restaurant_id: Restaurant ID
        days: จำนวนวันย้อนหลัง (default: 14 = 2 สัปดาห์)

    Returns:
        Update results
    """
    try:
        result = best_sellers_service.update_bestseller_flags(restaurant_id, days=days)
        return result
    except Exception as e:
        print(f"❌ Update bestseller flags error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/best-sellers/update-all", summary="Update Bestseller Flags for All Restaurants")
async def update_all_bestseller_flags(days: int = 14, admin_key: str = None):
    """
    อัพเดท bestseller flags สำหรับทุกร้าน (สำหรับ cron job หรือ admin)

    ควรเรียกทุก 2 สัปดาห์เพื่ออัพเดท bestsellers อัตโนมัติ

    Args:
        days: จำนวนวันย้อนหลัง (default: 14)
        admin_key: Admin API key (optional, for security)

    Returns:
        Update results for all restaurants
    """
    try:
        # Optional: Add admin key verification here
        # if admin_key != os.getenv('ADMIN_API_KEY'):
        #     raise HTTPException(status_code=403, detail="Invalid admin key")

        result = best_sellers_service.update_all_restaurants_bestsellers(days=days)
        return result
    except Exception as e:
        print(f"❌ Update all bestseller flags error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Customer Order Tracker API
# ============================================================

@app.get("/api/orders/{order_id}", summary="Get Single Order by ID")
async def get_order(order_id: str):
    """
    ดึงออเดอร์เดียว (สำหรับ Customer Order Tracker)
    
    Args:
        order_id: Order ID
        
    Returns:
        Dictionary with order details
    """
    try:
        order = orders_service.get_order(order_id)
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {
            "success": True,
            "order": order
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get order error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Analytics & Reports API
# ============================================================

@app.get("/api/analytics/revenue", summary="Get Revenue Statistics")
async def get_revenue_stats(
    restaurant_id: str,
    days: int = 30
):
    """
    ดึงสถิติรายได้ของร้าน
    
    Args:
        restaurant_id: Restaurant ID
        days: จำนวนวันย้อนหลัง (default: 30)
        
    Returns:
        Revenue statistics including daily breakdown
    """
    try:
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        stats = analytics_service.get_revenue_stats(restaurant_id, start_date, end_date)
        return stats
    except Exception as e:
        print(f"❌ Get revenue stats error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/popular-items", summary="Get Popular Menu Items")
async def get_popular_items_analytics(
    restaurant_id: str,
    days: int = 30,
    limit: int = 10
):
    """
    ดึงเมนูยอดนิยม
    
    Args:
        restaurant_id: Restaurant ID
        days: จำนวนวันย้อนหลัง (default: 30)
        limit: จำนวนเมนูที่ต้องการ (default: 10)
        
    Returns:
        Popular items with order counts
    """
    try:
        result = analytics_service.get_popular_items(restaurant_id, days, limit)
        return result
    except Exception as e:
        print(f"❌ Get popular items error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/staff/create", summary="Create Staff Member")
async def create_staff(request: dict):
    """
    สร้างพนักงานใหม่
    
    Args:
        restaurant_id: Restaurant ID
        name: Staff name
        email: Staff email (optional)
        phone: Staff phone (optional)
        role: Staff role (owner, manager, chef, waiter, cashier)
        
    Returns:
        Created staff member
    """
    try:
        restaurant_id = request.get('restaurant_id')
        staff_data = {
            'name': request.get('name'),
            'email': request.get('email'),
            'phone': request.get('phone'),
            'role': request.get('role', 'waiter'),
            'pin_code': request.get('pin_code')  # FIX: Include PIN code
        }

        print(f"📝 Creating staff with PIN: {staff_data.get('pin_code')}")
        staff = staff_service.create_staff(restaurant_id, staff_data)
        
        if not staff:
            raise HTTPException(status_code=500, detail="Failed to create staff member")
        
        return {
            "success": True,
            "message": "Staff member created successfully",
            "staff": staff
        }
    except Exception as e:
        print(f"❌ Create staff error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/staff/list", summary="Get All Staff Members")
async def list_staff(restaurant_id: str):
    """
    ดึงรายชื่อพนักงานทั้งหมดของร้าน
    
    Args:
        restaurant_id: Restaurant ID
        
    Returns:
        List of staff members
    """
    try:
        staff_list = staff_service.get_staff_by_restaurant(restaurant_id)
        
        return {
            "success": True,
            "count": len(staff_list),
            "staff": staff_list
        }
    except Exception as e:
        print(f"❌ List staff error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/staff/{staff_id}", summary="Update Staff Member")
async def update_staff(staff_id: str, request: dict):
    """
    อัปเดตข้อมูลพนักงาน
    
    Args:
        staff_id: Staff ID
        request: Update data
        
    Returns:
        Updated staff member
    """
    try:
        staff = staff_service.update_staff(staff_id, request)
        
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        return {
            "success": True,
            "message": "Staff member updated successfully",
            "staff": staff
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update staff error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/staff/{staff_id}", summary="Deactivate Staff Member")
async def deactivate_staff(staff_id: str):
    """
    ปิดการใช้งานพนักงาน (soft delete)
    
    Args:
        staff_id: Staff ID
        
    Returns:
        Success status
    """
    try:
        success = staff_service.deactivate_staff(staff_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        return {
            "success": True,
            "message": "Staff member deactivated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Deactivate staff error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/staff/verify-pin", summary="Verify Staff PIN Code")
async def verify_staff_pin(request: dict):
    """
    ตรวจสอบ PIN code สำหรับ POS login
    
    Args:
        restaurant_id: Restaurant ID
        pin_code: 6-digit PIN
        
    Returns:
        Staff member data if PIN is valid
    """
    try:
        restaurant_id = request.get('restaurant_id')
        pin_code = request.get('pin_code')
        
        if not pin_code or len(pin_code) != 6:
            raise HTTPException(status_code=400, detail="Invalid PIN code format")
        
        staff = staff_service.verify_pin(restaurant_id, pin_code)

        if not staff:
            raise HTTPException(status_code=401, detail="Invalid PIN code")

        # Get owner's plan for POS feature gating
        owner_plan = "free_trial"
        try:
            rest_result = restaurant_service.supabase_client.table('restaurants').select('user_id').eq('id', restaurant_id).limit(1).execute()
            if rest_result.data and rest_result.data[0].get('user_id'):
                owner_status = trial_limits_service.get_user_status(rest_result.data[0]['user_id'])
                owner_plan = owner_status.get('role', 'free_trial')
        except Exception as plan_err:
            print(f"⚠️ Failed to get owner plan: {plan_err}")

        # Log login activity
        staff_service.log_activity(
            staff['id'],
            restaurant_id,
            'staff_login',
            f"{staff['name']} logged in via PIN"
        )

        return {
            "success": True,
            "staff": staff,
            "owner_plan": owner_plan
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Verify PIN error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/library", summary="Get All Images for User (Shared Library)")
async def get_image_library(user_id: str, limit: int = 100):
    """
    ดึงรูปภาพทั้งหมดของ user จากทุกร้าน (Shared Image Library)

    **Available for ALL PLANS**

    Args:
        user_id: User ID
        limit: จำนวนรูปสูงสุด (default: 100)

    Returns:
        List of images with metadata (restaurant name, menu name, etc.)
    """
    try:
        images = image_library_service.get_all_images_by_user(user_id, limit)
        
        return {
            "success": True,
            "count": len(images),
            "images": images
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get image library error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/restaurant/{restaurant_id}", summary="Get Images by Restaurant - ALL PLANS")
async def get_restaurant_images(restaurant_id: str, user_id: str, limit: int = 50):
    """
    ดึงรูปภาพของร้านหนึ่งๆ (OWN RESTAURANT ONLY)
    
    **Available for ALL PLANS** - แต่เห็นเฉพาะรูปของร้านตัวเอง
    
    Args:
        restaurant_id: Restaurant ID
        user_id: User ID (for ownership verification)
        limit: จำนวนรูปสูงสุด
        
    Returns:
        List of images from this restaurant
    """
    try:
        # Verify that this restaurant belongs to the user
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Check ownership - allow if user_id is NULL or matches
        restaurant_user_id = restaurant.get('user_id')
        if restaurant_user_id is not None and restaurant_user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to access this restaurant's images"
            )

        images = image_library_service.get_images_by_restaurant(restaurant_id, limit)
        
        return {
            "success": True,
            "count": len(images),
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant.get('name'),
            "images": images
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get restaurant images error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/search", summary="Search Images by Menu Name - ENTERPRISE ONLY")
async def search_images(user_id: str, q: str, limit: int = 50):
    """
    ค้นหารูปภาพตามชื่อเมนู
    
    **ENTERPRISE ONLY FEATURE**
    
    Args:
        user_id: User ID
        q: คำค้นหา (menu name)
        limit: จำนวนรูปสูงสุด
        
    Returns:
        List of matching images
    """
    try:
        # Check if user has Enterprise plan
        trial_status = trial_limits_service.get_trial_status(user_id)
        user_plan = trial_status.get('plan', 'free_trial')
        
        if user_plan != 'enterprise':
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Image Library is an Enterprise-only feature",
                    "message": "Upgrade to Enterprise to search across all your restaurant images",
                    "current_plan": user_plan,
                    "required_plan": "enterprise"
                }
            )
        
        images = image_library_service.search_images(user_id, q, limit)
        
        return {
            "success": True,
            "count": len(images),
            "query": q,
            "images": images
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Search images error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/images/recent", summary="Get Recent Image Uploads")
async def get_recent_images(user_id: str, days: int = 7, limit: int = 20):
    """
    ดึงรูปที่อัปโหลดล่าสุด

    **Available for ALL PLANS**

    Args:
        user_id: User ID
        days: จำนวนวันย้อนหลัง (default: 7)
        limit: จำนวนรูปสูงสุด (default: 20)

    Returns:
        List of recent images
    """
    try:
        images = image_library_service.get_recent_uploads(user_id, days, limit)
        
        return {
            "success": True,
            "count": len(images),
            "period": f"Last {days} days",
            "images": images
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get recent images error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/restaurants", summary="Get All Restaurants for User")
async def list_user_restaurants(user_id: str):
    """
    ดึงร้านอาหารทั้งหมดของ user (Multi-restaurant support)
    
    Args:
        user_id: User ID
        
    Returns:
        List of restaurants owned by user
    """
    try:
        restaurants = restaurant_service.get_all_restaurants_by_user_id(user_id)
        
        return {
            "success": True,
            "count": len(restaurants),
            "restaurants": restaurants
        }
    except Exception as e:
        print(f"❌ List restaurants error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/restaurant", summary="Create New Restaurant")
async def create_restaurant(request: Dict[str, Any]):
    """
    สร้างร้านอาหารใหม่
    
    Args:
        user_id: User ID
        name: Restaurant name (required)
        description: Description (optional)
        address: Address (optional)
        phone: Phone (optional)
        email: Email (optional)
        
    Returns:
        Created restaurant data
    """
    try:
        user_id = request.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        restaurant_data = {
            "name": request.get("name"),
            "description": request.get("description"),
            "address": request.get("address"),
            "phone": request.get("phone"),
            "email": request.get("email"),
        }
        
        if not restaurant_data["name"]:
            raise HTTPException(status_code=400, detail="name is required")

        # Multi-branch restriction: only Enterprise can have multiple restaurants
        try:
            existing = restaurant_service.supabase_client.table('restaurants').select('id', count='exact').eq('user_id', user_id).execute()
            existing_count = existing.count or 0
            if existing_count >= 1:
                user_status = trial_limits_service.get_user_status(user_id)
                user_role = user_status.get('role', 'free_trial')
                if user_role not in ['enterprise', 'admin']:
                    raise HTTPException(
                        status_code=403,
                        detail="Multi-branch support is only available in Enterprise plan. Please upgrade to add more restaurants."
                    )
        except HTTPException:
            raise
        except Exception as branch_err:
            print(f"⚠️ Branch limit check failed (allowing create): {branch_err}")

        restaurant = restaurant_service.create_restaurant(user_id, restaurant_data)
        
        if restaurant:
            return {
                "success": True,
                "restaurant": restaurant
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create restaurant")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create restaurant error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/restaurant/{restaurant_id}", summary="Get Restaurant by ID")
async def get_restaurant(restaurant_id: str):
    """
    ดึงข้อมูลร้านอาหารจาก ID หรือ slug

    Args:
        restaurant_id: Restaurant ID (UUID) หรือ slug

    Returns:
        Restaurant data including slug
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id_or_slug(restaurant_id)

        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        return {
            "success": True,
            "restaurant": {
                "id": restaurant.get("id"),
                "name": restaurant.get("name"),
                "slug": restaurant.get("slug"),
                "phone": restaurant.get("phone"),
                "email": restaurant.get("email"),
                "address": restaurant.get("address"),
                "logo_url": restaurant.get("logo_url"),
                "theme_color": restaurant.get("theme_color"),
                "cover_image_url": restaurant.get("cover_image_url"),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get restaurant error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}", summary="Update Restaurant")
async def update_restaurant(restaurant_id: str, request: Dict[str, Any]):
    """
    อัปเดตข้อมูลร้านอาหาร
    
    Args:
        restaurant_id: Restaurant ID
        user_id: User ID (for verification)
        name, description, address, phone, email: Fields to update
        
    Returns:
        Updated restaurant data
    """
    try:
        user_id = request.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        update_data = {
            "name": request.get("name"),
            "description": request.get("description"),
            "address": request.get("address"),
            "phone": request.get("phone"),
            "email": request.get("email"),
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        restaurant = restaurant_service.update_restaurant(restaurant_id, user_id, update_data)
        
        if restaurant:
            return {
                "success": True,
                "restaurant": restaurant
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update restaurant")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update restaurant error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/restaurant/{restaurant_id}/category-order", summary="Update Category Order")
async def update_category_order(restaurant_id: str, request: Dict[str, Any]):
    """
    อัปเดตลำดับหมวดหมู่เมนู

    Args:
        restaurant_id: Restaurant ID
        category_order: Array of category names in display order

    Returns:
        Success status
    """
    try:
        category_order = request.get("category_order", [])

        # Update in database
        result = supabase.table("restaurants").update({
            "category_order": category_order
        }).eq("id", restaurant_id).execute()

        if result.data:
            return {
                "success": True,
                "message": "Category order updated successfully",
                "category_order": category_order
            }
        else:
            raise HTTPException(status_code=404, detail="Restaurant not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update category order error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/restaurant/{restaurant_id}/category-order", summary="Get Category Order")
async def get_category_order(restaurant_id: str):
    """
    ดึงลำดับหมวดหมู่เมนู

    Args:
        restaurant_id: Restaurant ID

    Returns:
        Category order array
    """
    try:
        result = supabase.table("restaurants").select("category_order").eq("id", restaurant_id).execute()

        if result.data and len(result.data) > 0:
            return {
                "success": True,
                "category_order": result.data[0].get("category_order", [])
            }
        else:
            raise HTTPException(status_code=404, detail="Restaurant not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get category order error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/restaurant/{restaurant_id}", summary="Delete Restaurant")
async def delete_restaurant(restaurant_id: str, user_id: str):
    """
    ลบร้านอาหาร (CASCADE: จะลบ menus, orders ทั้งหมดด้วย)
    
    Args:
        restaurant_id: Restaurant ID
        user_id: User ID (for verification)
        
    Returns:
        Success status
    """
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        
        # Verify ownership before delete
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Check ownership - allow if user_id is NULL or matches
        restaurant_user_id = restaurant.get('user_id')
        if restaurant_user_id is not None and restaurant_user_id != user_id:
            raise HTTPException(status_code=403, detail="You don't have permission to delete this restaurant")

        # Delete (CASCADE will handle menus, orders, etc.)
        success = restaurant_service.delete_restaurant(restaurant_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": "Restaurant deleted successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete restaurant")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Delete restaurant error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/set-restaurant", summary="Set Active Restaurant")
async def set_active_restaurant(request: Dict[str, Any]):
    """
    เปลี่ยนร้านที่กำลัง active (สำหรับ multi-restaurant)
    
    Args:
        user_id: User ID
        restaurant_id: Restaurant ID to set as active
        
    Returns:
        Success status
    """
    try:
        user_id = request.get("user_id")
        restaurant_id = request.get("restaurant_id")
        
        if not user_id or not restaurant_id:
            raise HTTPException(status_code=400, detail="user_id and restaurant_id are required")

        # Get restaurant first
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Verify ownership - allow if restaurant.user_id is NULL OR matches user_id
        restaurant_user_id = restaurant.get('user_id')
        if restaurant_user_id is not None and restaurant_user_id != user_id:
            raise HTTPException(status_code=403, detail="You don't have permission to access this restaurant")
        
        # Update active restaurant in database
        # Set all restaurants to inactive first
        all_restaurants = restaurant_service.get_all_restaurants_by_user_id(user_id)
        for rest in all_restaurants:
            if rest.get('id') != restaurant_id:
                # Set others to inactive
                restaurant_service.update_restaurant(rest.get('id'), user_id, {'is_active': False})
        
        # Set selected restaurant as active
        restaurant_service.update_restaurant(restaurant_id, user_id, {'is_active': True})
        
        return {
            "success": True,
            "message": "Active restaurant changed",
            "restaurant_id": restaurant_id,
            "restaurant": restaurant
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Set active restaurant error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/trends", summary="Get Order Trends")
async def get_order_trends(
    restaurant_id: str,
    days: int = 30
):
    """
    ดึง order trends (hourly/daily distribution, peak times)
    
    Args:
        restaurant_id: Restaurant ID
        days: จำนวนวันย้อนหลัง (default: 30)
        
    Returns:
        Order trends and peak times
    """
    try:
        result = analytics_service.get_order_trends(restaurant_id, days)
        return result
    except Exception as e:
        print(f"❌ Get order trends error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# AI ASSISTANT ENDPOINTS (Enterprise Only)
# ============================================================================

@app.post("/api/ai/assistant/chat", summary="AI Assistant Chat (Enterprise Only)")
async def ai_assistant_chat(request: Dict[str, Any]):
    """AI-powered restaurant management assistant - Enterprise plan only"""
    try:
        user_id = request.get('user_id')
        restaurant_id = request.get('restaurant_id')
        message = request.get('message', '')
        history = request.get('history', [])

        if not user_id or not restaurant_id or not message:
            raise HTTPException(status_code=400, detail="user_id, restaurant_id, and message are required")

        # Enterprise plan gate
        user_status = trial_limits_service.get_user_status(user_id)
        user_role = user_status.get('role', 'free_trial')
        if user_role not in ['enterprise', 'admin']:
            raise HTTPException(status_code=403, detail="AI Assistant is only available in Enterprise plan.")

        result = ai_assistant_service.chat(user_id, restaurant_id, message, history)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ AI Assistant chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/assistant/analytics-summary/{restaurant_id}", summary="AI Analytics Summary (Enterprise Only)")
async def ai_analytics_summary(restaurant_id: str, user_id: str = "", days: int = 30):
    """AI-generated analytics summary with insights - Enterprise plan only"""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        # Enterprise plan gate
        user_status = trial_limits_service.get_user_status(user_id)
        user_role = user_status.get('role', 'free_trial')
        if user_role not in ['enterprise', 'admin']:
            raise HTTPException(status_code=403, detail="AI Analytics is only available in Enterprise plan.")

        result = ai_assistant_service.get_analytics_summary(restaurant_id, days)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ AI Analytics summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# IMAGE LIBRARY ENDPOINTS
# ============================================================================
# Note: /api/best-sellers endpoint is defined earlier in this file (around line 2804)
# Note: Image library endpoints (/api/images/*) are defined earlier in this file (around line 2401)

@app.post("/api/menus/copy-to-restaurant", summary="Copy Menu to Another Restaurant")
async def copy_menu_to_restaurant(request: Dict[str, Any]):
    """
    คัดลอกเมนูไปยังร้านอื่น (Enterprise feature)
    
    Args:
        user_id: User ID
        menu_id: Menu ID to copy
        target_restaurant_id: Target restaurant ID
        
    Returns:
        New menu item
    """
    try:
        user_id = request.get("user_id")
        menu_id = request.get("menu_id")
        target_restaurant_id = request.get("target_restaurant_id")
        
        if not all([user_id, menu_id, target_restaurant_id]):
            raise HTTPException(
                status_code=400,
                detail="user_id, menu_id, and target_restaurant_id are required"
            )
        
        # Verify user has Enterprise/Premium plan
        user_profile = user_role_service.get_user_profile(user_id)
        role = user_profile.get('role', 'free_trial')
        
        if role not in ['enterprise', 'premium', 'admin']:
            raise HTTPException(
                status_code=403,
                detail="This feature is only available for Enterprise/Premium users"
            )
        
        # Verify source menu exists and belongs to user
        source_menu = menu_service.get_menu_item(menu_id)
        if not source_menu:
            raise HTTPException(status_code=404, detail="Source menu not found")
        
        # Verify target restaurant belongs to user - allow if user_id is NULL or matches
        target_restaurant = restaurant_service.get_restaurant_by_id(target_restaurant_id)
        if not target_restaurant:
            raise HTTPException(status_code=404, detail="Target restaurant not found")

        target_user_id = target_restaurant.get('user_id')
        if target_user_id is not None and target_user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to access target restaurant"
            )
        
        # Copy menu item (with all translations including meats/addOns)
        new_menu_data = {
            'name': source_menu.get('name'),
            'nameEn': source_menu.get('nameEn') or source_menu.get('name_english'),
            'description': source_menu.get('description'),
            'descriptionEn': source_menu.get('descriptionEn') or source_menu.get('description_english'),
            'price': source_menu.get('price'),
            'category': source_menu.get('category'),
            'categoryEn': source_menu.get('categoryEn') or source_menu.get('category_english'),
            'image_url': source_menu.get('image_url') or source_menu.get('photo_url'),
            'is_best_seller': source_menu.get('is_best_seller', False),
            'meats': source_menu.get('meats', []),
            'addOns': source_menu.get('addOns', []),
            'restaurant_id': target_restaurant_id
        }
        
        new_menu = menu_service.create_menu_item(target_restaurant_id, new_menu_data)
        
        return {
            "success": True,
            "message": "Menu copied successfully",
            "menu": new_menu
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Copy menu error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Delivery Distance Calculation API (Google Maps)
# ============================================================

class DeliveryCalculationRequest(BaseModel):
    restaurant_id: str
    customer_address: str

class UpdateRestaurantLocationRequest(BaseModel):
    restaurant_id: str
    address: Optional[str] = None  # Address to geocode
    latitude: Optional[float] = None  # Or provide coordinates directly
    longitude: Optional[float] = None

@app.post("/api/delivery/calculate")
async def calculate_delivery_fee(request: DeliveryCalculationRequest):
    """
    Calculate delivery fee based on customer address and restaurant location

    1. Gets restaurant location (lat/lng) from database
    2. Geocodes customer address using Nominatim
    3. Calculates distance using Haversine formula
    4. Returns delivery fee based on restaurant's delivery settings (per-km or tier-based)
    """
    try:
        # Get restaurant details
        restaurant = restaurant_service.get_restaurant_by_id(request.restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        # Check if restaurant has coordinates
        restaurant_lat = restaurant.get("latitude")
        restaurant_lng = restaurant.get("longitude")

        if not restaurant_lat or not restaurant_lng:
            raise HTTPException(
                status_code=400,
                detail="Restaurant location not configured. Please set restaurant coordinates in settings."
            )

        # Get delivery settings and rates
        delivery_settings = restaurant.get("delivery_settings") or {}
        delivery_rates = restaurant.get("delivery_rates") or []
        pricing_mode = delivery_settings.get("pricing_mode", "per_km")

        # Default settings
        base_fee = delivery_settings.get("base_fee", 3.00)
        price_per_km = delivery_settings.get("price_per_km", 1.50)
        max_distance_km = delivery_settings.get("max_distance_km", 15)
        free_delivery_above = delivery_settings.get("free_delivery_above", 0)

        # Geocode customer address
        customer_location = await delivery_service.geocode_address(request.customer_address)
        if not customer_location:
            return {
                "success": False,
                "error": "Could not find the address. Please check and try again."
            }

        # Calculate distance
        distance_km = delivery_service.haversine_distance(
            float(restaurant_lat), float(restaurant_lng),
            customer_location["lat"], customer_location["lng"]
        )

        # Apply road distance factor (roads are typically 1.3x longer than straight line)
        distance_km = delivery_service.estimate_road_distance(distance_km)
        duration_minutes = delivery_service.estimate_duration(distance_km)

        # Check if within range
        if pricing_mode == "per_km":
            max_dist = max_distance_km
        else:
            # For tier-based, get max from delivery rates
            max_dist = max(rate.get("distance_km", 0) for rate in delivery_rates) if delivery_rates else 15

        if distance_km > max_dist:
            return {
                "success": True,
                "is_within_range": False,
                "distance_km": round(distance_km, 1),
                "distance_text": f"{round(distance_km, 1)} km",
                "max_distance_km": max_dist,
                "message": f"Sorry, we only deliver within {max_dist} km",
                "formatted_address": customer_location.get("formatted_address")
            }

        # Calculate delivery fee
        if pricing_mode == "per_km":
            # Per-km pricing: base_fee + (distance * price_per_km)
            delivery_fee = base_fee + (distance_km * price_per_km)
            delivery_fee = round(delivery_fee, 2)
        else:
            # Tier-based pricing
            delivery_fee = 0
            for rate in sorted(delivery_rates, key=lambda x: x.get("distance_km", 0)):
                if distance_km <= rate.get("distance_km", 0):
                    delivery_fee = rate.get("price", 0)
                    break
            if delivery_fee == 0 and delivery_rates:
                # Use highest tier if beyond all tiers
                delivery_fee = max(rate.get("price", 0) for rate in delivery_rates)

        return {
            "success": True,
            "is_within_range": True,
            "customer_location": {
                "lat": customer_location["lat"],
                "lng": customer_location["lng"],
                "formatted_address": customer_location.get("formatted_address")
            },
            "distance_km": round(distance_km, 1),
            "distance_text": f"{round(distance_km, 1)} km",
            "duration_minutes": duration_minutes,
            "duration_text": f"{duration_minutes} mins",
            "delivery_fee": delivery_fee,
            "pricing_mode": pricing_mode,
            "free_delivery_above": free_delivery_above,
            "formatted_address": customer_location.get("formatted_address"),
            "message": f"Delivery fee calculated"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Delivery calculation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/delivery/geocode")
async def geocode_address(address: str = Form(...)):
    """
    Geocode an address to get coordinates using Google Maps API
    """
    try:
        result = await delivery_service.geocode_address(address)

        if result:
            return {
                "success": True,
                "location": result
            }
        else:
            return {
                "success": False,
                "error": "Could not geocode the address. Please try a different address."
            }

    except Exception as e:
        print(f"❌ Geocode error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/restaurant/update-location")
async def update_restaurant_location(request: UpdateRestaurantLocationRequest):
    """
    Update restaurant location (coordinates)
    Can provide either an address to geocode or direct lat/lng coordinates
    """
    try:
        lat = request.latitude
        lng = request.longitude

        # If address provided, geocode it
        if request.address and (not lat or not lng):
            geocode_result = await delivery_service.geocode_address(request.address)
            if geocode_result:
                lat = geocode_result["lat"]
                lng = geocode_result["lng"]
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Could not geocode the address. Please try a different address or provide coordinates directly."
                )

        if not lat or not lng:
            raise HTTPException(
                status_code=400,
                detail="Please provide either an address or latitude/longitude coordinates"
            )

        # Update restaurant in database
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
        supabase = create_client(supabase_url, supabase_key)

        result = supabase.table("restaurants").update({
            "latitude": lat,
            "longitude": lng
        }).eq("id", request.restaurant_id).execute()

        if result.data:
            return {
                "success": True,
                "message": "Restaurant location updated successfully",
                "location": {
                    "latitude": lat,
                    "longitude": lng
                }
            }
        else:
            raise HTTPException(status_code=404, detail="Restaurant not found")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update location error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/restaurant/{restaurant_id}/location")
async def get_restaurant_location(restaurant_id: str):
    """
    Get restaurant location (coordinates)
    """
    try:
        restaurant = restaurant_service.get_restaurant_by_id(restaurant_id)
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        return {
            "success": True,
            "location": {
                "latitude": restaurant.get("latitude"),
                "longitude": restaurant.get("longitude"),
                "address": restaurant.get("address")
            },
            "has_location": bool(restaurant.get("latitude") and restaurant.get("longitude"))
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Get location error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Super Admin Dashboard API Endpoints
# ============================================================

@app.get("/api/admin/overview", summary="Get Platform Overview Stats")
async def admin_get_overview(admin_user_id: str):
    """Get platform-wide statistics for admin dashboard"""
    result = admin_service.get_platform_overview(admin_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/users/list", summary="Get All Users (Admin)")
async def admin_get_users(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    role_filter: Optional[str] = None
):
    """Get all users with detailed info for admin"""
    result = admin_service.get_all_users_detailed(admin_user_id, page, limit, search, role_filter)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class AdminUpdateUserRequest(BaseModel):
    admin_user_id: str
    target_user_id: str
    role: Optional[str] = None
    plan: Optional[str] = None
    email: Optional[str] = None
    restaurant_name: Optional[str] = None
    subscription_status: Optional[str] = None
    is_active: Optional[bool] = None


@app.post("/api/admin/users/update", summary="Update User (Admin)")
async def admin_update_user(request: AdminUpdateUserRequest):
    """Update user profile as admin"""
    updates = {}
    if request.role:
        updates['role'] = request.role
    if request.plan:
        updates['plan'] = request.plan
    if request.email:
        updates['email'] = request.email
    if request.restaurant_name:
        updates['restaurant_name'] = request.restaurant_name
    if request.subscription_status:
        updates['subscription_status'] = request.subscription_status
    if request.is_active is not None:
        updates['is_active'] = request.is_active

    result = admin_service.update_user(request.admin_user_id, request.target_user_id, updates)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.delete("/api/admin/users/{target_user_id}", summary="Delete User (Admin)")
async def admin_delete_user(target_user_id: str, admin_user_id: str):
    """Delete user as admin"""
    result = admin_service.delete_user(admin_user_id, target_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/users/{target_user_id}", summary="Get User Detail (Admin)")
async def admin_get_user_detail(target_user_id: str, admin_user_id: str):
    """Get detailed user info as admin - includes all customer data, restaurants, stats"""
    result = admin_service.get_user_detail(admin_user_id, target_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/restaurants/list", summary="Get All Restaurants (Admin)")
async def admin_get_restaurants(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all restaurants for admin"""
    result = admin_service.get_all_restaurants(admin_user_id, page, limit, search, is_active)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class AdminUpdateRestaurantRequest(BaseModel):
    admin_user_id: str
    restaurant_id: str
    name: Optional[str] = None
    is_active: Optional[bool] = None
    gst_registered: Optional[bool] = None
    gst_number: Optional[str] = None


@app.post("/api/admin/restaurants/update", summary="Update Restaurant (Admin)")
async def admin_update_restaurant(request: AdminUpdateRestaurantRequest):
    """Update restaurant as admin"""
    updates = {}
    if request.name is not None:
        updates['name'] = request.name
    if request.is_active is not None:
        updates['is_active'] = request.is_active
    if request.gst_registered is not None:
        updates['gst_registered'] = request.gst_registered
    if request.gst_number is not None:
        updates['gst_number'] = request.gst_number

    result = admin_service.update_restaurant(request.admin_user_id, request.restaurant_id, updates)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/orders/list", summary="Get All Orders (Admin)")
async def admin_get_orders(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get all orders platform-wide for admin"""
    result = admin_service.get_all_orders(admin_user_id, page, limit, status, payment_status, restaurant_id, date_from, date_to)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class AdminUpdateOrderRequest(BaseModel):
    admin_user_id: str
    order_id: str
    status: Optional[str] = None
    payment_status: Optional[str] = None


@app.post("/api/admin/orders/update", summary="Update Order Status (Admin)")
async def admin_update_order(request: AdminUpdateOrderRequest):
    """Update order status as admin"""
    result = admin_service.update_order_status(request.admin_user_id, request.order_id, request.status, request.payment_status)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/payments/list", summary="Get Payment Logs (Admin)")
async def admin_get_payments(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    restaurant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get payment logs for admin"""
    result = admin_service.get_payment_logs(admin_user_id, page, limit, status, restaurant_id, date_from, date_to)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/payments/summary", summary="Get Payment Summary (Admin)")
async def admin_get_payment_summary(admin_user_id: str, period: str = "month"):
    """Get payment summary stats for admin"""
    result = admin_service.get_payment_summary(admin_user_id, period)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/coupons/list", summary="Get All Coupons (Admin)")
async def admin_get_coupons(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    is_active: Optional[bool] = None,
    restaurant_id: Optional[str] = None
):
    """Get all coupons for admin"""
    result = admin_service.get_all_coupons(admin_user_id, page, limit, is_active, restaurant_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class AdminCreateCouponRequest(BaseModel):
    admin_user_id: str
    code: str
    name: str
    description: Optional[str] = None
    discount_type: str  # 'percentage' or 'fixed_amount'
    discount_value: float
    min_order_amount: float = 0
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True
    applies_to: str = 'all'  # 'all', 'dine_in', 'pickup', 'delivery'
    restaurant_id: Optional[str] = None  # None = global coupon


@app.post("/api/admin/coupons/create", summary="Create Coupon (Admin)")
async def admin_create_coupon(request: AdminCreateCouponRequest):
    """Create new coupon as admin"""
    coupon_data = {
        'code': request.code.upper(),
        'name': request.name,
        'description': request.description,
        'discount_type': request.discount_type,
        'discount_value': request.discount_value,
        'min_order_amount': request.min_order_amount,
        'max_discount_amount': request.max_discount_amount,
        'usage_limit': request.usage_limit,
        'start_date': request.start_date,
        'end_date': request.end_date,
        'is_active': request.is_active,
        'applies_to': request.applies_to,
        'restaurant_id': request.restaurant_id
    }
    result = admin_service.create_coupon(request.admin_user_id, coupon_data)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class AdminUpdateCouponRequest(BaseModel):
    admin_user_id: str
    coupon_id: str
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None
    applies_to: Optional[str] = None


@app.post("/api/admin/coupons/update", summary="Update Coupon (Admin)")
async def admin_update_coupon(request: AdminUpdateCouponRequest):
    """Update coupon as admin"""
    updates = {k: v for k, v in request.dict().items() if v is not None and k not in ['admin_user_id', 'coupon_id']}
    if 'code' in updates:
        updates['code'] = updates['code'].upper()
    result = admin_service.update_coupon(request.admin_user_id, request.coupon_id, updates)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.delete("/api/admin/coupons/{coupon_id}", summary="Delete Coupon (Admin)")
async def admin_delete_coupon(coupon_id: str, admin_user_id: str):
    """Delete coupon as admin"""
    result = admin_service.delete_coupon(admin_user_id, coupon_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ============================================================
# Public Coupon Validation (for checkout page)
# ============================================================

class ValidateCouponRequest(BaseModel):
    code: str
    plan_id: Optional[str] = None
    amount: float


@app.post("/api/coupons/validate", summary="Validate Coupon Code")
async def validate_coupon(request: ValidateCouponRequest):
    """
    Validate coupon code for checkout.
    Returns discount information if valid.
    """
    try:
        # Get coupon from database
        result = supabase.table('coupons').select('*').eq('code', request.code.upper()).eq('is_active', True).execute()

        if not result.data:
            return {"valid": False, "message": "Invalid coupon code"}

        coupon = result.data[0]

        # Check if coupon has expired
        from datetime import datetime
        now = datetime.now()

        if coupon.get('end_date'):
            end_date = datetime.fromisoformat(coupon['end_date'].replace('Z', '+00:00'))
            if now > end_date.replace(tzinfo=None):
                return {"valid": False, "message": "Coupon has expired"}

        if coupon.get('start_date'):
            start_date = datetime.fromisoformat(coupon['start_date'].replace('Z', '+00:00'))
            if now < start_date.replace(tzinfo=None):
                return {"valid": False, "message": "Coupon is not yet active"}

        # Check usage limit
        if coupon.get('usage_limit') and coupon.get('used_count', 0) >= coupon['usage_limit']:
            return {"valid": False, "message": "Coupon usage limit reached"}

        # Check minimum order amount
        if coupon.get('min_order_amount') and request.amount < coupon['min_order_amount']:
            return {"valid": False, "message": f"Minimum order amount is ${coupon['min_order_amount']}"}

        # Calculate discount
        discount_type = coupon.get('discount_type', 'percentage')
        discount_value = float(coupon.get('discount_value', 0))

        if discount_type == 'percentage':
            discount_amount = request.amount * (discount_value / 100)
            # Apply max discount cap if set
            if coupon.get('max_discount_amount'):
                discount_amount = min(discount_amount, float(coupon['max_discount_amount']))
        else:  # fixed_amount
            discount_amount = min(discount_value, request.amount)

        return {
            "valid": True,
            "code": coupon['code'],
            "name": coupon.get('name', ''),
            "discount_type": discount_type,
            "discount_value": discount_value,
            "discount_amount": round(discount_amount, 2),
            "message": "Coupon applied successfully"
        }

    except Exception as e:
        return {"valid": False, "message": f"Error validating coupon: {str(e)}"}


@app.get("/api/admin/logs", summary="Get Admin Activity Logs")
async def admin_get_logs(
    admin_user_id: str,
    page: int = 1,
    limit: int = 50,
    action_filter: Optional[str] = None,
    target_type: Optional[str] = None
):
    """Get admin activity logs"""
    result = admin_service.get_activity_logs(admin_user_id, page, limit, action_filter, target_type)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/staff/list", summary="Get All Staff (Admin)")
async def admin_get_staff(
    admin_user_id: str,
    page: int = 1,
    limit: int = 20,
    restaurant_id: Optional[str] = None,
    role: Optional[str] = None
):
    """Get all staff across all restaurants for admin"""
    result = admin_service.get_all_staff(admin_user_id, page, limit, restaurant_id, role)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ==================== BANK TRANSFER APPROVAL ENDPOINTS ====================

@app.get("/api/admin/payments/pending", summary="Get Pending Bank Transfer Approvals")
async def admin_get_pending_approvals(admin_user_id: str):
    """Get all pending bank transfer payments awaiting admin approval"""
    result = admin_service.get_pending_approvals(admin_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class ApproveBankTransferRequest(BaseModel):
    admin_user_id: str
    payment_log_id: str
    notes: Optional[str] = None


@app.post("/api/admin/payments/approve", summary="Approve Bank Transfer Payment")
async def admin_approve_bank_transfer(request: ApproveBankTransferRequest):
    """Approve a bank transfer payment and activate the user's subscription"""
    result = admin_service.approve_bank_transfer(
        request.admin_user_id,
        request.payment_log_id,
        request.notes
    )
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class RejectBankTransferRequest(BaseModel):
    admin_user_id: str
    payment_log_id: str
    reason: str


@app.post("/api/admin/payments/reject", summary="Reject Bank Transfer Payment")
async def admin_reject_bank_transfer(request: RejectBankTransferRequest):
    """Reject a bank transfer payment with a reason"""
    result = admin_service.reject_bank_transfer(
        request.admin_user_id,
        request.payment_log_id,
        request.reason
    )
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ==================== SUBSCRIPTION MANAGEMENT ENDPOINTS ====================

class ExtendSubscriptionRequest(BaseModel):
    admin_user_id: str
    target_user_id: str
    extension_days: int
    reason: Optional[str] = None


@app.post("/api/admin/subscriptions/extend", summary="Extend User Subscription")
async def admin_extend_subscription(request: ExtendSubscriptionRequest):
    """Extend a user's subscription by a specified number of days"""
    result = admin_service.extend_subscription(
        request.admin_user_id,
        request.target_user_id,
        request.extension_days,
        request.reason
    )
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class ChangePlanRequest(BaseModel):
    admin_user_id: str
    target_user_id: str
    new_plan: str
    reason: Optional[str] = None
    billing_interval: Optional[str] = 'monthly'  # 'monthly' or 'yearly'


@app.post("/api/admin/subscriptions/change-plan", summary="Change User Plan")
async def admin_change_plan(request: ChangePlanRequest):
    """Change a user's subscription plan and set subscription dates automatically"""
    result = admin_service.change_user_plan(
        request.admin_user_id,
        request.target_user_id,
        request.new_plan,
        request.reason,
        request.billing_interval or 'monthly'
    )
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


class CancelSubscriptionRequest(BaseModel):
    admin_user_id: str
    target_user_id: str
    reason: Optional[str] = None
    immediate: bool = False


@app.post("/api/admin/subscriptions/cancel", summary="Cancel User Subscription")
async def admin_cancel_subscription(request: CancelSubscriptionRequest):
    """Cancel a user's subscription"""
    result = admin_service.cancel_subscription(
        request.admin_user_id,
        request.target_user_id,
        request.reason,
        request.immediate
    )
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/subscriptions/expiring", summary="Get Expiring Subscriptions")
async def admin_get_expiring_subscriptions(admin_user_id: str, days: int = 7):
    """Get subscriptions expiring within the specified number of days"""
    result = admin_service.get_expiring_subscriptions(admin_user_id, days)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ==================== ADMIN NOTIFICATIONS ENDPOINT ====================

@app.get("/api/admin/notifications", summary="Get Admin Notifications")
async def admin_get_notifications(admin_user_id: str):
    """Get admin dashboard notifications (pending approvals, expiring subscriptions, etc.)"""
    result = admin_service.get_admin_notifications(admin_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ==================== REPORTS ENDPOINTS ====================

@app.get("/api/admin/reports/subscriptions", summary="Get Subscription Report")
async def admin_get_subscription_report(admin_user_id: str):
    """Get subscription statistics and MRR/ARR metrics"""
    result = admin_service.get_subscription_report(admin_user_id)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


@app.get("/api/admin/reports/revenue", summary="Get Revenue Report")
async def admin_get_revenue_report(admin_user_id: str, period: str = "month"):
    """Get revenue report with breakdown by plan and payment method"""
    result = admin_service.get_revenue_report(admin_user_id, period)
    if "error" in result:
        raise HTTPException(status_code=403 if "Access denied" in result["error"] else 500, detail=result["error"])
    return result


# ==================== USER BANK TRANSFER SUBMISSION ENDPOINT ====================

class SubmitBankTransferRequest(BaseModel):
    user_id: str
    plan: str
    amount: float
    billing_interval: str = "monthly"
    slip_url: Optional[str] = None
    reference: Optional[str] = None
    bank_name: Optional[str] = None


@app.post("/api/payments/bank-transfer/submit", summary="Submit Bank Transfer Payment")
async def submit_bank_transfer(request: SubmitBankTransferRequest):
    """Submit a bank transfer payment for admin approval"""
    result = admin_service.submit_bank_transfer(
        request.user_id,
        request.plan,
        request.amount,
        request.billing_interval,
        request.slip_url,
        request.reference,
        request.bank_name
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main_ai:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

