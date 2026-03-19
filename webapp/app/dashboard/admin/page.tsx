'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CreditCard, Tag, Activity, Shield, Bell,
  Search, ArrowLeft, Loader2, DollarSign, Clock,
  Building, TrendingUp, AlertCircle, ChevronRight,
  Calendar, Mail, Phone, MapPin, Store, Eye,
  CheckCircle, XCircle, X, Edit, Trash2, Plus,
  RefreshCw, Download, Filter, Save, ToggleLeft,
  ToggleRight, AlertTriangle, ChevronDown
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  adminTranslations,
  t,
  formatDate,
  formatCurrency,
  getStatusColor,
  getPlanColor,
  AdminLanguage
} from '@/lib/admin-translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  restaurant_name: string;
  role: string;
  subscription_status: string;
  plan: string;
  billing_interval: string;
  trial_start_date: string;
  trial_end_date: string;
  subscription_start_date: string;
  subscription_end_date: string;
  next_billing_date: string;
  payment_method: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
  admin_notes: string;
  restaurants?: any[];
  branch_count?: number;
  total_orders?: number;
  total_revenue?: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  cancel_at_period_end?: boolean;
  max_branches?: number;
}

interface PendingPayment {
  id: string;
  user_id: string;
  user_email?: string;
  restaurant_name?: string;
  amount: number;
  plan: string;
  billing_interval: string;
  payment_method: string;
  payment_status: string;
  bank_transfer_slip_url?: string;
  bank_transfer_reference?: string;
  bank_name?: string;
  created_at: string;
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  usage_limit: number | null;
  usage_count: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applies_to: string;
  created_at: string;
}

interface AdminNotification {
  type: string;
  title: string;
  message: string;
  count: number;
  priority: string;
  link: string;
}

interface ExpiringSubscription {
  user_id: string;
  email: string;
  restaurant_name: string;
  plan: string;
  role: string;
  subscription_status: string;
  subscription_end_date: string;
  trial_end_date: string;
  days_remaining: number;
}

interface ActivityLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string;
  target_email?: string;
  details: string;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_restaurants: number;
  total_orders: number;
  total_revenue: number;
  pending_approvals: number;
  active_subscriptions: number;
  expiring_soon: number;
  mrr: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth state
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [lang, setLang] = useState<AdminLanguage>('en');

  // Data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<ExpiringSubscription[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_users: 0,
    total_restaurants: 0,
    total_orders: 0,
    total_revenue: 0,
    pending_approvals: 0,
    active_subscriptions: 0,
    expiring_soon: 0,
    mrr: 0
  });

  // UI states
  const [activeTab, setActiveTab] = useState<'customers' | 'payments' | 'coupons' | 'logs'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Filter states
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  // Subscription action modals
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login');
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('role, user_id')
        .or(`user_id.eq.${user.id},id.eq.${user.id}`);

      const profile = profiles?.[0];

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setIsAdmin(true);
      setAdminUserId(user.id);
      await loadAllData(user.id);
    } catch (error) {
      console.error('Admin access check failed:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (userId: string) => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadStats(userId),
        loadUsers(userId),
        loadPendingPayments(userId),
        loadCoupons(userId),
        loadNotifications(userId),
        loadExpiringSubscriptions(userId),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadStats = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/overview?admin_user_id=${userId}`);
      const data = await response.json();
      if (data.success && data.stats) {
        setStats({
          total_users: data.stats.total_users || 0,
          total_restaurants: data.stats.total_restaurants || 0,
          total_orders: data.stats.total_orders || 0,
          total_revenue: data.stats.total_revenue || 0,
          pending_approvals: 0,
          active_subscriptions: data.stats.subscription_distribution?.active || 0,
          expiring_soon: 0,
          mrr: 0
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUsers = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/list?admin_user_id=${userId}&limit=200`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadPendingPayments = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/payments/pending?admin_user_id=${userId}`);
      const data = await response.json();
      if (data.success) {
        setPendingPayments(data.payments || []);
        setStats(prev => ({ ...prev, pending_approvals: data.count || 0 }));
      }
    } catch (error) {
      console.error('Failed to load pending payments:', error);
    }
  };

  const loadCoupons = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/coupons/list?admin_user_id=${userId}&limit=100`);
      const data = await response.json();
      if (data.success) {
        setCoupons(data.coupons || []);
      }
    } catch (error) {
      console.error('Failed to load coupons:', error);
    }
  };

  const loadNotifications = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/notifications?admin_user_id=${userId}`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadExpiringSubscriptions = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/subscriptions/expiring?admin_user_id=${userId}&days=14`);
      const data = await response.json();
      if (data.success) {
        const expiring = data.subscriptions || [];
        setExpiringSubscriptions(expiring);
        setStats(prev => ({ ...prev, expiring_soon: expiring.length }));
      }
    } catch (error) {
      console.error('Failed to load expiring subscriptions:', error);
    }
  };

  const loadActivityLogs = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/logs?admin_user_id=${userId}&limit=50`);
      const data = await response.json();
      if (data.success) {
        setActivityLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    if (!window.confirm(t('approval.confirmApprove', lang))) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/payments/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          payment_log_id: paymentId,
          notes: approvalNotes
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.paymentApproved', lang));
        setSelectedPayment(null);
        setApprovalNotes('');
        await loadAllData(adminUserId);
      } else {
        alert(data.error || 'Failed to approve payment');
      }
    } catch (error) {
      console.error('Failed to approve payment:', error);
      alert('Failed to approve payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    if (!window.confirm(t('approval.confirmReject', lang))) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/payments/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          payment_log_id: paymentId,
          reason: rejectionReason
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.paymentRejected', lang));
        setSelectedPayment(null);
        setRejectionReason('');
        await loadAllData(adminUserId);
      } else {
        alert(data.error || 'Failed to reject payment');
      }
    } catch (error) {
      console.error('Failed to reject payment:', error);
      alert('Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewUserDetail = async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}?admin_user_id=${adminUserId}`);
      const data = await response.json();
      if (data.success && data.user) {
        setSelectedUser(data.user);
        setEditForm(data.user);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to load user detail:', error);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm(lang === 'th' ? 'ยืนยันการบันทึก?' : 'Confirm save?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          target_user_id: selectedUser.user_id,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          country: editForm.country,
          role: editForm.role,
          plan: editForm.plan,
          subscription_status: editForm.subscription_status,
          billing_interval: editForm.billing_interval,
          is_active: editForm.is_active,
          admin_notes: editForm.admin_notes,
          payment_method: editForm.payment_method,
          subscription_start_date: editForm.subscription_start_date,
          subscription_end_date: editForm.subscription_end_date,
          next_billing_date: editForm.next_billing_date,
          max_branches: editForm.max_branches,
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('editUser.userUpdated', lang));
        setSelectedUser({ ...selectedUser, ...editForm } as UserProfile);
        setEditMode(false);
        await loadAllData(adminUserId);
      } else {
        alert(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      alert('Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm(t('messages.confirmDelete', lang))) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/coupons/${couponId}?admin_user_id=${adminUserId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.couponDeleted', lang));
        await loadCoupons(adminUserId);
      } else {
        alert(data.error || 'Failed to delete coupon');
      }
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      alert('Failed to delete coupon');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter & sort logic
  const filteredUsers = users
    .filter(u => {
      const matchSearch = searchTerm === '' ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.restaurant_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchStatus = filterStatus === 'all' || u.subscription_status === filterStatus;
      const matchPayment = filterPaymentMethod === 'all' || u.payment_method === filterPaymentMethod;
      return matchSearch && matchRole && matchStatus && matchPayment;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.restaurant_name || a.email || '').localeCompare(b.restaurant_name || b.email || '');
      }
      if (sortBy === 'next_billing') {
        const dateA = a.next_billing_date ? new Date(a.next_billing_date).getTime() : Infinity;
        const dateB = b.next_billing_date ? new Date(b.next_billing_date).getTime() : Infinity;
        return dateA - dateB;
      }
      // Default: created_at desc
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const filteredCoupons = coupons.filter(c =>
    c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getExpiryUrgencyColor = (daysLeft: number) => {
    if (daysLeft <= 0) return 'bg-red-100 border-red-300 text-red-800';
    if (daysLeft <= 3) return 'bg-red-50 border-red-200 text-red-700';
    if (daysLeft <= 7) return 'bg-orange-50 border-orange-200 text-orange-700';
    return 'bg-yellow-50 border-yellow-200 text-yellow-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('messages.loading', lang)}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield className="w-7 h-7" />
                  {t('dashboard.title', lang)}
                </h1>
                <p className="text-purple-200 text-sm">{t('dashboard.welcome', lang)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Language Toggle */}
              <button
                onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
                className="px-3 py-1 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
              >
                {lang === 'en' ? 'TH' : 'EN'}
              </button>
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors relative"
                >
                  <Bell className="w-6 h-6" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                      {notifications.reduce((sum, n) => sum + n.count, 0)}
                    </span>
                  )}
                </button>
                {/* Notification Dropdown */}
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm">{t('notifications.title', lang)}</h3>
                        <span className="text-xs text-gray-500">{notifications.length} {lang === 'th' ? 'รายการ' : 'items'}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-gray-400 text-sm">
                            {t('messages.noData', lang)}
                          </div>
                        ) : (
                          notifications.map((n, i) => (
                            <div
                              key={i}
                              className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                                n.priority === 'high' ? 'bg-orange-50/50' : ''
                              }`}
                              onClick={() => {
                                setShowNotifications(false);
                                if (n.type === 'pending_payments' || n.type === 'payment') {
                                  setActiveTab('payments');
                                } else if (n.type === 'expiring_trials' || n.type === 'expiring_subscriptions') {
                                  // Scroll to expiring section
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                } else {
                                  setActiveTab('customers');
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  n.priority === 'high' ? 'bg-red-100' : 'bg-blue-100'
                                }`}>
                                  {n.priority === 'high' ? (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                  ) : (
                                    <Bell className="w-4 h-4 text-blue-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                                  {n.count > 0 && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                      {n.count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Refresh */}
              <button
                onClick={() => loadAllData(adminUserId)}
                disabled={refreshing}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 -mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('stats.totalUsers', lang)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('stats.monthlyRevenue', lang)}</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_revenue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow" onClick={() => setActiveTab('payments')}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center relative">
                <AlertCircle className="w-6 h-6 text-orange-600" />
                {stats.pending_approvals > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    {stats.pending_approvals}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('stats.pendingApprovals', lang)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending_approvals}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('stats.activeSubscriptions', lang)}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_subscriptions}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Subscriptions Warning Banner */}
      {expiringSubscriptions.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <h3 className="font-semibold text-orange-800">
                {t('expiring.title', lang)} ({expiringSubscriptions.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {expiringSubscriptions.map((sub, i) => {
                const daysLeft = sub.days_remaining ?? Math.ceil(
                  (new Date(sub.subscription_end_date || sub.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${getExpiryUrgencyColor(daysLeft)}`}
                    onClick={() => handleViewUserDetail(sub.user_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/50 rounded-full flex items-center justify-center text-sm font-bold">
                        {(sub.restaurant_name || sub.email || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sub.restaurant_name || sub.email}</p>
                        <p className="text-xs opacity-75">{sub.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPlanColor(sub.plan || sub.role)}`}>
                        {t(`plans.${sub.plan || sub.role || 'free_trial'}`, lang)}
                      </span>
                      <p className="text-xs font-semibold mt-1">
                        {daysLeft <= 0
                          ? t('expiring.expired', lang)
                          : daysLeft === 0
                            ? t('expiring.expiresToday', lang)
                            : `${daysLeft} ${t('expiring.daysLeft', lang)}`
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Banner */}
      {notifications.filter(n => n.priority === 'high').length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <div className="flex-1">
                {notifications.filter(n => n.priority === 'high').map((n, i) => (
                  <span key={i} className="text-orange-800">
                    {n.message}
                    {i < notifications.filter(n => n.priority === 'high').length - 1 && ' | '}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setActiveTab('payments')}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                {t('actions.viewAll', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'customers'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users className="w-5 h-5" />
                {t('tabs.customers', lang)} ({users.length})
              </button>
              <button
                onClick={() => { setActiveTab('payments'); setSearchTerm(''); }}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'payments'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                {t('tabs.payments', lang)}
                {stats.pending_approvals > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                    {stats.pending_approvals}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('coupons'); setSearchTerm(''); }}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'coupons'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Tag className="w-5 h-5" />
                {t('tabs.coupons', lang)} ({coupons.length})
              </button>
              <button
                onClick={() => { setActiveTab('logs'); setSearchTerm(''); loadActivityLogs(adminUserId); }}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'logs'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Activity className="w-5 h-5" />
                {t('tabs.activityLogs', lang)}
              </button>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`${t('actions.search', lang)}...`}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              {activeTab === 'customers' && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    showFilters ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  {t('actions.filter', lang)}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              )}
              {activeTab === 'coupons' && (
                <button
                  onClick={() => { setEditingCoupon(null); setShowCouponModal(true); }}
                  className="px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {t('actions.createCoupon', lang)}
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            {activeTab === 'customers' && showFilters && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('filters.allRoles', lang)}</label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="all">{t('filters.allRoles', lang)}</option>
                    <option value="free_trial">{t('plans.free_trial', lang)}</option>
                    <option value="starter">{t('plans.starter', lang)}</option>
                    <option value="professional">{t('plans.professional', lang)}</option>
                    <option value="enterprise">{t('plans.enterprise', lang)}</option>
                    <option value="admin">{t('plans.admin', lang)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('filters.allStatuses', lang)}</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="all">{t('filters.allStatuses', lang)}</option>
                    <option value="trial">{t('subscriptionStatus.trial', lang)}</option>
                    <option value="active">{t('subscriptionStatus.active', lang)}</option>
                    <option value="expired">{t('subscriptionStatus.expired', lang)}</option>
                    <option value="cancelled">{t('subscriptionStatus.cancelled', lang)}</option>
                    <option value="pending_payment">{t('subscriptionStatus.pending_payment', lang)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('filters.allPaymentMethods', lang)}</label>
                  <select
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="all">{t('filters.allPaymentMethods', lang)}</option>
                    <option value="stripe">{t('paymentMethods.stripe', lang)}</option>
                    <option value="bank_transfer">{t('paymentMethods.bank_transfer', lang)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('filters.sortBy', lang)}</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="created_at">{t('filters.sortCreatedAt', lang)}</option>
                    <option value="name">{t('filters.sortName', lang)}</option>
                    <option value="next_billing">{t('filters.sortNextBilling', lang)}</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="p-6">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">{t('messages.noData', lang)}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => {
                    // Check if this user is expiring soon
                    const isExpiring = expiringSubscriptions.some(e => e.user_id === user.user_id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleViewUserDetail(user.user_id)}
                        className={`bg-gray-50 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all border ${
                          isExpiring ? 'border-orange-300 bg-orange-50/50' : 'border-gray-100 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                              user.is_active === false ? 'bg-gray-200 text-gray-500' : 'bg-purple-200 text-purple-700'
                            }`}>
                              {user.restaurant_name?.charAt(0) || user.email?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 line-clamp-1">
                                {user.restaurant_name || user.email || 'No Name'}
                              </p>
                              <p className="text-sm text-gray-500 line-clamp-1">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {isExpiring && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(user.plan || user.role)}`}>
                            {t(`plans.${user.plan || user.role || 'free_trial'}`, lang)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.subscription_status || 'trial')}`}>
                            {t(`subscriptionStatus.${user.subscription_status || 'trial'}`, lang)}
                          </span>
                          {user.is_active === false && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              {t('editUser.inactive', lang)}
                            </span>
                          )}
                          {user.cancel_at_period_end && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              Cancelling
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3 h-3" />
                            <span>{user.payment_method ? t(`paymentMethods.${user.payment_method}`, lang) : '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>{t('customer.nextBillingDate', lang)}: {user.next_billing_date ? formatDate(user.next_billing_date, lang) : '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="w-3 h-3" />
                            <span>{user.branch_count || user.restaurants?.length || 0} {t('customer.branchCount', lang)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                {t('approval.pendingTitle', lang)} ({pendingPayments.length})
              </h3>
              {pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p>{t('messages.noData', lang)}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-orange-50 border border-orange-200 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{payment.restaurant_name || payment.user_email}</p>
                            <p className="text-sm text-gray-600">{payment.user_email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPlanColor(payment.plan)}`}>
                                {t(`plans.${payment.plan}`, lang)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {payment.billing_interval === 'yearly' ? 'Yearly' : 'Monthly'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-600">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-gray-500">{formatDate(payment.created_at, lang)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          {payment.bank_name && <span className="mr-3">Bank: {payment.bank_name}</span>}
                          {payment.bank_transfer_reference && <span>Ref: {payment.bank_transfer_reference}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.bank_transfer_slip_url && (
                            <a
                              href={payment.bank_transfer_slip_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                              {t('approval.slipImage', lang)}
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                          >
                            {t('actions.view', lang)}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Coupons Tab */}
          {activeTab === 'coupons' && (
            <div className="p-6">
              {filteredCoupons.length === 0 ? (
                <div className="text-center py-12 text-gray-500">{t('messages.noData', lang)}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCoupons.map((coupon) => (
                    <div key={coupon.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-mono text-lg font-bold text-purple-600">{coupon.code}</p>
                          <p className="text-sm text-gray-600">{coupon.name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-gray-900">
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}%`
                            : formatCurrency(coupon.discount_value)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {coupon.discount_type === 'percentage' ? t('coupon.percentage', lang) : t('coupon.fixedAmount', lang)}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>{t('coupon.usageCount', lang)}: {coupon.usage_count} / {coupon.usage_limit || t('coupon.unlimited', lang)}</p>
                        <p>{t('coupon.endDate', lang)}: {coupon.end_date ? formatDate(coupon.end_date, lang) : '-'}</p>
                        <p>{t('coupon.appliesTo', lang)}: {coupon.applies_to || 'All'}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => { setEditingCoupon(coupon); setShowCouponModal(true); }}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          {t('actions.edit', lang)}
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          disabled={actionLoading}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Logs Tab */}
          {activeTab === 'logs' && (
            <div className="p-6">
              {activityLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>{t('activityLogs.noLogs', lang)}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Activity className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{log.action}</span>
                          {log.target_email && (
                            <span className="text-xs text-gray-500">
                              → {log.target_email}
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-sm text-gray-600 line-clamp-2">{log.details}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(log.created_at, lang)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Detail Modal - Enhanced with Edit Mode */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedUser(null); setEditMode(false); }}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {editMode ? t('editUser.title', lang) : t('customer.restaurantName', lang)}
              </h2>
              <div className="flex items-center gap-2">
                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (!editMode) {
                      setEditForm({ ...selectedUser });
                    }
                    setEditMode(!editMode);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    editMode ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Edit className="w-4 h-4" />
                  {editMode ? t('editUser.editMode', lang) : t('editUser.viewMode', lang)}
                </button>
                <button onClick={() => { setSelectedUser(null); setEditMode(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-purple-200 rounded-full flex items-center justify-center text-2xl font-bold text-purple-700">
                    {selectedUser.restaurant_name?.charAt(0) || selectedUser.email?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedUser.restaurant_name || 'No Name'}</h3>
                    <p className="text-gray-600">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(selectedUser.plan || selectedUser.role)}`}>
                        {t(`plans.${selectedUser.plan || selectedUser.role || 'free_trial'}`, lang)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedUser.subscription_status || 'trial')}`}>
                        {t(`subscriptionStatus.${selectedUser.subscription_status || 'trial'}`, lang)}
                      </span>
                      {selectedUser.is_active === false && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {t('editUser.inactive', lang)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-600" />
                  {t('editUser.contactInfo', lang)}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.email', lang)}</label>
                    {editMode ? (
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{selectedUser.email || '-'}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.phone', lang)}</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{selectedUser.phone || '-'}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.address', lang)}</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{selectedUser.address || '-'}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.city', lang)}</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editForm.city || ''}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{selectedUser.city || '-'}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.country', lang)}</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editForm.country || ''}
                        onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{selectedUser.country || '-'}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm text-gray-500 mb-1 block">{t('customer.branchCount', lang)}</label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{selectedUser.branch_count || 0}</p>
                      <span className="text-gray-400">/</span>
                      <p className="font-medium text-gray-900">{selectedUser.max_branches || 1}</p>
                      <span className="text-xs text-gray-500">{lang === 'th' ? 'สาขาที่ใช้ / สูงสุด' : 'used / max'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Status */}
              {editMode && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">{t('editUser.accountStatus', lang)}</h4>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        editForm.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {editForm.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      {editForm.is_active ? t('editUser.active', lang) : t('editUser.inactive', lang)}
                    </button>
                  </div>
                </div>
              )}

              {/* Role/Plan Selection */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  {lang === 'th' ? 'Role / แพคเกจ' : 'Role / Plan'}
                </h4>
                {editMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select
                        value={editForm.role || 'free_trial'}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="free_trial">Free Trial</option>
                        <option value="starter">Starter ($39/mo)</option>
                        <option value="professional">Professional ($89/mo)</option>
                        <option value="enterprise">Enterprise ($199/mo)</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('customer.plan', lang)}</label>
                      <select
                        value={editForm.plan || 'free_trial'}
                        onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="free_trial">Free Trial</option>
                        <option value="basic">Starter (Basic)</option>
                        <option value="pro">Professional (Pro)</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('customer.status', lang)}</label>
                      <select
                        value={editForm.subscription_status || 'trial'}
                        onChange={(e) => setEditForm({ ...editForm, subscription_status: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="pending_payment">Pending Payment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.billingInterval', lang)}</label>
                      <select
                        value={editForm.billing_interval || 'monthly'}
                        onChange={(e) => setEditForm({ ...editForm, billing_interval: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="monthly">{t('subscriptionActions.monthly', lang)}</option>
                        <option value="yearly">{t('subscriptionActions.yearly', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('customer.paymentMethod', lang)}</label>
                      <select
                        value={editForm.payment_method || ''}
                        onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="">-</option>
                        <option value="stripe">{t('paymentMethods.stripe', lang)}</option>
                        <option value="bank_transfer">{t('paymentMethods.bank_transfer', lang)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {lang === 'th' ? 'จำนวนสาขาสูงสุด' : 'Max Branches'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={editForm.max_branches || 1}
                          onChange={(e) => setEditForm({ ...editForm, max_branches: Math.max(1, Math.min(999, parseInt(e.target.value) || 1)) })}
                          className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {lang === 'th' ? `ใช้แล้ว ${selectedUser.branch_count || 0}` : `${selectedUser.branch_count || 0} used`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {lang === 'th' ? 'กำหนดจำนวนสาขาที่ user สามารถสร้างได้' : 'Set how many branches this user can create'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Role</p>
                      <p className="font-medium">{selectedUser.role || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('customer.plan', lang)}</p>
                      <p className="font-medium">{t(`plans.${selectedUser.plan || 'free_trial'}`, lang)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('customer.paymentMethod', lang)}</p>
                      <p className="font-medium">{selectedUser.payment_method ? t(`paymentMethods.${selectedUser.payment_method}`, lang) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('subscriptionActions.billingInterval', lang)}</p>
                      <p className="font-medium">{selectedUser.billing_interval || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{lang === 'th' ? 'สาขาสูงสุด' : 'Max Branches'}</p>
                      <p className="font-medium">{selectedUser.max_branches || 1}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Subscription Dates */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  {t('editUser.subscriptionInfo', lang)}
                </h4>
                {editMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('customer.trialEndsAt', lang)}</label>
                      <p className="font-medium text-gray-900 text-sm">
                        {selectedUser.trial_end_date ? formatDate(selectedUser.trial_end_date, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Subscription Start</label>
                      <input
                        type="date"
                        value={editForm.subscription_start_date?.split('T')[0] || ''}
                        onChange={(e) => setEditForm({ ...editForm, subscription_start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Subscription End</label>
                      <input
                        type="date"
                        value={editForm.subscription_end_date?.split('T')[0] || ''}
                        onChange={(e) => setEditForm({ ...editForm, subscription_end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('customer.nextBillingDate', lang)}</label>
                      <input
                        type="date"
                        value={editForm.next_billing_date?.split('T')[0] || ''}
                        onChange={(e) => setEditForm({ ...editForm, next_billing_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.trialEndsAt', lang)}</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.trial_end_date ? formatDate(selectedUser.trial_end_date, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Subscription Start</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.subscription_start_date ? formatDate(selectedUser.subscription_start_date, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Subscription End</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.subscription_end_date ? formatDate(selectedUser.subscription_end_date, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.nextBillingDate', lang)}</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.next_billing_date ? formatDate(selectedUser.next_billing_date, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.createdAt', lang)}</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.created_at ? formatDate(selectedUser.created_at, lang) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.lastLogin', lang)}</p>
                      <p className="font-medium text-gray-900">
                        {selectedUser.last_login_at ? formatDate(selectedUser.last_login_at, lang) : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">{t('customer.adminNotes', lang)}</h4>
                {editMode ? (
                  <textarea
                    value={editForm.admin_notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                    placeholder={lang === 'th' ? 'เพิ่มหมายเหตุสำหรับ admin...' : 'Add admin notes...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-gray-600">{selectedUser.admin_notes || '-'}</p>
                )}
              </div>

              {/* Stats */}
              {(selectedUser.total_orders !== undefined || selectedUser.total_revenue !== undefined) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.totalOrders', lang)}</p>
                      <p className="font-medium text-gray-900">{selectedUser.total_orders || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('customer.totalRevenue', lang)}</p>
                      <p className="font-medium text-gray-900">{formatCurrency(selectedUser.total_revenue || 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stripe Info */}
              {(selectedUser.stripe_customer_id || selectedUser.stripe_subscription_id) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Stripe Info</h4>
                  <div className="text-sm space-y-2">
                    {selectedUser.stripe_customer_id && (
                      <div>
                        <span className="text-gray-500">Customer ID: </span>
                        <span className="font-mono text-xs text-gray-700">{selectedUser.stripe_customer_id}</span>
                      </div>
                    )}
                    {selectedUser.stripe_subscription_id && (
                      <div>
                        <span className="text-gray-500">Subscription ID: </span>
                        <span className="font-mono text-xs text-gray-700">{selectedUser.stripe_subscription_id}</span>
                      </div>
                    )}
                    {selectedUser.cancel_at_period_end && (
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Cancelling at period end</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {editMode ? (
                  <button
                    onClick={handleSaveUser}
                    disabled={actionLoading}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('editUser.saveChanges', lang)}
                  </button>
                ) : (
                  <>
                    {/* Subscription Actions */}
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setShowExtendModal(true)}
                        className="px-4 py-3 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Clock className="w-4 h-4" />
                        {t('actions.extendSubscription', lang)}
                      </button>
                      <button
                        onClick={() => setShowChangePlanModal(true)}
                        className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <TrendingUp className="w-4 h-4" />
                        {t('actions.changePlan', lang)}
                      </button>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="px-4 py-3 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        {t('actions.cancelSubscription', lang)}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedUser && (
        <ExtendSubscriptionModal
          lang={lang}
          adminUserId={adminUserId}
          targetUserId={selectedUser.user_id}
          userName={selectedUser.restaurant_name || selectedUser.email || ''}
          onClose={() => setShowExtendModal(false)}
          onSuccess={() => {
            setShowExtendModal(false);
            handleViewUserDetail(selectedUser.user_id);
            loadAllData(adminUserId);
          }}
        />
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && selectedUser && (
        <ChangePlanModal
          lang={lang}
          adminUserId={adminUserId}
          targetUserId={selectedUser.user_id}
          userName={selectedUser.restaurant_name || selectedUser.email || ''}
          currentPlan={selectedUser.plan}
          onClose={() => setShowChangePlanModal(false)}
          onSuccess={() => {
            setShowChangePlanModal(false);
            handleViewUserDetail(selectedUser.user_id);
            loadAllData(adminUserId);
          }}
        />
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && selectedUser && (
        <CancelSubscriptionModal
          lang={lang}
          adminUserId={adminUserId}
          targetUserId={selectedUser.user_id}
          userName={selectedUser.restaurant_name || selectedUser.email || ''}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            handleViewUserDetail(selectedUser.user_id);
            loadAllData(adminUserId);
          }}
        />
      )}

      {/* Payment Approval Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPayment(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('approval.pendingTitle', lang)}</h2>
              <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Payment Info */}
              <div className="bg-orange-50 rounded-xl p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600 mb-2">{formatCurrency(selectedPayment.amount)}</p>
                  <p className="text-gray-600">{selectedPayment.restaurant_name || selectedPayment.user_email}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(selectedPayment.plan)}`}>
                      {t(`plans.${selectedPayment.plan}`, lang)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedPayment.billing_interval === 'yearly' ? 'Yearly' : 'Monthly'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">{t('approval.bankName', lang)}</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">Bank:</span> {selectedPayment.bank_name || '-'}</p>
                  <p><span className="text-gray-500">Reference:</span> {selectedPayment.bank_transfer_reference || '-'}</p>
                  <p><span className="text-gray-500">Submitted:</span> {formatDate(selectedPayment.created_at, lang)}</p>
                </div>
              </div>

              {/* Slip Image */}
              {selectedPayment.bank_transfer_slip_url && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">{t('approval.slipImage', lang)}</h4>
                  <a
                    href={selectedPayment.bank_transfer_slip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={selectedPayment.bank_transfer_slip_url}
                      alt="Payment Slip"
                      className="w-full rounded-lg border border-gray-200"
                    />
                  </a>
                </div>
              )}

              {/* Approval Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('approval.approvalNotes', lang)}</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('approval.rejectionReason', lang)}</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Required if rejecting..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRejectPayment(selectedPayment.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  {t('approval.reject', lang)}
                </button>
                <button
                  onClick={() => handleApprovePayment(selectedPayment.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {t('approval.approve', lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Modal */}
      {showCouponModal && (
        <CouponModal
          coupon={editingCoupon}
          lang={lang}
          adminUserId={adminUserId}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }}
          onSave={() => { setShowCouponModal(false); setEditingCoupon(null); loadCoupons(adminUserId); }}
        />
      )}
    </div>
  );
}

// ===== Extend Subscription Modal =====
function ExtendSubscriptionModal({
  lang, adminUserId, targetUserId, userName, onClose, onSuccess
}: {
  lang: AdminLanguage; adminUserId: string; targetUserId: string; userName: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!window.confirm(t('subscriptionActions.confirmExtend', lang))) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/subscriptions/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          target_user_id: targetUserId,
          extension_days: days,
          reason
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.subscriptionExtended', lang));
        onSuccess();
      } else {
        alert(data.error || 'Failed to extend subscription');
      }
    } catch (error) {
      alert('Failed to extend subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{t('subscriptionActions.extendTitle', lang)}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{userName}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.extendDays', lang)}</label>
            <div className="flex items-center gap-2">
              {[7, 14, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    days === d ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 0)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.extendReason', lang)}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              {t('actions.cancel', lang)}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || days <= 0}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
              {t('actions.extendSubscription', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Change Plan Modal =====
function ChangePlanModal({
  lang, adminUserId, targetUserId, userName, currentPlan, onClose, onSuccess
}: {
  lang: AdminLanguage; adminUserId: string; targetUserId: string; userName: string; currentPlan: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [newPlan, setNewPlan] = useState(currentPlan || 'basic');
  const [interval, setInterval] = useState('monthly');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!window.confirm(t('subscriptionActions.confirmChangePlan', lang))) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/subscriptions/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          target_user_id: targetUserId,
          new_plan: newPlan,
          billing_interval: interval,
          reason
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.planChanged', lang));
        onSuccess();
      } else {
        alert(data.error || 'Failed to change plan');
      }
    } catch (error) {
      alert('Failed to change plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{t('subscriptionActions.changePlanTitle', lang)}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{userName}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.newPlan', lang)}</label>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            >
              <option value="free_trial">Free Trial</option>
              <option value="basic">Starter ($39/mo)</option>
              <option value="pro">Professional ($89/mo)</option>
              <option value="enterprise">Enterprise ($199/mo)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.billingInterval', lang)}</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setInterval('monthly')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  interval === 'monthly' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('subscriptionActions.monthly', lang)}
              </button>
              <button
                onClick={() => setInterval('yearly')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  interval === 'yearly' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('subscriptionActions.yearly', lang)}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('subscriptionActions.extendReason', lang)}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              {t('actions.cancel', lang)}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
              {t('actions.changePlan', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Cancel Subscription Modal =====
function CancelSubscriptionModal({
  lang, adminUserId, targetUserId, userName, onClose, onSuccess
}: {
  lang: AdminLanguage; adminUserId: string; targetUserId: string; userName: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [immediate, setImmediate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!window.confirm(t('subscriptionActions.confirmCancel', lang))) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/subscriptions/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_user_id: adminUserId,
          target_user_id: targetUserId,
          reason,
          immediate
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(t('messages.subscriptionCancelled', lang));
        onSuccess();
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      alert('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-red-600">{t('subscriptionActions.cancelTitle', lang)}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <p className="font-medium text-sm">{userName}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('subscriptionActions.cancelReason', lang)}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImmediate(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !immediate ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {t('subscriptionActions.cancelAtPeriodEnd', lang)}
            </button>
            <button
              onClick={() => setImmediate(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                immediate ? 'bg-red-100 text-red-700 border-2 border-red-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {t('subscriptionActions.cancelImmediate', lang)}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              {t('actions.cancel', lang)}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
              {t('actions.cancelSubscription', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Coupon Modal Component =====
function CouponModal({
  coupon,
  lang,
  adminUserId,
  onClose,
  onSave
}: {
  coupon: Coupon | null;
  lang: AdminLanguage;
  adminUserId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: coupon?.code || '',
    name: coupon?.name || '',
    description: coupon?.description || '',
    discount_type: coupon?.discount_type || 'percentage',
    discount_value: coupon?.discount_value || 10,
    usage_limit: coupon?.usage_limit || null,
    start_date: coupon?.start_date?.split('T')[0] || '',
    end_date: coupon?.end_date?.split('T')[0] || '',
    is_active: coupon?.is_active ?? true,
    applies_to: coupon?.applies_to || 'all'
  });

  const handleSubmit = async () => {
    if (!form.code || !form.name) {
      alert('Code and Name are required');
      return;
    }

    setLoading(true);
    try {
      const url = coupon
        ? `${API_URL}/api/admin/coupons/update`
        : `${API_URL}/api/admin/coupons/create`;

      const body = coupon
        ? { admin_user_id: adminUserId, coupon_id: coupon.id, ...form }
        : { admin_user_id: adminUserId, ...form };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        alert(coupon ? t('messages.couponUpdated', lang) : t('messages.couponCreated', lang));
        onSave();
      } else {
        alert(data.error || 'Failed to save coupon');
      }
    } catch (error) {
      console.error('Failed to save coupon:', error);
      alert('Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {coupon ? t('actions.edit', lang) : t('actions.createCoupon', lang)}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.code', lang)} *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="e.g. SAVE20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.name', lang)} *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.description', lang)}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.discountType', lang)}</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed_amount' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="percentage">{t('coupon.percentage', lang)}</option>
                <option value="fixed_amount">{t('coupon.fixedAmount', lang)}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.discountValue', lang)}</label>
              <input
                type="number"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.startDate', lang)}</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.endDate', lang)}</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.usageLimit', lang)}</label>
              <input
                type="number"
                value={form.usage_limit || ''}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                placeholder={t('coupon.unlimited', lang)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('coupon.appliesTo', lang)}</label>
              <select
                value={form.applies_to}
                onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                <option value="all">{lang === 'th' ? 'ทุกแพคเกจ' : 'All Plans'}</option>
                <option value="starter">{lang === 'th' ? 'Starter เท่านั้น' : 'Starter Only'}</option>
                <option value="professional">{lang === 'th' ? 'Professional เท่านั้น' : 'Professional Only'}</option>
                <option value="enterprise">{lang === 'th' ? 'Enterprise เท่านั้น' : 'Enterprise Only'}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
              {t('coupon.isActive', lang)}
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t('actions.cancel', lang)}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {t('actions.save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
