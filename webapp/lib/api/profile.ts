/**
 * Profile API Client
 * Helper functions for user profile and billing management
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface Restaurant {
  restaurant_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string | null;
  theme_color: string;
  cover_image_url: string | null;
}

export interface Subscription {
  plan: string;
  status: string;
  is_subscribed: boolean;
  trial_days_remaining: number;
  current_period_end: string | null;
  next_billing_date: string | null;
  cancel_at_period_end: boolean;
}

export interface UserProfile {
  user_id: string;
  restaurant: Restaurant;
  subscription: Subscription;
}

export interface UpdateProfileData {
  restaurant_id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  theme_color?: string;
  user_id: string;
}

/**
 * Get user profile
 */
export async function getUserProfile(
  userId: string,
  restaurantId?: string
): Promise<UserProfile> {
  const params = new URLSearchParams({ user_id: userId });
  if (restaurantId) {
    params.append('restaurant_id', restaurantId);
  }

  const response = await fetch(`${BACKEND_URL}/api/user/profile?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to load profile');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to load profile');
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  data: UpdateProfileData
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail?.message || result.detail || 'Failed to update profile');
  }

  return result;
}

/**
 * Cancel Stripe subscription (at end of billing period)
 */
export async function cancelSubscription(userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${BACKEND_URL}/api/billing/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.detail?.message || data.message || 'Failed to cancel subscription');
  }

  return data;
}

/**
 * Create Stripe Checkout Session
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  planId: string,
  interval: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; session_id: string }> {
  const response = await fetch(`${BACKEND_URL}/api/billing/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      user_email: email,
      plan_id: planId,
      interval,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.detail?.message || data.message || 'Failed to create checkout session');
  }

  return data;
}

/**
 * Create Stripe Customer Portal Session
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const response = await fetch(`${BACKEND_URL}/api/billing/create-portal-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      return_url: returnUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.detail?.message || data.message || 'Failed to create portal session');
  }

  return data;
}

/**
 * Upload logo
 */
export async function uploadLogo(
  restaurantId: string,
  file: File,
  userId: string
): Promise<string> {
  const formData = new FormData();
  formData.append('restaurant_id', restaurantId);
  formData.append('file', file);
  formData.append('user_id', userId);

  const response = await fetch(`${BACKEND_URL}/api/customization/cover-image`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail?.message || data.detail || 'Failed to upload logo');
  }

  return data.cover_image_url;
}

/**
 * Upload banner (Premium only)
 */
export async function uploadBanner(
  restaurantId: string,
  file: File,
  userId: string
): Promise<string> {
  const formData = new FormData();
  formData.append('restaurant_id', restaurantId);
  formData.append('file', file);
  formData.append('user_id', userId);

  const response = await fetch(`${BACKEND_URL}/api/customization/cover-image`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail?.message || data.detail || 'Failed to upload banner');
  }

  return data.cover_image_url;
}

