'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Users, ChefHat, DollarSign, LogOut, Clock,
  Volume2, VolumeX
} from 'lucide-react';
import { POSLanguage } from '@/lib/pos-translations';
import { getThemeClasses, POSTheme } from '@/lib/pos-theme';

interface POSSession {
  staffId: string;
  staffName: string;
  role: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  primaryLanguage?: string;
  expires: number;
}

interface POSNavbarProps {
  session: POSSession;
  currentTime?: Date;
  lang?: POSLanguage;
  theme?: POSTheme;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  showSoundControls?: boolean;
}

export default function POSNavbar({
  session,
  currentTime = new Date(),
  lang = 'th',
  theme = 'orange',
  soundEnabled,
  onSoundToggle,
  volume,
  onVolumeChange,
  showSoundControls = false
}: POSNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const themeClasses = getThemeClasses(theme);

  const handleLogout = () => {
    localStorage.removeItem('pos_session');
    router.push('/pos/login');
  };

  // Define nav items with role-based access
  const navItems = [
    {
      href: '/pos/orders',
      icon: Users,
      labelTh: 'ออเดอร์',
      labelEn: 'Orders',
      roles: ['owner', 'manager', 'waiter', 'chef', 'cashier']
    },
    {
      href: '/pos/kitchen',
      icon: ChefHat,
      labelTh: 'ครัว',
      labelEn: 'Kitchen',
      roles: ['owner', 'manager', 'chef', 'waiter']
    },
    {
      href: '/pos/cashier',
      icon: DollarSign,
      labelTh: 'แคชเชียร์',
      labelEn: 'Cashier',
      roles: ['owner', 'manager', 'cashier']
    }
  ];

  // Filter nav items based on role
  const visibleNavItems = navItems.filter(item =>
    item.roles.includes(session.role)
  );

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between px-2 md:px-4 py-2 gap-1 md:gap-2">
        {/* Left side - Restaurant info */}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          <div className={`${themeClasses.textPrimary} font-bold text-sm md:text-lg truncate max-w-[100px] md:max-w-none`}>
            {session.restaurantName}
          </div>
          <span className="text-slate-400 text-xs md:text-sm hidden sm:inline whitespace-nowrap">
            {session.staffName} ({session.role})
          </span>
        </div>

        {/* Center - Navigation */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-lg transition-all text-xs md:text-sm whitespace-nowrap ${
                  isActive
                    ? `${themeClasses.bgPrimary} text-white`
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                <span className="hidden sm:inline">
                  {lang === 'th' ? item.labelTh : item.labelEn}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          {/* Clock */}
          <div className={`text-base md:text-xl font-mono ${themeClasses.textPrimary} hidden sm:block whitespace-nowrap`}>
            {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Sound Controls - optional */}
          {showSoundControls && onSoundToggle && (
            <>
              <button
                onClick={onSoundToggle}
                className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                  soundEnabled ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 md:w-5 md:h-5" /> : <VolumeX className="w-4 h-4 md:w-5 md:h-5" />}
              </button>

              {soundEnabled && onVolumeChange && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume || 70}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-16 md:w-20 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 hidden md:block"
                />
              )}
            </>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden md:inline text-sm">
              {lang === 'th' ? 'ออก' : 'Logout'}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
