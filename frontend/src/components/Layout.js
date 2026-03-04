import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '../context/AuthContext';
import { NavLink, useNavigate, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  LayoutDashboard, Users, Calendar, Brain, FileText, 
  Calculator, Settings, LogOut, Menu, Globe, Stethoscope,
  Sun, Moon, ChevronDown, Building2, ExternalLink, Bell, KeyRound, Smartphone, ListOrdered, Pill, FileSignature, Megaphone, ScrollText
} from 'lucide-react';
import NotificationBell from './NotificationBell';

const Layout = () => {
  const { user, logout, logoutAll, t, language, toggleLanguage, isRTL } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Base nav items: كل عنصر مرتبط بميزة (feature) من الباكند
  const baseNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('لوحة التحكم', 'Dashboard'), feature: 'dashboard' },
    { path: '/patients', icon: Users, label: t('المرضى', 'Patients'), feature: 'patients' },
    { path: '/appointments', icon: Calendar, label: t('المواعيد', 'Appointments'), feature: 'appointments' },
    { path: '/queue', icon: ListOrdered, label: t('طابور الانتظار', 'Queue'), feature: 'queue' },
    { path: '/pharmacy', icon: Pill, label: t('الصيدلية', 'Pharmacy'), feature: 'pharmacy' },
    { path: '/consent', icon: FileSignature, label: t('الموافقات', 'Consent'), feature: 'consent' },
    { path: '/marketing', icon: Megaphone, label: t('التسويق', 'Marketing'), feature: 'marketing' },
    { path: '/audit-logs', icon: ScrollText, label: t('سجلات التدقيق', 'Audit logs'), feature: 'audit_logs' },
    { path: '/ai', icon: Brain, label: t('مساعد AI', 'AI Assistant'), feature: 'ai_analysis' },
    { path: '/billing', icon: FileText, label: t('الفواتير', 'Billing'), feature: 'invoices' },
    { path: '/accounting', icon: Calculator, label: t('المحاسبة', 'Accounting'), feature: 'invoices' },
  ];

  // تصفية القائمة حسب الميزات والصلاحيات (allowed_features من /auth/me)
  const allowedFeatures = user?.allowed_features || [];
  const isSuperAdmin = user?.role === 'super_admin';
  let navItems = (isSuperAdmin || allowedFeatures.length === 0)
    ? [...baseNavItems]
    : baseNavItems.filter((item) => allowedFeatures.includes(item.feature));

  // الموظفين ثم الإعدادات في آخر القائمة (للمستخدمين من العيادة)
  if (user?.company_id && user?.role !== 'super_admin') {
    navItems = [
      ...navItems,
      { path: '/clinic/settings', icon: Users, label: t('الموظفين', 'Staff') },
      { path: '/settings', icon: Settings, label: t('الإعدادات', 'Settings') },
    ];
  }

  // خريطة بادئة المسار -> الميزة (لحارس الصلاحية)
  const pathPrefixToFeature = [
    { prefix: '/dashboard', feature: 'dashboard' },
    { prefix: '/patients', feature: 'patients' },
    { prefix: '/appointments', feature: 'appointments' },
    { prefix: '/queue', feature: 'queue' },
    { prefix: '/pharmacy', feature: 'pharmacy' },
    { prefix: '/consent', feature: 'consent' },
    { prefix: '/marketing', feature: 'marketing' },
    { prefix: '/audit-logs', feature: 'audit_logs' },
    { prefix: '/ai', feature: 'ai_analysis' },
    { prefix: '/billing', feature: 'invoices' },
    { prefix: '/accounting', feature: 'invoices' },
    { prefix: '/clinic-admin', feature: 'dashboard' },
    { prefix: '/settings/notifications', feature: 'notifications' },
    { prefix: '/telemedicine', feature: 'appointments' },
  ];

  const location = useLocation();
  const pathname = location.pathname;
  const match = pathPrefixToFeature.find(({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/'));
  const featureForPath = match?.feature;
  const needsFeature = featureForPath && !isSuperAdmin && allowedFeatures.length > 0;
  const hasAccess = !needsFeature || allowedFeatures.includes(featureForPath);
  if (needsFeature && !hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect super_admin to their own panel
  if (user?.role === 'super_admin') {
    // Super admin has a separate layout at /super-admin
    navItems = [
      { path: '/super-admin', icon: Building2, label: t('لوحة المدير', 'Admin Panel'), external: true },
      ...navItems
    ];
  }

  const NavContent = () => (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`
          }
          end={item.path === '/'}
          data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
        >
          <item.icon className="w-5 h-5" />
          <span className="font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 ${isRTL ? 'font-arabic' : 'font-sans'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex fixed top-0 start-0 h-screen w-64 flex-col bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 z-50">
        {/* Logo */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-teal-700 dark:text-teal-400">Tebbi</h1>
              <p className="text-xs text-muted-foreground">{t('نظام طبي', 'Medical System')}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 overflow-y-auto">
          <NavContent />
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Avatar className="w-10 h-10 bg-teal-100 dark:bg-teal-900">
              <AvatarFallback className="bg-teal-600 text-white">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {language === 'ar' ? user?.name_ar || user?.name : user?.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ps-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Mobile Menu */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isRTL ? 'right' : 'left'} className="w-64 p-0">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-teal-700">Tebbi</h1>
                  </div>
                </div>
                <div className="p-4">
                  <NavContent />
                </div>
              </SheetContent>
            </Sheet>

            <div className="lg:hidden" />

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {(isSuperAdmin || allowedFeatures.includes('notifications')) && <NotificationBell />}
              {/* Language Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLanguage}
                data-testid="header-language-toggle"
              >
                <Globe className="w-5 h-5" />
              </Button>

              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                data-testid="dark-mode-toggle"
              >
                {(resolvedTheme || theme) === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2" data-testid="user-menu">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-teal-600 text-white text-sm">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">
                      {language === 'ar' ? user?.name_ar || user?.name : user?.name}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild className="gap-2">
                    <NavLink to="/settings/change-password">
                      <KeyRound className="w-4 h-4" />
                      {t('تغيير كلمة المرور', 'Change Password')}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="gap-2" 
                    onClick={handleLogoutAll}
                  >
                    <Smartphone className="w-4 h-4" />
                    {t('تسجيل خروج من جميع الأجهزة', 'Logout from all devices')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="gap-2 text-red-600" 
                    onClick={handleLogout}
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('تسجيل الخروج', 'Logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
