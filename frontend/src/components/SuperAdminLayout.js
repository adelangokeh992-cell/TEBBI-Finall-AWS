import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, Users, CreditCard, Shield, Database,
  Settings, LogOut, Menu, Globe, Stethoscope,
  Sun, Moon, ChevronRight, BarChart3, X, 
  LayoutDashboard, Bell, Search, HelpCircle
} from 'lucide-react';

const SuperAdminLayout = () => {
  const { user, logout, t, language, toggleLanguage, isRTL } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { path: '/super-admin', icon: LayoutDashboard, label: t('نظرة عامة', 'Overview'), end: true },
    { path: '/super-admin/clinics', icon: Building2, label: t('العيادات والمشافي', 'Clinics & Hospitals') },
    { path: '/super-admin/doctors', icon: Stethoscope, label: t('الأطباء', 'Doctors') },
    { path: '/super-admin/subscriptions', icon: CreditCard, label: t('الاشتراكات', 'Subscriptions') },
    { path: '/super-admin/permissions', icon: Shield, label: t('الصلاحيات', 'Permissions') },
    { path: '/super-admin/backup', icon: Database, label: t('النسخ الاحتياطي', 'Backup') },
    { path: '/super-admin/settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  const currentPage = navItems.find(item => 
    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)
  );

  return (
    <div className={`min-h-screen bg-[#0a0a0f] ${isRTL ? 'rtl' : 'ltr'}`} data-testid="super-admin-layout">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-72 z-50 transform transition-all duration-300 ease-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
      } lg:transform-none`}>
        {/* Sidebar Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#12121a] via-[#0f0f17] to-[#0a0a0f] border-e border-white/5" />
        
        {/* Sidebar Content */}
        <div className="relative h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#12121a]" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">Tebbi</h1>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{t('لوحة الإدارة', 'Admin Panel')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-400 hover:text-white hover:bg-white/5"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">{t('القائمة الرئيسية', 'Main Menu')}</p>
            {navItems.map((item) => {
              const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path) && (item.end || location.pathname !== '/super-admin');
              const isExactActive = location.pathname === item.path;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isExactActive
                      ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/10 text-white border border-violet-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.path.split('/').pop() || 'overview'}`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    isExactActive 
                      ? 'bg-violet-500/20 text-violet-400' 
                      : 'bg-white/5 text-slate-500 group-hover:text-slate-300 group-hover:bg-white/10'
                  }`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">{item.label}</span>
                  {isExactActive && (
                    <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''} ms-auto text-violet-400`} />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Section at Bottom */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm">
              <Avatar className="h-10 w-10 border-2 border-violet-500/30">
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-purple-600 text-white font-bold">
                  {user?.name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-slate-500 truncate">{t('مدير النظام', 'Super Admin')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                onClick={handleLogout}
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={isRTL ? 'lg:mr-72 min-h-screen' : 'lg:ml-72 min-h-screen'} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-slate-400 hover:text-white hover:bg-white/10"
                onClick={() => setSidebarOpen(true)}
                data-testid="mobile-menu-btn"
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              {/* Breadcrumb / Page Title */}
              <div>
                <h2 className="text-xl font-bold text-white">
                  {currentPage?.label || t('لوحة التحكم', 'Dashboard')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('إدارة منصة طبي الطبية', 'Manage Tebbi Medical Platform')}
                </p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Search Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl hidden sm:flex"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* Language Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleLanguage}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
                data-testid="lang-toggle"
              >
                <Globe className="w-5 h-5" />
              </Button>

              {/* Theme Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleDarkMode}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full" />
              </Button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 hover:bg-white/10 rounded-xl ms-2" data-testid="user-menu">
                    <Avatar className="h-8 w-8 border border-violet-500/30">
                      <AvatarFallback className="bg-gradient-to-br from-violet-600 to-purple-600 text-white text-sm font-bold">
                        {user?.name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-slate-300 text-sm font-medium">{user?.name || 'Admin'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-[#1a1a24] border-white/10 text-slate-300">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="font-semibold text-white">{user?.name || 'Admin'}</p>
                    <p className="text-xs text-slate-500">{user?.email || 'admin@tebbi.com'}</p>
                  </div>
                  <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">
                    <Settings className="w-4 h-4 me-2" />
                    {t('الإعدادات', 'Settings')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">
                    <HelpCircle className="w-4 h-4 me-2" />
                    {t('المساعدة', 'Help')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuItem onClick={handleLogout} className="hover:bg-red-500/10 text-red-400 cursor-pointer">
                    <LogOut className="w-4 h-4 me-2" />
                    {t('تسجيل الخروج', 'Logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
