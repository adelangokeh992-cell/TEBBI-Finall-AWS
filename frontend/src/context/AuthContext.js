import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);
const SESSION_IDLE_MINUTES = 15; // Match backend SESSION_IDLE_TIMEOUT_MINUTES

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tebbi_token'));
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(localStorage.getItem('tebbi_lang') || 'ar');
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const logout = useCallback(() => {
    const t = token;
    (async () => {
      try {
        if (t) await authAPI.logout();
      } catch (_) {}
    })();
    localStorage.removeItem('tebbi_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    const idleMs = SESSION_IDLE_MINUTES * 60 * 1000;
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        logout();
      }, idleMs);
    };
    resetIdleTimer();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [token, user, logout]);

  useEffect(() => {
    localStorage.setItem('tebbi_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const fetchUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    const data = response.data;
    if (data.requires_mfa) {
      return { requires_mfa: true, temp_token: data.temp_token, user: data.user };
    }
    if (data.requires_mfa_setup) {
      return { requires_mfa_setup: true, temp_token: data.temp_token, user: data.user };
    }
    const { access_token, user: userData } = data;
    localStorage.setItem('tebbi_token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    // جلب المستخدم مع الميزات والصلاحيات (allowed_features) من /auth/me
    const meRes = await authAPI.getMe().catch(() => null);
    if (meRes?.data) setUser(meRes.data);
    return userData;
  };

  // Get redirect path based on user role
  const getRedirectPath = (userData) => {
    if (!userData) return '/dashboard';
    const role = userData.role;
    if (role === 'super_admin') return '/super-admin';
    if (role === 'company_admin') return '/clinic-admin';
    return '/dashboard';
  };


  const logoutAll = async () => {
    try {
      await authAPI.logoutAll();
    } catch (_) {}
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    localStorage.removeItem('tebbi_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const completeMfaSetup = useCallback(async (tempToken, code) => {
    const res = await authAPI.mfaVerify(code, tempToken);
    const { access_token, user: userData } = res.data;
    localStorage.setItem('tebbi_token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    const meRes = await authAPI.getMe().catch(() => null);
    setUser(meRes?.data || userData);
  }, []);

  const completeMfaChallenge = useCallback(async (tempToken, code) => {
    const res = await authAPI.mfaChallenge(tempToken, code);
    const { access_token, user: userData } = res.data;
    localStorage.setItem('tebbi_token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    const meRes = await authAPI.getMe().catch(() => null);
    setUser(meRes?.data || userData);
  }, []);

  const t = (ar, en) => language === 'ar' ? ar : en;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      logoutAll,
      completeMfaSetup,
      completeMfaChallenge,
      language,
      toggleLanguage,
      t,
      isRTL: language === 'ar',
      getRedirectPath
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
