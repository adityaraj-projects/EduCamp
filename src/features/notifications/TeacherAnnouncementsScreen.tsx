import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { notificationService } from '../../services/notificationService';
import { materialService, TeacherAssignmentContext } from '../../services/materialService';
import type {
  AnnouncementDetail,
  AnnouncementStatus,
  AnnouncementPriority,
  AnnouncementTargetRole,
  CreateAnnouncementPayload,
} from '../../types/notification';
import {
  ANNOUNCEMENT_PRIORITY_OPTIONS,
  ANNOUNCEMENT_STATUS_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from '../../types/notification';
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Archive,
  Send,
  BookOpen,
  Users,
} from 'lucide-react';

export const TeacherAnnouncementsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  // State
  const [announcements, setAnnouncements] = useState<AnnouncementDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<AnnouncementPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Teaching Contexts for Targeting
  const [contexts, setContexts] = useState<TeacherAssignmentContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>('');

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createBody, setCreateBody] = useState<string>('');
  const [createPriority, setCreatePriority] = useState<AnnouncementPriority>('normal');
  const [createTargetType, setCreateTargetType] = useState<'institute' | 'academic'>(
    isAdmin ? 'institute' : 'academic'
  );
  const [createTargetRole, setCreateTargetRole] = useState<AnnouncementTargetRole>('all');
  const [createTargetBatchScope, setCreateTargetBatchScope] = useState<'batch' | 'class'>('batch');
  const [createScheduleDate, setCreateScheduleDate] = useState<string>('');
  const [createExpireDate, setCreateExpireDate] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Action Loading State
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1. Load Teaching Contexts for audience targeting
  useEffect(() => {
    let isMounted = true;
    async function loadContexts() {
      if (!user) return;
      try {
        const list = await materialService.getTeacherAssignments(user.id, isAdmin);
        if (isMounted) {
          setContexts(list);
          if (list.length > 0 && !selectedContextId) {
            setSelectedContextId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load targeting contexts:', err);
      }
    }
    loadContexts();
    return () => {
      isMounted = false;
    };
  }, [user, isAdmin]);

  // 2. Load Paginated Announcements
  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getAnnouncements({
        status: statusFilter,
        priority: priorityFilter,
        searchQuery: searchQuery.trim() || undefined,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setAnnouncements(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery, currentPage]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreateAnnouncement = async (initialStatus: 'draft' | 'published') => {
    if (!user) return;
    if (!createTitle.trim()) {
      setCreateError('Please enter an announcement title.');
      return;
    }
    if (!createBody.trim()) {
      setCreateError('Please enter the announcement body content.');
      return;
    }

    let targetsPayload: any[] | undefined = undefined;

    if (createTargetType === 'academic') {
      const ctx = contexts.find((c) => c.id === selectedContextId);
      if (!ctx) {
        setCreateError('Please select a valid academic context.');
        return;
      }

      targetsPayload = [
        {
          academic_year_id: ctx.academic_year_id,
          board_id: ctx.board_id,
          class_level_id: ctx.class_level_id,
          stream_id: ctx.stream_id || null,
          batch_id: createTargetBatchScope === 'batch' ? ctx.batch_id : null,
          subject_id: null,
        },
      ];
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const payload: CreateAnnouncementPayload = {
        title: createTitle.trim(),
        body: createBody.trim(),
        priority: createPriority,
        target_role: createTargetType === 'institute' ? createTargetRole : 'students',
        status: initialStatus,
        published_at: createScheduleDate
          ? new Date(createScheduleDate).toISOString()
          : initialStatus === 'published'
          ? new Date().toISOString()
          : null,
        expires_at: createExpireDate ? new Date(createExpireDate).toISOString() : null,
        targets: targetsPayload,
      };

      await notificationService.createAnnouncement(payload, user.id);

      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateBody('');
      setCreateScheduleDate('');
      setCreateExpireDate('');
      loadAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create announcement';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    setUpdatingId(id);
    try {
      await notificationService.updateAnnouncementStatus(id, 'published');
      await loadAnnouncements();
    } catch (err) {
      alert('Failed to publish announcement');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this announcement? It will be preserved historically.')) return;
    setUpdatingId(id);
    try {
      await notificationService.archiveAnnouncement(id);
      await loadAnnouncements();
    } catch (err) {
      alert('Failed to archive announcement');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Communications & Announcements
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Announcement
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Filters and Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Lifecycles</option>
                {ANNOUNCEMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Priorities</option>
                {ANNOUNCEMENT_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={loadAnnouncements}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Fetching communication records...</p>
          </div>
        ) : announcements.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Announcements Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              You have not created any announcements matching the selected filter criteria.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-5 inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Announcement
            </button>
          </div>
        ) : (
          /* Announcement Cards List */
          <div className="space-y-4">
            {announcements.map((a) => {
              const priorityConfig = ANNOUNCEMENT_PRIORITY_OPTIONS.find(
                (p) => p.value === a.priority
              );
              const statusConfig = ANNOUNCEMENT_STATUS_OPTIONS.find((s) => s.value === a.status);

              let targetText = 'Institute-Wide Broadcast';
              if (a.targets && a.targets.length > 0) {
                const t = a.targets[0];
                targetText = `${t.board?.name || 'Board'} • ${t.class_level?.display_name || 'Class'} ${
                  t.batch ? `(${t.batch.name})` : '(All Batches)'
                }`;
              }

              return (
                <div
                  key={a.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: priorityConfig?.badgeBg || '#F3F4F6',
                          color: priorityConfig?.badgeText || '#374151',
                        }}
                      >
                        {priorityConfig?.label || 'Normal'}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${statusConfig?.color || '#6B7280'}15`,
                          color: statusConfig?.color || '#6B7280',
                        }}
                      >
                        {statusConfig?.label || a.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {a.published_at
                          ? `Published ${new Date(a.published_at).toLocaleDateString()}`
                          : `Created ${new Date(a.created_at).toLocaleDateString()}`}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">{a.title}</h3>

                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {a.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <div className="flex items-center space-x-1 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{targetText}</span>
                      </div>
                      <div className="flex items-center space-x-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Author: {a.creator?.full_name || 'Admin'}</span>
                      </div>
                      {a.expires_at && (
                        <div className="text-amber-600 font-medium">
                          Expires: {new Date(a.expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap md:flex-col items-stretch justify-end gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 min-w-[140px]">
                    {a.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handlePublishNow(a.id)}
                        disabled={updatingId === a.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5 mr-1" /> Publish Now
                      </button>
                    )}

                    {a.status === 'published' && (
                      <span className="text-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        Active to Audience
                      </span>
                    )}

                    {a.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => handleArchive(a.id)}
                        disabled={updatingId === a.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors"
                        title="Archive Announcement"
                      >
                        <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm text-sm">
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

      {/* CREATE ANNOUNCEMENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">Create New Announcement</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule update for Class 10 Board Revision"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Urgency / Priority *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ANNOUNCEMENT_PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCreatePriority(opt.value)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        createPriority === opt.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience Scope */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Audience Scope *
                </label>
                <div className="flex flex-wrap gap-4">
                  {isAdmin && (
                    <label className="flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="targetType"
                        checked={createTargetType === 'institute'}
                        onChange={() => setCreateTargetType('institute')}
                        className="text-indigo-600 focus:ring-indigo-500 mr-2"
                      />
                      Institute-Wide Broadcast
                    </label>
                  )}
                  <label className="flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={createTargetType === 'academic'}
                      onChange={() => setCreateTargetType('academic')}
                      className="text-indigo-600 focus:ring-indigo-500 mr-2"
                    />
                    Targeted Academic Context
                  </label>
                </div>
              </div>

              {/* Institute Role Selector (Admin only) */}
              {createTargetType === 'institute' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Target Role
                  </label>
                  <select
                    value={createTargetRole}
                    onChange={(e) => setCreateTargetRole(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">All Members (Students, Teachers, Staff)</option>
                    <option value="students">All Enrolled Students Only</option>
                    <option value="teachers">All Faculty / Teachers Only</option>
                  </select>
                </div>
              )}

              {/* Academic Context Selector */}
              {createTargetType === 'academic' && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Academic Class Assignment *
                    </label>
                    <select
                      value={selectedContextId}
                      onChange={(e) => setSelectedContextId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      {contexts.map((ctx) => (
                        <option key={ctx.id} value={ctx.id}>
                          {ctx.board_name} — {ctx.class_name} • Batch: {ctx.batch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-6">
                    <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="batchScope"
                        checked={createTargetBatchScope === 'batch'}
                        onChange={() => setCreateTargetBatchScope('batch')}
                        className="text-indigo-600 focus:ring-indigo-500 mr-1.5"
                      />
                      Specific Batch Only
                    </label>
                    <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="batchScope"
                        checked={createTargetBatchScope === 'class'}
                        onChange={() => setCreateTargetBatchScope('class')}
                        className="text-indigo-600 focus:ring-indigo-500 mr-1.5"
                      />
                      All Batches in this Class
                    </label>
                  </div>
                </div>
              )}

              {/* Message Body (Safe Plain Text) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Message Content *
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter detailed notice or instructions..."
                  value={createBody}
                  onChange={(e) => setCreateBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              {/* Scheduling and Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Schedule Release Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={createScheduleDate}
                    onChange={(e) => setCreateScheduleDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Leave blank to publish immediately upon release.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Notice Expiration Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={createExpireDate}
                    onChange={(e) => setCreateExpireDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Auto-hides from active feeds after this time.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCreateAnnouncement('draft')}
                  disabled={isCreating}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold shadow-sm disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateAnnouncement('published')}
                  disabled={isCreating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 inline-flex items-center"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Publish Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
