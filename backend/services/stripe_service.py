"""
Stripe Service for Order Card Payments
SaaS subscription billing is handled by stripe_subscription_service.py.
"""

import os
import stripe
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY', '')

class StripeService:
    """Service for handling Stripe order card payments"""

    def __init__(self):
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        if not self.api_key:
            print("WARNING: STRIPE_SECRET_KEY not found. Card payment features will not work.")
        else:
            stripe.api_key = self.api_key

    def create_payment_intent(
        self,
        amount: float,
        currency: str = 'nzd',
        order_id: str = None,
        restaurant_id: str = None,
        customer_email: str = None,
        description: str = None,
    ) -> Dict[str, Any]:
        """
        Create a Stripe Payment Intent for one-time order payments

        Args:
            amount: Amount in dollars (will be converted to cents)
            currency: Currency code (default: nzd)
            order_id: Order ID for metadata
            restaurant_id: Restaurant ID for metadata
            customer_email: Customer email (optional)
            description: Payment description

        Returns:
            Dictionary with client_secret and payment_intent_id
        """
        try:
            if not self.api_key:
                raise Exception("Stripe API key not configured")

            # Convert amount to cents
            amount_cents = int(amount * 100)

            # Build metadata
            metadata = {}
            if order_id:
                metadata['order_id'] = order_id
            if restaurant_id:
                metadata['restaurant_id'] = restaurant_id

            # Create Payment Intent parameters
            intent_params = {
                'amount': amount_cents,
                'currency': currency.lower(),
                'metadata': metadata,
                'automatic_payment_methods': {
                    'enabled': True,
                },
            }

            if description:
                intent_params['description'] = description

            if customer_email:
                intent_params['receipt_email'] = customer_email

            # Create the Payment Intent
            intent = stripe.PaymentIntent.create(**intent_params)

            return {
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id,
                'amount': amount,
                'currency': currency,
                'status': intent.status,
            }

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to create payment intent: {str(e)}")

    def retrieve_payment_intent(self, payment_intent_id: str, api_key: str = None) -> Dict[str, Any]:
        """
        Retrieve a Payment Intent to check its status

        Args:
            payment_intent_id: Stripe Payment Intent ID
            api_key: Optional Stripe API key (restaurant's key if PI was created with it)

        Returns:
            Dictionary with payment details
        """
        try:
            effective_key = api_key or self.api_key
            if not effective_key:
                raise Exception("Stripe API key not configured")

            intent = stripe.PaymentIntent.retrieve(payment_intent_id, api_key=effective_key)

            return {
                'payment_intent_id': intent.id,
                'status': intent.status,
                'amount': intent.amount / 100,  # Convert from cents
                'currency': intent.currency,
                'order_id': intent.metadata.get('order_id'),
                'restaurant_id': intent.metadata.get('restaurant_id'),
                'receipt_url': intent.charges.data[0].receipt_url if intent.charges.data else None,
                'paid': intent.status == 'succeeded',
            }

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to retrieve payment intent: {str(e)}")

    def confirm_payment(self, payment_intent_id: str, order_id: str = None, api_key: str = None) -> Dict[str, Any]:
        """
        Confirm/verify that a payment was successful

        Args:
            payment_intent_id: Stripe Payment Intent ID
            order_id: Order ID to verify (optional, for extra validation)
            api_key: Optional Stripe API key (restaurant's key if PI was created with it)

        Returns:
            Dictionary with verification result
        """
        try:
            effective_key = api_key or self.api_key
            if not effective_key:
                raise Exception("Stripe API key not configured")

            intent = stripe.PaymentIntent.retrieve(payment_intent_id, api_key=effective_key)

            # Verify order_id if provided (soft check - log warning but don't fail)
            stored_order_id = intent.metadata.get('order_id')
            if order_id and stored_order_id and stored_order_id != order_id:
                print(f"⚠️ Order ID mismatch: expected {order_id}, got {stored_order_id}")
                # Don't raise exception - proceed with confirmation if payment succeeded

            is_paid = intent.status == 'succeeded'

            return {
                'payment_intent_id': intent.id,
                'status': intent.status,
                'paid': is_paid,
                'amount': intent.amount / 100,
                'currency': intent.currency,
                'order_id': intent.metadata.get('order_id'),
                'restaurant_id': intent.metadata.get('restaurant_id'),
                'receipt_url': intent.charges.data[0].receipt_url if intent.charges.data else None,
                'paid_at': datetime.now().isoformat() if is_paid else None,
            }

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to confirm payment: {str(e)}")

    def create_refund(
        self,
        payment_intent_id: str,
        amount: float = None,
        reason: str = 'requested_by_customer'
    ) -> Dict[str, Any]:
        """
        Create a refund for a payment

        Args:
            payment_intent_id: Stripe Payment Intent ID
            amount: Refund amount in dollars (None for full refund)
            reason: Refund reason (duplicate, fraudulent, requested_by_customer)

        Returns:
            Dictionary with refund details
        """
        try:
            if not self.api_key:
                raise Exception("Stripe API key not configured")

            refund_params = {
                'payment_intent': payment_intent_id,
                'reason': reason,
            }

            if amount:
                refund_params['amount'] = int(amount * 100)  # Convert to cents

            refund = stripe.Refund.create(**refund_params)

            return {
                'refund_id': refund.id,
                'status': refund.status,
                'amount': refund.amount / 100,
                'currency': refund.currency,
                'payment_intent_id': payment_intent_id,
            }

        except stripe.error.StripeError as e:
            raise Exception(f"Stripe error: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to create refund: {str(e)}")

    def construct_webhook_event(self, payload: bytes, sig_header: str) -> Any:
        """
        Construct and verify a Stripe webhook event

        Args:
            payload: Request body as bytes
            sig_header: Stripe-Signature header

        Returns:
            Verified Stripe Event object
        """
        try:
            webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
            if not webhook_secret:
                raise Exception("Stripe webhook secret not configured")

            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            return event

        except stripe.error.SignatureVerificationError as e:
            raise Exception(f"Invalid webhook signature: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to construct webhook event: {str(e)}")



# Create a singleton instance
stripe_service = StripeService()

