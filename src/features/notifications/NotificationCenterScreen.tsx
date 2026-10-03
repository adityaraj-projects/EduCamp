import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { notificationService } from '../../services/notificationService';
import type {
  NotificationItem,
  NotificationFilters,
  AnnouncementPriority,
  NotificationType,
} from '../../types/notification';
import {
  ANNOUNCEMENT_PRIORITY_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from '../../types/notification';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  BookOpen,
  FileText,
  Award,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';

export const NotificationCenterScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [readStatusFilter, setReadStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [priorityFilter, setPriorityFilter] = useState<AnnouncementPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);

  // Browser Push Permission State
  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const filters: NotificationFilters = {
        read_status: readStatusFilter,
        priority: priorityFilter,
        notification_type: typeFilter,
        searchQuery: searchQuery.trim() || undefined,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      };

      const res = await notificationService.getUserNotifications(user.id, filters);
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
      setTotalCount(res.count);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, readStatusFilter, priorityFilter, typeFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleOpenDetail = async (item: NotificationItem) => {
    if (!user) return;
    setSelectedItem(item);
    if (!item.is_read) {
      await notificationService.markAsRead(user.id, {
        id: item.id,
        sourceType: item.source_type,
        announcementId: item.announcement_id,
      });
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i))
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await notificationService.markAllAsRead(user.id);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((i) => ({ ...i, is_read: true })));
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        new Notification('EduCamp Notifications Enabled', {
          body: 'You will now receive alerts for important academic announcements and deadlines.',
          icon: '/assets/branding/app_logo.png',
        });
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'study_material':
        return <BookOpen className="w-5 h-5 text-blue-500" />;
      case 'assignment':
      case 'assignment_due':
        return <FileText className="w-5 h-5 text-pink-500" />;
      case 'exam':
      case 'result':
        return <Award className="w-5 h-5 text-emerald-500" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Bell className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Notification Center
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors"
              >
                <CheckCheck className="w-4 h-4 mr-1 text-indigo-600" /> Mark All Read
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* Opt-in Browser Alerts Banner (Non-intrusive) */}
        {browserPermission === 'default' && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start space-x-3">
              <Bell className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-900">Enable Desktop & Mobile Alerts?</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Get real-time browser alerts whenever important announcements, test dates, or marks are published.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex-shrink-0"
            >
              Enable Browser Alerts
            </button>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            {/* Read / Unread Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setReadStatusFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  readStatusFilter === 'all'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setReadStatusFilter('unread');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 ${
                  readStatusFilter === 'unread'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReadStatusFilter('read');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  readStatusFilter === 'read'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Read
              </button>
            </div>

            <button
              type="button"
              onClick={loadNotifications}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Priorities</option>
                {ANNOUNCEMENT_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Notification Types</option>
                {NOTIFICATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Fetching notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-md mx-auto mt-6">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Notifications</h3>
            <p className="text-slate-500 text-xs mt-1">
              You are completely caught up! New announcements and academic updates will appear here.
            </p>
          </div>
        ) : (
          /* Notification Cards List */
          <div className="space-y-3">
            {notifications.map((item) => {
              const priorityConfig = ANNOUNCEMENT_PRIORITY_OPTIONS.find(
                (p) => p.value === item.priority
              );

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className={`bg-white border rounded-2xl p-4.5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex items-start space-x-3.5 group ${
                    !item.is_read
                      ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/30 to-white'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-slate-100 flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    {getTypeIcon(item.notification_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: priorityConfig?.badgeBg || '#F3F4F6',
                            color: priorityConfig?.badgeText || '#374151',
                          }}
                        >
                          {priorityConfig?.label || 'Normal'}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">•</span>
                        <span className="text-xs text-slate-500 font-medium">
                          {item.author_name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        {!item.is_read && (
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block ml-1" />
                        )}
                      </div>
                    </div>

                    <h3
                      className={`text-sm tracking-tight ${
                        !item.is_read
                          ? 'font-extrabold text-slate-900 group-hover:text-indigo-600'
                          : 'font-semibold text-slate-700'
                      }`}
                    >
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span>{item.target_summary || 'Institute Notice'}</span>
                      {item.action_url && (
                        <span className="text-indigo-600 font-bold inline-flex items-center">
                          Open Resource <ExternalLink className="w-3 h-3 ml-1" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm text-xs">
            <span className="text-slate-500">
              Showing page <strong className="text-slate-900">{currentPage}</strong> of{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold">Official Communication</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor:
                      ANNOUNCEMENT_PRIORITY_OPTIONS.find((p) => p.value === selectedItem.priority)
                        ?.badgeBg || '#F3F4F6',
                    color:
                      ANNOUNCEMENT_PRIORITY_OPTIONS.find((p) => p.value === selectedItem.priority)
                        ?.badgeText || '#374151',
                  }}
                >
                  {selectedItem.priority.toUpperCase()}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {new Date(selectedItem.created_at).toLocaleString()}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                  {selectedItem.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Issued by: <strong className="text-slate-700">{selectedItem.author_name}</strong> •{' '}
                  {selectedItem.target_summary}
                </p>
              </div>

              {/* Message Body (Safe Plain Text Rendering - XSS Proof) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedItem.body}
              </div>

              {selectedItem.expires_at && (
                <div className="flex items-center space-x-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Notice expires on {new Date(selectedItem.expires_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              {selectedItem.action_url ? (
                <button
                  type="button"
                  onClick={() => {
                    const url = selectedItem.action_url!;
                    setSelectedItem(null);
                    navigate(url);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center"
                >
                  Go to Resource <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
