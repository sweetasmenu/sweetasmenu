"""
Stripe Subscription Service for SaaS Billing
Handles Checkout Sessions, Customer Portal, Webhooks, and Subscription lifecycle.
Order card payments remain in stripe_service.py.
"""

import os
import stripe
from typing import Dict, Any, Optional
from datetime import datetime

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY', '')

# Price ID mapping from env vars
STRIPE_PRICE_IDS = {
    'basic': {
        'monthly': os.getenv('STRIPE_PRICE_STARTER_MONTHLY', ''),
        'yearly': os.getenv('STRIPE_PRICE_STARTER_YEARLY', ''),
    },
    'pro': {
        'monthly': os.getenv('STRIPE_PRICE_PROFESSIONAL_MONTHLY', ''),
        'yearly': os.getenv('STRIPE_PRICE_PROFESSIONAL_YEARLY', ''),
    },
    'enterprise': {
        'monthly': os.getenv('STRIPE_PRICE_ENTERPRISE_MONTHLY', ''),
        'yearly': os.getenv('STRIPE_PRICE_ENTERPRISE_YEARLY', ''),
    },
}

PLAN_TO_ROLE = {
    'basic': 'starter',
    'pro': 'professional',
    'enterprise': 'enterprise',
}


class StripeSubscriptionService:
    """Service for handling Stripe SaaS subscription billing."""

    def __init__(self):
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.webhook_secret = os.getenv('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET', '')
        if not self.api_key:
            print("WARNING: STRIPE_SECRET_KEY not found. Subscription features will not work.")
        else:
            stripe.api_key = self.api_key

    def get_or_create_customer(
        self,
        supabase_client,
        user_id: str,
        email: str,
        name: Optional[str] = None,
    ) -> str:
        """
        Find existing Stripe Customer from user_profiles or create a new one.
        Returns the Stripe Customer ID.
        """
        # Check if user already has a stripe_customer_id
        profile = supabase_client.table('user_profiles').select(
            'stripe_customer_id'
        ).eq('user_id', user_id).single().execute()

        existing_id = profile.data.get('stripe_customer_id') if profile.data else None

        if existing_id:
            return existing_id

        # Create new Stripe Customer
        customer = stripe.Customer.create(
            email=email,
            name=name or email,
            metadata={'user_id': user_id},
        )

        # Save to user_profiles
        supabase_client.table('user_profiles').update({
            'stripe_customer_id': customer.id,
            'updated_at': datetime.now().isoformat(),
        }).eq('user_id', user_id).execute()

        return customer.id

    def create_checkout_session(
        self,
        customer_id: str,
        price_id: str,
        user_id: str,
        plan_id: str,
        interval: str,
        success_url: str,
        cancel_url: str,
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout Session in subscription mode.
        Returns dict with session id and url.
        """
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode='subscription',
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=cancel_url,
            metadata={
                'user_id': user_id,
                'plan_id': plan_id,
                'interval': interval,
            },
            subscription_data={
                'metadata': {
                    'user_id': user_id,
                    'plan_id': plan_id,
                    'interval': interval,
                },
            },
        )

        return {
            'session_id': session.id,
            'url': session.url,
        }

    def create_portal_session(
        self,
        customer_id: str,
        return_url: str,
    ) -> Dict[str, Any]:
        """
        Create a Stripe Billing Portal Session for self-service management.
        Returns dict with portal url.
        """
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

        return {
            'url': session.url,
        }

    def cancel_subscription(
        self,
        subscription_id: str,
    ) -> Dict[str, Any]:
        """
        Cancel subscription at period end (not immediately).
        """
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )

        return {
            'status': subscription.status,
            'cancel_at_period_end': subscription.cancel_at_period_end,
            'current_period_end': datetime.fromtimestamp(
                subscription.current_period_end
            ).isoformat() if subscription.current_period_end else None,
        }

    def handle_webhook_event(
        self,
        payload: bytes,
        sig_header: str,
        supabase_client,
    ) -> Dict[str, Any]:
        """
        Process Stripe webhook events for subscription lifecycle.
        """
        # Read webhook secret fresh from env (not cached) to avoid init-order issues
        webhook_secret = os.getenv('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET', '') or self.webhook_secret

        if not webhook_secret:
            print("ERROR: STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is not set")
            raise Exception("Webhook secret not configured")

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        except (stripe.SignatureVerificationError if hasattr(stripe, 'SignatureVerificationError') else stripe.error.SignatureVerificationError) as e:
            print(f"Webhook signature verification failed: {str(e)}")
            print(f"Secret length: {len(webhook_secret)}, sig_header present: {bool(sig_header)}, payload length: {len(payload)}")
            raise Exception(f"Invalid webhook signature: {str(e)}")

        event_type = event['type']
        data = event['data']['object']

        print(f"Stripe subscription webhook: {event_type}")

        if event_type == 'checkout.session.completed':
            self._handle_checkout_completed(data, supabase_client)

        elif event_type == 'customer.subscription.updated':
            self._handle_subscription_updated(data, supabase_client)

        elif event_type == 'customer.subscription.deleted':
            self._handle_subscription_deleted(data, supabase_client)

        elif event_type == 'invoice.payment_failed':
            self._handle_payment_failed(data, supabase_client)

        return {'received': True, 'type': event_type}

    def _handle_checkout_completed(self, session, supabase_client):
        """Handle checkout.session.completed — activate subscription."""
        user_id = session.get('metadata', {}).get('user_id')
        plan_id = session.get('metadata', {}).get('plan_id', 'pro')
        interval = session.get('metadata', {}).get('interval', 'monthly')
        subscription_id = session.get('subscription')
        customer_id = session.get('customer')

        if not user_id:
            print("Webhook error: no user_id in checkout session metadata")
            return

        new_role = PLAN_TO_ROLE.get(plan_id, 'professional')
        now = datetime.now()

        # Get subscription details for period end
        current_period_end = None
        if subscription_id:
            try:
                sub = stripe.Subscription.retrieve(subscription_id)
                current_period_end = datetime.fromtimestamp(
                    sub.current_period_end
                ).isoformat() if sub.current_period_end else None
            except Exception as e:
                print(f"Failed to retrieve subscription details: {e}")

        update_data = {
            'role': new_role,
            'plan': plan_id,
            'subscription_status': 'active',
            'billing_interval': interval,
            'subscription_start_date': now.isoformat(),
            'subscription_end_date': current_period_end,
            'next_billing_date': current_period_end,
            'stripe_subscription_id': subscription_id,
            'stripe_customer_id': customer_id,
            'billing_provider': 'stripe',
            'cancel_at_period_end': False,
            'updated_at': now.isoformat(),
        }

        supabase_client.table('user_profiles').update(
            update_data
        ).eq('user_id', user_id).execute()

        print(f"Activated subscription for user {user_id}: {plan_id}/{interval} via Stripe")

    def _handle_subscription_updated(self, subscription, supabase_client):
        """Handle customer.subscription.updated — sync status changes."""
        user_id = subscription.get('metadata', {}).get('user_id')
        if not user_id:
            # Try to find user by stripe_customer_id
            customer_id = subscription.get('customer')
            if customer_id:
                result = supabase_client.table('user_profiles').select(
                    'user_id'
                ).eq('stripe_customer_id', customer_id).execute()
                if result.data:
                    user_id = result.data[0]['user_id']

        if not user_id:
            print("Webhook error: cannot identify user for subscription update")
            return

        plan_id = subscription.get('metadata', {}).get('plan_id')
        interval = subscription.get('metadata', {}).get('interval')
        status = subscription.get('status')  # active, past_due, canceled, etc.
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)

        current_period_end = None
        if subscription.get('current_period_end'):
            current_period_end = datetime.fromtimestamp(
                subscription['current_period_end']
            ).isoformat()

        update_data = {
            'subscription_status': status,
            'cancel_at_period_end': cancel_at_period_end,
            'subscription_end_date': current_period_end,
            'next_billing_date': current_period_end,
            'updated_at': datetime.now().isoformat(),
        }

        # Update plan/role if changed
        if plan_id:
            new_role = PLAN_TO_ROLE.get(plan_id, 'professional')
            update_data['plan'] = plan_id
            update_data['role'] = new_role
            if interval:
                update_data['billing_interval'] = interval

        supabase_client.table('user_profiles').update(
            update_data
        ).eq('user_id', user_id).execute()

        print(f"Updated subscription for user {user_id}: status={status}, cancel_at_period_end={cancel_at_period_end}")

    def _handle_subscription_deleted(self, subscription, supabase_client):
        """Handle customer.subscription.deleted — downgrade to free."""
        user_id = subscription.get('metadata', {}).get('user_id')
        if not user_id:
            customer_id = subscription.get('customer')
            if customer_id:
                result = supabase_client.table('user_profiles').select(
                    'user_id'
                ).eq('stripe_customer_id', customer_id).execute()
                if result.data:
                    user_id = result.data[0]['user_id']

        if not user_id:
            print("Webhook error: cannot identify user for subscription deletion")
            return

        now = datetime.now()
        supabase_client.table('user_profiles').update({
            'subscription_status': 'cancelled',
            'cancel_at_period_end': False,
            'role': 'free_trial',
            'plan': 'trial',
            'stripe_subscription_id': None,
            'updated_at': now.isoformat(),
        }).eq('user_id', user_id).execute()

        print(f"Subscription deleted for user {user_id} — downgraded to free")

    def _handle_payment_failed(self, invoice, supabase_client):
        """Handle invoice.payment_failed — mark subscription as past_due."""
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')

        if not customer_id:
            return

        result = supabase_client.table('user_profiles').select(
            'user_id'
        ).eq('stripe_customer_id', customer_id).execute()

        if not result.data:
            return

        user_id = result.data[0]['user_id']
        now = datetime.now()

        supabase_client.table('user_profiles').update({
            'subscription_status': 'past_due',
            'updated_at': now.isoformat(),
        }).eq('user_id', user_id).execute()

        print(f"Payment failed for user {user_id}, subscription {subscription_id}")


# Singleton instance
stripe_subscription_service = StripeSubscriptionService()
