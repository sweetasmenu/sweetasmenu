'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Upload, FileText, Settings, Receipt, LayoutDashboard, LogOut } from 'lucide-react';
import { signOut } from '@/lib/supabase/auth';

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-6 h-6" />,
  },
  {
    href: '/upload',
    label: 'Upload',
    icon: <Upload className="w-6 h-6" />,
  },
  {
    href: '/menus',
    label: 'My Menu',
    icon: <FileText className="w-6 h-6" />,
  },
  {
    href: '/dashboard/order-summary',
    label: 'Orders',
    icon: <Receipt className="w-6 h-6" />,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: <Settings className="w-6 h-6" />,
  },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    // Clear user-specific localStorage to prevent data leaking
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('selected_restaurant_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('selected_restaurant_id');

    await signOut();
    router.push('/login');
  };

  // Don't show tab bar on login or public pages
  const hiddenPaths = [
    '/',
    '/login',
    '/restaurant',
    '/payment',
    '/order-status',
    '/pos',
    '/checkout',
    '/qr',
    '/pricing',
    '/admin',
    '/privacy',
    '/terms',
    '/refunds',
  ];

  // Check if current path starts with any hidden path
  // For '/', we need exact match; for others, use startsWith
  const shouldHide = hiddenPaths.some(path => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  });

  if (shouldHide) {
    return null;
  }

  // Check if Dashboard tab should be active
  const isDashboardActive = (href: string) => {
    if (href === '/dashboard') {
      // Dashboard is active only for exact /dashboard path
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-lg">
      <nav className="flex justify-around items-center h-18 max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const isActive = isDashboardActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors ${
                isActive
                  ? 'text-orange-500'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className={isActive ? 'text-orange-500' : 'text-gray-500'}>
                {tab.icon}
              </span>
              <span className={`text-sm mt-1 font-bold ${isActive ? 'text-orange-500' : 'text-gray-600'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors text-red-500 hover:text-red-600"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-sm mt-1 font-bold">Sign Out</span>
        </button>
      </nav>
    </div>
  );
}
