"""
BlinkPay Service for Subscription Billing (NZ Open Banking)
Handles enduring consent creation, payment initiation, and consent management.
Stripe remains in use for customer order card payments.
"""

import os
import time
import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pathlib

# Load environment variables
env_path = pathlib.Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path))
else:
    load_dotenv()


class BlinkPayService:
    """Service for handling BlinkPay enduring consent and recurring payments."""

    def __init__(self):
        self.client_id = os.getenv('BLINKPAY_CLIENT_ID', '')
        self.client_secret = os.getenv('BLINKPAY_CLIENT_SECRET', '')
        self.api_url = os.getenv('BLINKPAY_API_URL', 'https://sandbox.debit.blinkpay.co.nz').rstrip('/')
        self.webhook_secret = os.getenv('BLINKPAY_WEBHOOK_SECRET', '')
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0

        if not self.client_id or not self.client_secret:
            print("WARNING: BLINKPAY_CLIENT_ID or BLINKPAY_CLIENT_SECRET not found. BlinkPay billing will not work.")
        else:
            print("BlinkPay Service initialized")

    @property
    def ready(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def _get_access_token(self) -> str:
        """Get OAuth2 access token using client credentials grant, with caching."""
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/oauth2/token",
                data={
                    'grant_type': 'client_credentials',
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data['access_token']
            self._token_expires_at = time.time() + data.get('expires_in', 3600)
            return self._access_token

    async def _make_request(self, method: str, path: str, json_data: dict = None) -> dict:
        """Make an authenticated request to the BlinkPay API."""
        token = await self._get_access_token()
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.api_url}{path}",
                json=json_data,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                },
                timeout=30.0,
            )
            response.raise_for_status()
            if response.content:
                return response.json()
            return {}

    async def create_enduring_consent(
        self,
        user_id: str,
        user_email: str,
        plan_id: str,
        amount: float,
        billing_interval: str,
        redirect_url: str,
    ) -> Dict[str, Any]:
        """
        Create an enduring consent for recurring subscription billing.
        Returns dict with consent_id and redirect_uri (bank login URL).
        """
        period = 'Yearly' if billing_interval == 'yearly' else 'Monthly'

        consent_data = {
            'flow': {
                'detail': {
                    'type': 'redirect',
                    'redirect_uri': redirect_url,
                }
            },
            'maximum_amount_period': {
                'currency': 'NZD',
                'total': f"{amount:.2f}",
                'period': period,
            },
            'from_timestamp': datetime.utcnow().isoformat() + 'Z',
            'expiry_timestamp': (datetime.utcnow() + timedelta(days=365 * 5)).isoformat() + 'Z',
            'pcr': {
                'particulars': f'SmartMenu-{plan_id}',
                'code': user_id[:12],
                'reference': f'Sub-{billing_interval}',
            },
        }

        result = await self._make_request('POST', '/payments/v1/enduring-consents', consent_data)

        return {
            'consent_id': result.get('consent_id'),
            'redirect_uri': result.get('redirect_uri'),
            'status': result.get('status'),
        }

    async def get_consent(self, consent_id: str) -> Dict[str, Any]:
        """Get enduring consent status."""
        return await self._make_request('GET', f'/payments/v1/enduring-consents/{consent_id}')

    async def revoke_consent(self, consent_id: str) -> Dict[str, Any]:
        """Revoke (cancel) an enduring consent."""
        return await self._make_request('DELETE', f'/payments/v1/enduring-consents/{consent_id}')

    async def create_payment(
        self,
        consent_id: str,
        amount: float,
        plan_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """Create a payment using an authorised enduring consent."""
        payment_data = {
            'consent_id': consent_id,
            'amount': {
                'currency': 'NZD',
                'total': f"{amount:.2f}",
            },
            'pcr': {
                'particulars': f'SmartMenu-{plan_id}',
                'code': user_id[:12],
                'reference': f'Billing-{datetime.utcnow().strftime("%Y%m")}',
            },
        }

        return await self._make_request('POST', '/payments/v1/payments', payment_data)

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Get payment status."""
        return await self._make_request('GET', f'/payments/v1/payments/{payment_id}')


# Singleton instance
blinkpay_service = BlinkPayService()
