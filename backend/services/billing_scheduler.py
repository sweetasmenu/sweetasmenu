"""
Billing Scheduler for BlinkPay Recurring Payments
BlinkPay does NOT auto-charge — we must initiate each payment when subscription is due.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any
from services.blinkpay_service import blinkpay_service


# Plan prices (NZD, GST-inclusive)
PLAN_PRICES = {
    'basic': {'monthly': 39.00, 'yearly': 390.00},
    'pro': {'monthly': 89.00, 'yearly': 890.00},
    'enterprise': {'monthly': 199.00, 'yearly': 1990.00},
}


async def process_due_subscriptions(supabase_client) -> Dict[str, Any]:
    """
    Find all active subscriptions with next_billing_date <= now,
    and charge them via BlinkPay enduring consent.

    Returns summary of processed, succeeded, and failed payments.
    """
    results = {
        'processed': 0,
        'succeeded': 0,
        'failed': 0,
        'errors': [],
    }

    if not blinkpay_service.ready:
        results['errors'].append('BlinkPay service not configured')
        return results

    now = datetime.utcnow()

    # Find due subscriptions
    try:
        response = (
            supabase_client.table('user_profiles')
            .select('user_id, plan, billing_interval, blinkpay_consent_id, next_billing_date, email')
            .eq('subscription_status', 'active')
            .eq('billing_provider', 'blinkpay')
            .not_.is_('blinkpay_consent_id', 'null')
            .lte('next_billing_date', now.isoformat())
            .execute()
        )
    except Exception as e:
        results['errors'].append(f'Failed to query due subscriptions: {e}')
        return results

    due_users = response.data or []
    results['processed'] = len(due_users)

    for user in due_users:
        user_id = user['user_id']
        plan = user.get('plan', 'pro')
        interval = user.get('billing_interval', 'monthly')
        consent_id = user['blinkpay_consent_id']

        price = PLAN_PRICES.get(plan, {}).get(interval)
        if not price:
            results['failed'] += 1
            results['errors'].append(f'Unknown plan/interval for user {user_id}: {plan}/{interval}')
            continue

        try:
            # Charge via BlinkPay
            payment_result = await blinkpay_service.create_payment(
                consent_id=consent_id,
                amount=price,
                plan_id=plan,
                user_id=user_id,
            )

            payment_id = payment_result.get('payment_id')

            # Calculate next billing date
            if interval == 'yearly':
                next_billing = now + timedelta(days=365)
            else:
                next_billing = now + timedelta(days=30)

            # Update user profile
            supabase_client.table('user_profiles').update({
                'next_billing_date': next_billing.isoformat(),
                'last_payment_date': now.isoformat(),
                'last_payment_amount': price,
                'updated_at': now.isoformat(),
            }).eq('user_id', user_id).execute()

            # Log payment
            try:
                supabase_client.table('payment_logs').insert({
                    'user_id': user_id,
                    'amount': price,
                    'currency': 'NZD',
                    'payment_type': 'subscription',
                    'payment_method': 'blinkpay',
                    'payment_status': 'completed',
                    'plan': plan,
                    'billing_interval': interval,
                    'blinkpay_consent_id': consent_id,
                    'blinkpay_payment_id': payment_id,
                }).execute()
            except Exception as log_err:
                print(f"Failed to log payment for {user_id}: {log_err}")

            results['succeeded'] += 1
            print(f"Billed user {user_id}: ${price} ({plan}/{interval})")

        except Exception as e:
            results['failed'] += 1
            results['errors'].append(f'Payment failed for user {user_id}: {str(e)}')
            print(f"Payment failed for user {user_id}: {e}")

            # Mark subscription as past_due after failure
            try:
                supabase_client.table('user_profiles').update({
                    'subscription_status': 'past_due',
                    'updated_at': now.isoformat(),
                }).eq('user_id', user_id).execute()
            except Exception:
                pass

    return results
