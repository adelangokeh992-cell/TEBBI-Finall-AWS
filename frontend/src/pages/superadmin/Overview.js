import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Users, Stethoscope, CreditCard, TrendingUp,
  CheckCircle, XCircle, Clock, AlertTriangle, ArrowUpRight,
  Calendar, Activity, ChevronRight, Sparkles, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../../components/common';

const SuperAdminOverview = () => {
  const { t, language, isRTL } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, companiesRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.listCompanies()
      ]);
      setStats(statsRes.data);
      const companies = companiesRes.data.companies || companiesRes.data || [];
      setRecentCompanies(Array.isArray(companies) ? companies.slice(0, 5) : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner className="min-h-[60vh]" />;
  }

  const statCards = [
    {
      title: t('العيادات', 'Clinics'),
      value: stats?.companies?.total || 0,
      subtitle: `${stats?.companies?.active || 0} ${t('نشط', 'active')}`,
      icon: Building2,
      gradient: 'from-violet-500 to-purple-600',
      bgGlow: 'violet'
    },
    {
      title: t('الأطباء', 'Doctors'),
      value: stats?.totals?.users || 0,
      subtitle: t('مسجل', 'registered'),
      icon: Stethoscope,
      gradient: 'from-cyan-500 to-teal-500',
      bgGlow: 'cyan'
    },
    {
      title: t('الاشتراكات', 'Subscriptions'),
      value: stats?.companies?.active || 0,
      subtitle: `${stats?.companies?.trial || 0} ${t('تجريبي', 'trial')}`,
      icon: CreditCard,
      gradient: 'from-emerald-500 to-green-500',
      bgGlow: 'emerald'
    },
    {
      title: t('الحجوزات', 'Bookings'),
      value: stats?.totals?.online_bookings || 0,
      subtitle: t('هذا الشهر', 'this month'),
      icon: Calendar,
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'amber'
    }
  ];

  const quickActions = [
    { 
      label: t('إضافة عيادة', 'Add Clinic'), 
      path: '/super-admin/clinics', 
      icon: Building2,
      color: 'violet'
    },
    { 
      label: t('إدارة الأطباء', 'Manage Doctors'), 
      path: '/super-admin/doctors', 
      icon: Stethoscope,
      color: 'cyan'
    },
    { 
      label: t('الاشتراكات', 'Subscriptions'), 
      path: '/super-admin/subscriptions', 
      icon: CreditCard,
      color: 'emerald'
    },
    { 
      label: t('نسخ احتياطي', 'Backup'), 
      path: '/super-admin/backup', 
      icon: TrendingUp,
      color: 'amber'
    }
  ];

  const isRtl = language === 'ar';

  return (
    <div className="space-y-8" data-testid="super-admin-overview" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-fuchsia-600/5 border border-violet-500/20 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <Zap className="w-5 h-5 text-violet-400" />
              </div>
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30">
                {t('مدير النظام', 'Super Admin')}
              </Badge>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t('مرحباً بك في لوحة الإدارة', 'Welcome to Admin Panel')} 
              <span className="text-violet-400">.</span>
            </h1>
            <p className="text-slate-400 text-base max-w-xl">
              {t('إدارة الشركات والاشتراكات والأطباء من مكان واحد', 'Manage companies, subscriptions and doctors from one place')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            className="group relative overflow-hidden rounded-2xl bg-[#12121a] border border-white/5 p-6 hover:border-white/10 transition-all duration-300"
            data-testid={`stat-card-${i}`}
          >
            {/* Background Glow */}
            <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-32 h-32 bg-${stat.bgGlow}-500/10 rounded-full blur-3xl group-hover:bg-${stat.bgGlow}-500/20 transition-colors duration-500`} />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>+12%</span>
                </div>
              </div>
              
              <p className="text-4xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.title}</p>
              <p className="text-xs text-slate-600 mt-1">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t('إجراءات سريعة', 'Quick Actions')}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, i) => (
              <Link key={i} to={action.path} data-testid={`quick-action-${i}`}>
                <div className={`group relative overflow-hidden rounded-xl bg-[#12121a] border border-white/5 p-4 hover:border-${action.color}-500/30 transition-all duration-300 cursor-pointer`}>
                  <div className={`absolute inset-0 bg-gradient-to-br from-${action.color}-500/0 to-${action.color}-500/0 group-hover:from-${action.color}-500/5 group-hover:to-${action.color}-500/10 transition-all duration-300`} />
                  
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3 group-hover:bg-${action.color}-500/20 transition-colors`}>
                      <action.icon className={`w-5 h-5 text-slate-400 group-hover:text-${action.color}-400 transition-colors`} />
                    </div>
                    <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{action.label}</p>
                  </div>
                  
                  <ChevronRight className={`absolute ${isRTL ? 'left-3 rotate-180' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors`} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Clinics */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl bg-[#12121a] border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">{t('آخر العيادات', 'Recent Clinics')}</h2>
              <Link to="/super-admin/clinics">
                <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                  {t('عرض الكل', 'View All')}
                  <ArrowUpRight className="w-4 h-4 ms-1" />
                </Button>
              </Link>
            </div>
            
            <div className="divide-y divide-white/5">
              {recentCompanies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">{t('لا توجد عيادات', 'No clinics')}</p>
                </div>
              ) : (
                recentCompanies.map((company, i) => (
                  <div 
                    key={company.id} 
                    className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                    data-testid={`company-item-${i}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{language === 'ar' ? company.name_ar || company.name : company.name}</p>
                        <p className="text-xs text-slate-500">{company.code}</p>
                      </div>
                    </div>
                    
                    <Badge className={`${
                      company.subscription_status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : company.subscription_status === 'trial' 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    } border`}>
                      {company.subscription_status === 'active' && <CheckCircle className="w-3 h-3 me-1" />}
                      {company.subscription_status === 'trial' && <Clock className="w-3 h-3 me-1" />}
                      {company.subscription_status === 'expired' && <XCircle className="w-3 h-3 me-1" />}
                      {company.subscription_status === 'active' ? t('نشط', 'Active') :
                       company.subscription_status === 'trial' ? t('تجريبي', 'Trial') :
                       t('منتهي', 'Expired')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(stats?.companies?.trial > 0 || stats?.companies?.expired > 0) && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-500/20 p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-200 mb-1">
                {t('تنبيهات الاشتراكات', 'Subscription Alerts')}
              </h3>
              <p className="text-amber-300/70 text-sm">
                {stats?.companies?.trial > 0 && (
                  <span className="me-3">
                    <span className="font-bold text-amber-300">{stats.companies.trial}</span> {t('شركات في الفترة التجريبية', 'companies in trial')}
                  </span>
                )}
                {stats?.companies?.expired > 0 && (
                  <span>
                    <span className="font-bold text-amber-300">{stats.companies.expired}</span> {t('اشتراكات منتهية', 'expired subscriptions')}
                  </span>
                )}
              </p>
            </div>
            <Link to="/super-admin/subscriptions" className="ms-auto">
              <Button size="sm" className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30">
                {t('مراجعة', 'Review')}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminOverview;
