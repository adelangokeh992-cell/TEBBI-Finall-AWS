import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notificationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 45000;

export default function NotificationBell() {
  const { user, t } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef(null);

  const fetchUnread = async () => {
    if (!user?.company_id) return;
    try {
      const { data } = await notificationsAPI.getUnread();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (!user?.company_id) return;
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.company_id]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications([]);
      setUnreadCount(0);
      setOpen(false);
    } catch {}
  };

  const handleNotificationClick = (n) => {
    handleMarkRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;
  if (!user.company_id) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="px-3 py-2 border-b flex justify-between items-center">
          <span className="font-semibold">{t('الإشعارات', 'Notifications')}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              {t('تحديد الكل كمقروء', 'Mark all read')}
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-foreground text-sm">
            {t('لا توجد إشعارات جديدة', 'No new notifications')}
          </div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => handleNotificationClick(n)}
              className="flex flex-col items-stretch gap-0.5 py-3 cursor-pointer"
            >
              <span className="font-medium text-sm">{n.title}</span>
              {n.body && <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
