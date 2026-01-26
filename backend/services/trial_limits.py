"""
Trial Limits Service - จัดการข้อจำกัดสำหรับ Free Trial และ Subscription Plans
Updated to use Supabase for persistent storage

Updated pricing structure:
- Trial: 20 menus, 5 gen, 5 enhance
- Starter ($39): 30 menus, 30 gen, 30 enhance
- Professional ($89): Unlimited menus, 200 gen, 200 enhance
- Enterprise ($199): Unlimited menus, 500 gen, 500 enhance
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import os
from .user_role_service import user_role_service

# Import Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    supabase_client: Optional[Client] = None
    if SUPABASE_URL and SUPABASE_KEY:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️ TrialLimits: Failed to initialize Supabase client: {e}")
    supabase_client = None


class TrialLimitsService:
    """
    จัดการข้อจำกัดการใช้งานสำหรับ Free Trial (14 วัน) และ Subscription Plans

    Now uses Supabase for persistent storage instead of JSON file

    Limits สำหรับ Free Trial:
    - Menu Items: 20 รายการ
    - Image Generation: 5 ภาพ
    - Image Enhancement: 5 ภาพ
    """

    def __init__(self):
        self.supabase_client = supabase_client

        # Trial limits (14 days)
        self.TRIAL_DURATION_DAYS = 14
        self.TRIAL_MENU_ITEMS_LIMIT = 20  # 20 menu items for Free Trial
        self.TRIAL_IMAGE_GENERATION_LIMIT = 5  # 5 AI generations for Free Trial
        self.TRIAL_IMAGE_ENHANCEMENT_LIMIT = 5  # 5 enhancements for Free Trial

        # Subscription plan limits (per month)
        # Based on actual plans: Starter ($39), Professional ($89), Enterprise ($199)
        self.SUBSCRIPTION_LIMITS = {
            "starter": {
                "menu_items": 30,  # Max 30 menu items
                "image_generation": 30,  # 30 AI generations/month
                "image_enhancement": 30,  # 30 enhancements/month
            },
            "professional": {
                "menu_items": 999999,  # Unlimited menu items
                "image_generation": 200,  # 200 AI generations/month
                "image_enhancement": 200,  # 200 enhancements/month
            },
            "enterprise": {
                "menu_items": 999999,  # Unlimited menu items
                "image_generation": 500,  # 500 AI generations/month
                "image_enhancement": 500,  # 500 enhancements/month
            },
            # Legacy plan names (for backward compatibility)
            "standard": {  # Map to professional
                "menu_items": 999999,
                "image_generation": 200,
                "image_enhancement": 200,
            },
            "premium": {  # Map to enterprise
                "menu_items": 999999,
                "image_generation": 500,
                "image_enhancement": 500,
            },
            "pro": {  # Map to professional
                "menu_items": 999999,
                "image_generation": 200,
                "image_enhancement": 200,
            }
        }

    def _is_valid_uuid(self, uuid_string: str) -> bool:
        """Check if string is a valid UUID format"""
        import re
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        return bool(uuid_pattern.match(str(uuid_string)))

    def _get_usage_from_supabase(self, user_id: str) -> Dict[str, Any]:
        """Get usage data from Supabase user_profiles table"""
        if not self.supabase_client or not self._is_valid_uuid(user_id):
            return {
                "image_generation_count": 0,
                "image_enhancement_count": 0,
                "menu_items_count": 0,
                "usage_reset_date": None
            }

        try:
            result = self.supabase_client.table('user_profiles').select(
                'image_generation_count, image_enhancement_count, menu_items_count, '
                'usage_reset_date, trial_start_date, trial_end_date'
            ).eq('user_id', user_id).limit(1).execute()

            if result.data and len(result.data) > 0:
                data = result.data[0]

                # Check if we need to reset monthly counts (first of the month)
                usage_reset_date = data.get('usage_reset_date')
                now = datetime.now()

                # Reset counts if it's a new month
                if usage_reset_date:
                    if isinstance(usage_reset_date, str):
                        usage_reset_date = datetime.fromisoformat(usage_reset_date.replace('Z', '+00:00'))

                    # Check if we're in a new month
                    if usage_reset_date.month != now.month or usage_reset_date.year != now.year:
                        # Reset monthly counts
                        self._reset_monthly_counts(user_id)
                        return {
                            "image_generation_count": 0,
                            "image_enhancement_count": 0,
                            "menu_items_count": data.get('menu_items_count', 0),  # Don't reset menu items
                            "usage_reset_date": now.isoformat(),
                            "trial_start_date": data.get('trial_start_date'),
                            "trial_end_date": data.get('trial_end_date')
                        }

                return {
                    "image_generation_count": data.get('image_generation_count', 0) or 0,
                    "image_enhancement_count": data.get('image_enhancement_count', 0) or 0,
                    "menu_items_count": data.get('menu_items_count', 0) or 0,
                    "usage_reset_date": usage_reset_date,
                    "trial_start_date": data.get('trial_start_date'),
                    "trial_end_date": data.get('trial_end_date')
                }
        except Exception as e:
            print(f"❌ TrialLimits: Failed to get usage from Supabase: {e}")

        return {
            "image_generation_count": 0,
            "image_enhancement_count": 0,
            "menu_items_count": 0,
            "usage_reset_date": None
        }

    def _reset_monthly_counts(self, user_id: str):
        """Reset monthly usage counts (AI generation/enhancement)"""
        if not self.supabase_client or not self._is_valid_uuid(user_id):
            return

        try:
            self.supabase_client.table('user_profiles').update({
                'image_generation_count': 0,
                'image_enhancement_count': 0,
                'usage_reset_date': datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
            print(f"✅ TrialLimits: Reset monthly counts for user {user_id}")
        except Exception as e:
            print(f"❌ TrialLimits: Failed to reset monthly counts: {e}")

    def _update_usage_in_supabase(self, user_id: str, field: str, increment: int = 1) -> bool:
        """Update usage count in Supabase"""
        if not self.supabase_client or not self._is_valid_uuid(user_id):
            print(f"⚠️ TrialLimits: Cannot update usage - invalid user_id: {user_id}")
            return False

        try:
            # First get current value
            result = self.supabase_client.table('user_profiles').select(field).eq('user_id', user_id).limit(1).execute()

            if result.data and len(result.data) > 0:
                current_value = result.data[0].get(field, 0) or 0
                new_value = current_value + increment

                # Update the value
                self.supabase_client.table('user_profiles').update({
                    field: new_value,
                    'updated_at': datetime.now().isoformat()
                }).eq('user_id', user_id).execute()

                print(f"✅ TrialLimits: Updated {field} for user {user_id}: {current_value} → {new_value}")
                return True
            else:
                # User profile doesn't exist, create it with initial count
                print(f"⚠️ TrialLimits: User profile not found for {user_id}, creating...")
                self.supabase_client.table('user_profiles').insert({
                    'user_id': user_id,
                    field: increment,
                    'role': 'free_trial',
                    'trial_start_date': datetime.now().isoformat(),
                    'trial_end_date': (datetime.now() + timedelta(days=self.TRIAL_DURATION_DAYS)).isoformat(),
                    'usage_reset_date': datetime.now().isoformat()
                }).execute()
                return True

        except Exception as e:
            print(f"❌ TrialLimits: Failed to update usage in Supabase: {e}")
            import traceback
            traceback.print_exc()
            return False

    def initialize_user(self, user_id: str) -> Dict[str, Any]:
        """
        Initialize or ensure user exists in database

        Args:
            user_id: User ID

        Returns:
            User status dictionary
        """
        if not self.supabase_client or not self._is_valid_uuid(user_id):
            return self.get_user_status(user_id)

        try:
            # Check if user profile exists
            result = self.supabase_client.table('user_profiles').select('user_id').eq('user_id', user_id).limit(1).execute()

            if not result.data or len(result.data) == 0:
                # Create user profile with trial
                now = datetime.now()
                trial_end = now + timedelta(days=self.TRIAL_DURATION_DAYS)

                self.supabase_client.table('user_profiles').insert({
                    'user_id': user_id,
                    'role': 'free_trial',
                    'trial_start_date': now.isoformat(),
                    'trial_end_date': trial_end.isoformat(),
                    'image_generation_count': 0,
                    'image_enhancement_count': 0,
                    'menu_items_count': 0,
                    'usage_reset_date': now.isoformat()
                }).execute()
                print(f"✅ TrialLimits: Initialized new user {user_id}")
        except Exception as e:
            print(f"❌ TrialLimits: Failed to initialize user: {e}")

        return self.get_user_status(user_id)

    def get_user_status(self, user_id: str, user_role: str = None) -> Dict[str, Any]:
        """
        ดึงสถานะ trial ของ user

        Args:
            user_id: User ID
            user_role: Optional - pass role to avoid duplicate DB call

        Returns:
            Dictionary with user status and limits
        """
        # ⚡ OPTIMIZED: Use passed role if available, otherwise fetch
        if user_role is None:
            user_role = user_role_service.get_user_role(user_id)

        # Map role to subscription plan
        role_to_plan = {
            'free_trial': None,
            'starter': 'starter',
            'professional': 'professional',
            'enterprise': 'enterprise',
            'admin': 'enterprise'  # Admin gets enterprise features
        }

        plan_from_role = role_to_plan.get(user_role)
        is_subscribed = plan_from_role is not None

        # Get usage data from Supabase
        usage_data = self._get_usage_from_supabase(user_id)

        now = datetime.now()

        # Check if trial expired
        trial_end = usage_data.get('trial_end_date')
        if trial_end and isinstance(trial_end, str):
            try:
                trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            except:
                trial_end = None

        is_trial_active = (
            user_role == 'free_trial' and
            trial_end and
            now < trial_end
        )

        # Calculate trial days remaining
        trial_days_remaining = 0
        if trial_end and now < trial_end:
            trial_days_remaining = (trial_end - now).days

        # Build user_data dict for _get_limits_for_user
        user_data = {
            'is_subscribed': is_subscribed,
            'subscription_plan': plan_from_role
        }

        return {
            "user_id": user_id,
            "role": user_role,
            "is_subscribed": is_subscribed,
            "subscription_plan": plan_from_role,
            "is_trial_active": is_trial_active,
            "trial_start_date": usage_data.get('trial_start_date'),
            "trial_end_date": usage_data.get('trial_end_date'),
            "trial_days_remaining": trial_days_remaining,
            "menu_items_count": usage_data.get('menu_items_count', 0),
            "image_generation_count": usage_data.get('image_generation_count', 0),
            "image_enhancement_count": usage_data.get('image_enhancement_count', 0),
            "limits": self._get_limits_for_user(user_data)
        }

    def check_limit(self, user_id: str, action: str) -> Dict[str, Any]:
        """
        ตรวจสอบว่ายังสามารถใช้งานได้หรือไม่

        Args:
            user_id: User ID
            action: 'menu_items', 'image_generation', หรือ 'image_enhancement'

        Returns:
            Dictionary with:
            - allowed: bool
            - remaining: int
            - limit: int
            - message: str
        """
        # Check if user is admin - admins have unlimited access
        if user_role_service.is_admin(user_id):
            return {
                "allowed": True,
                "remaining": 999999,
                "limit": 999999,
                "message": "Unlimited access (Admin)"
            }

        status = self.get_user_status(user_id)

        # Subscribed users have limits based on their plan
        if status['is_subscribed']:
            plan = status.get('subscription_plan', 'starter')
            # Map legacy plan names to new names
            plan_mapping = {
                'pro': 'professional',
                'standard': 'professional',
                'premium': 'enterprise'
            }
            plan = plan_mapping.get(plan, plan)
            plan_limits = self.SUBSCRIPTION_LIMITS.get(plan, self.SUBSCRIPTION_LIMITS['starter'])

            limit = plan_limits.get(action, 0)
            count_key = f"{action}_count"
            count = status.get(count_key, 0)

            # Check if feature is not available in plan (limit = 0)
            if limit == 0:
                action_name = {
                    'menu_items': 'Menu Items',
                    'image_generation': 'Image Generation',
                    'image_enhancement': 'Image Enhancement',
                }.get(action, action)

                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": 0,
                    "message": f"{action_name} is not available in {plan.title()} plan. Please upgrade to Professional or Enterprise plan."
                }

            # Check if limit is unlimited
            if limit == float('inf') or limit == -1 or limit >= 999999:
                return {
                    "allowed": True,
                    "remaining": 999999,
                    "limit": 999999,
                    "message": f"Unlimited access (Plan: {plan.title()})"
                }

            remaining = max(0, limit - count)
            allowed = remaining > 0

            if not allowed:
                action_name = {
                    'menu_items': 'Menu Items',
                    'image_generation': 'Image Generation',
                    'image_enhancement': 'Image Enhancement',
                }.get(action, action)

                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": limit,
                    "message": f"Plan limit reached for {action_name}. You've used {limit}/{limit} this month. Please upgrade your plan to continue."
                }

            return {
                "allowed": True,
                "remaining": remaining,
                "limit": limit,
                "message": f"OK. {remaining}/{limit} remaining this month."
            }

        # Free trial users
        if status['is_trial_active']:
            trial_limits = {
                'menu_items': self.TRIAL_MENU_ITEMS_LIMIT,
                'image_generation': self.TRIAL_IMAGE_GENERATION_LIMIT,
                'image_enhancement': self.TRIAL_IMAGE_ENHANCEMENT_LIMIT
            }

            limit = trial_limits.get(action, 0)
            count_key = f"{action}_count"
            count = status.get(count_key, 0)
            remaining = max(0, limit - count)
            allowed = remaining > 0

            if not allowed:
                action_name = {
                    'menu_items': 'Menu Items',
                    'image_generation': 'Image Generation',
                    'image_enhancement': 'Image Enhancement',
                }.get(action, action)

                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": limit,
                    "message": f"Trial limit reached for {action_name}. Upgrade to continue using this feature."
                }

            return {
                "allowed": True,
                "remaining": remaining,
                "limit": limit,
                "message": f"Trial: {remaining}/{limit} remaining"
            }

        # Trial expired
        return {
            "allowed": False,
            "remaining": 0,
            "limit": 0,
            "message": "Your trial has expired. Please subscribe to continue."
        }

    def increment_usage(self, user_id: str, action: str) -> Dict[str, Any]:
        """
        เพิ่มจำนวนการใช้งาน - Now saves to Supabase

        Args:
            user_id: User ID
            action: 'menu_items', 'image_generation', หรือ 'image_enhancement'

        Returns:
            Updated user status
        """
        field_mapping = {
            'menu_items': 'menu_items_count',
            'image_generation': 'image_generation_count',
            'image_enhancement': 'image_enhancement_count'
        }

        field = field_mapping.get(action)
        if field:
            self._update_usage_in_supabase(user_id, field, 1)

        return self.get_user_status(user_id)

    def set_subscription(self, user_id: str, plan: str, is_subscribed: bool = True):
        """
        ตั้งค่าสถานะ subscription - Updates in Supabase via user_role_service

        Args:
            user_id: User ID
            plan: Subscription plan name
            is_subscribed: Whether user is subscribed
        """
        # This is now handled by Stripe webhooks and user_role_service
        # Keeping this method for backward compatibility
        pass

    def reset_trial(self, user_id: str):
        """
        Reset trial สำหรับ user (สำหรับ admin/testing)

        Args:
            user_id: User ID
        """
        if not self.supabase_client or not self._is_valid_uuid(user_id):
            return

        try:
            now = datetime.now()
            trial_end = now + timedelta(days=self.TRIAL_DURATION_DAYS)

            self.supabase_client.table('user_profiles').update({
                'role': 'free_trial',
                'trial_start_date': now.isoformat(),
                'trial_end_date': trial_end.isoformat(),
                'image_generation_count': 0,
                'image_enhancement_count': 0,
                'menu_items_count': 0,
                'usage_reset_date': now.isoformat()
            }).eq('user_id', user_id).execute()
            print(f"✅ TrialLimits: Reset trial for user {user_id}")
        except Exception as e:
            print(f"❌ TrialLimits: Failed to reset trial: {e}")

    def _get_limits_for_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        ดึง limits ตาม subscription plan

        Args:
            user_data: User data dictionary

        Returns:
            Dictionary with limits for each action
        """
        if user_data.get('is_subscribed'):
            plan = user_data.get('subscription_plan', 'starter')
            # Map legacy plan names to new names
            plan_mapping = {
                'pro': 'professional',
                'standard': 'professional',
                'premium': 'enterprise'
            }
            plan = plan_mapping.get(plan, plan)
            plan_limits = self.SUBSCRIPTION_LIMITS.get(plan, self.SUBSCRIPTION_LIMITS['starter'])
            return {
                "menu_items": plan_limits.get('menu_items', 0),
                "image_generation": plan_limits.get('image_generation', 0),
                "image_enhancement": plan_limits.get('image_enhancement', 0),
            }
        else:
            return {
                "menu_items": self.TRIAL_MENU_ITEMS_LIMIT,
                "image_generation": self.TRIAL_IMAGE_GENERATION_LIMIT,
                "image_enhancement": self.TRIAL_IMAGE_ENHANCEMENT_LIMIT,
            }


# Create singleton instance
trial_limits_service = TrialLimitsService()
