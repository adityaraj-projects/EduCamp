import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { notificationService } from '../../services/notificationService';
import type { NotificationItem } from '../../types/notification';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Clock,
  FileText,
  BookOpen,
  Award,
  Sparkles,
} from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentItems, setRecentItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Failed to fetch unread count:', err);
    }
  }, [user]);

  const fetchRecent = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await notificationService.getUserNotifications(user.id, {
        pageSize: 5,
        page: 1,
      });
      setRecentItems(res.data);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.warn('Failed to load recent notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchRecent();
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!user) return;
    if (!item.is_read) {
      await notificationService.markAsRead(user.id, {
        id: item.id,
        sourceType: item.source_type,
        announcementId: item.announcement_id,
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      setRecentItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i))
      );
    }

    setIsOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await notificationService.markAllAsRead(user.id);
    setUnreadCount(0);
    setRecentItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'study_material':
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'assignment':
      case 'assignment_due':
        return <FileText className="w-4 h-4 text-pink-500" />;
      case 'exam':
      case 'result':
        return <Award className="w-4 h-4 text-emerald-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="View notifications"
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-100 py-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : recentItems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p>No new notifications</p>
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start space-x-3 ${
                    !item.is_read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-100 flex-shrink-0 mt-0.5">
                    {getTypeIcon(item.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                        }`}
                      >
                        {item.title}
                      </h4>
                      {item.priority === 'urgent' && (
                        <span className="flex-shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{item.body}</p>
                    <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-400">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.target_summary && (
                        <span>• {item.target_summary}</span>
                      )}
                    </div>
                  </div>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-center space-x-1 transition-colors"
            >
              <span>Open Notification Center</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
