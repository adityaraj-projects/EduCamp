import { supabase } from '../lib/supabaseClient';
import type {
  Announcement,
  AnnouncementDetail,
  NotificationItem,
  AnnouncementFilters,
  NotificationFilters,
  CreateAnnouncementPayload,
  CreateNotificationPayload,
  AnnouncementStatus,
} from '../types/notification';
import { DEFAULT_PAGE_SIZE } from '../types/notification';

export interface PaginatedAnnouncementsResult {
  data: AnnouncementDetail[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedNotificationsResult {
  data: NotificationItem[];
  count: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const notificationService = {
  /**
   * Fetch paginated list of announcements for management view (Admin/Teacher)
   */
  async getAnnouncements(
    filters: AnnouncementFilters = {}
  ): Promise<PaginatedAnnouncementsResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from('announcements')
        .select(
          `
          id,
          title,
          body,
          priority,
          status,
          target_role,
          published_at,
          expires_at,
          created_by,
          created_at,
          updated_at,
          creator:profiles!announcements_created_by_fkey(id, full_name, role),
          targets:announcement_targets(
            id,
            announcement_id,
            academic_year_id,
            board_id,
            class_level_id,
            stream_id,
            batch_id,
            subject_id,
            created_at,
            board:boards(id, code, name),
            class_level:class_levels(id, class_number, display_name),
            stream:streams(id, code, name),
            batch:batches(id, name, code)
          )
        `,
          { count: 'exact' }
        );

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }

      if (filters.target_role && filters.target_role !== 'all') {
        query = query.eq('target_role', filters.target_role);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const term = filters.searchQuery.trim().replace(/[%_]/g, '');
        query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('[EduCamp NotificationService] getAnnouncements error:', error.message);
        throw new Error(`Failed to load announcements: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: (data as unknown as AnnouncementDetail[]) || [],
        count: totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err: unknown) {
      console.error('[EduCamp NotificationService] Exception in getAnnouncements:', err);
      throw err;
    }
  },

  /**
   * Fetch single announcement by ID with joined relations
   */
  async getAnnouncementById(id: string): Promise<AnnouncementDetail | null> {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(
          `
          id,
          title,
          body,
          priority,
          status,
          target_role,
          published_at,
          expires_at,
          created_by,
          created_at,
          updated_at,
          creator:profiles!announcements_created_by_fkey(id, full_name, role),
          targets:announcement_targets(
            id,
            announcement_id,
            academic_year_id,
            board_id,
            class_level_id,
            stream_id,
            batch_id,
            subject_id,
            created_at,
            board:boards(id, code, name),
            class_level:class_levels(id, class_number, display_name),
            stream:streams(id, code, name),
            batch:batches(id, name, code)
          )
        `
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[EduCamp NotificationService] getAnnouncementById error:', error.message);
        throw new Error(`Failed to load announcement: ${error.message}`);
      }

      return (data as unknown as AnnouncementDetail) || null;
    } catch (err: unknown) {
      console.error('[EduCamp NotificationService] Exception in getAnnouncementById:', err);
      throw err;
    }
  },

  /**
   * Create an Announcement and optionally its academic target rules
   */
  async createAnnouncement(
    payload: CreateAnnouncementPayload,
    creatorProfileId: string
  ): Promise<AnnouncementDetail> {
    if (!payload.title || payload.title.trim().length === 0) {
      throw new Error('Announcement title is required.');
    }
    if (!payload.body || payload.body.trim().length === 0) {
      throw new Error('Announcement message body is required.');
    }

    const nowIso = new Date().toISOString();
    let initialStatus = payload.status || 'draft';
    let publishedAt = payload.published_at || null;

    if (initialStatus === 'published' && !publishedAt) {
      publishedAt = nowIso;
    } else if (publishedAt && new Date(publishedAt) > new Date()) {
      initialStatus = 'scheduled';
    }

    const announcementId = crypto.randomUUID();

    // 1. Insert announcement header
    const { error: headerError } = await supabase
      .from('announcements')
      .insert({
        id: announcementId,
        title: payload.title.trim(),
        body: payload.body.trim(),
        priority: payload.priority || 'normal',
        status: initialStatus,
        target_role: payload.target_role || 'all',
        published_at: publishedAt,
        expires_at: payload.expires_at || null,
        created_by: creatorProfileId,
      });

    if (headerError) {
      console.error('[EduCamp NotificationService] createAnnouncement error:', headerError.message);
      throw new Error(`Failed to create announcement: ${headerError.message}`);
    }

    // 2. Insert target rules if specified
    if (payload.targets && payload.targets.length > 0) {
      const targetRows = payload.targets.map((t) => ({
        id: crypto.randomUUID(),
        announcement_id: announcementId,
        academic_year_id: t.academic_year_id || null,
        board_id: t.board_id || null,
        class_level_id: t.class_level_id || null,
        stream_id: t.stream_id || null,
        batch_id: t.batch_id || null,
        subject_id: t.subject_id || null,
      }));

      const { error: targetsError } = await supabase
        .from('announcement_targets')
        .insert(targetRows);

      if (targetsError) {
        console.error('[EduCamp NotificationService] targets error:', targetsError.message);
        // Rollback announcement header
        await supabase.from('announcements').delete().eq('id', announcementId);
        throw new Error(`Failed to assign announcement targeting: ${targetsError.message}`);
      }
    }

    const created = await this.getAnnouncementById(announcementId);
    if (!created) {
      throw new Error('Announcement created but failed to retrieve record.');
    }
    return created;
  },

  /**
   * Update announcement lifecycle status (e.g. draft -> published, or archive)
   */
  async updateAnnouncementStatus(
    id: string,
    status: AnnouncementStatus
  ): Promise<Announcement> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'published') {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[EduCamp NotificationService] updateAnnouncementStatus error:', error.message);
      throw new Error(`Failed to update announcement status: ${error.message}`);
    }

    return data as Announcement;
  },

  /**
   * Archive an announcement safely
   */
  async archiveAnnouncement(id: string): Promise<Announcement> {
    return this.updateAnnouncementStatus(id, 'archived');
  },

  /**
   * Fetch unread notification count for authenticated user using high-performance RPC
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
      });

      if (error) {
        console.warn('[EduCamp NotificationService] getUnreadCount rpc error:', error.message);
        return 0;
      }

      return Number(data) || 0;
    } catch (err) {
      console.warn('[EduCamp NotificationService] Exception in getUnreadCount:', err);
      return 0;
    }
  },

  /**
   * Fetch unified list of notifications (published announcements + direct event notifications)
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<PaginatedNotificationsResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || DEFAULT_PAGE_SIZE));

    try {
      const nowIso = new Date().toISOString();

      // 1. Fetch published, non-expired announcements
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select(
          `
          id,
          title,
          body,
          priority,
          published_at,
          expires_at,
          created_at,
          creator:profiles!announcements_created_by_fkey(full_name),
          notification_reads(user_id, read_at),
          targets:announcement_targets(
            board:boards(name),
            class_level:class_levels(display_name),
            batch:batches(name)
          )
        `
        )
        .eq('status', 'published')
        .lte('published_at', nowIso)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('published_at', { ascending: false })
        .limit(100);

      if (annError) {
        console.error('[EduCamp NotificationService] announcements query error:', annError.message);
      }

      // 2. Fetch direct user event notifications
      const { data: directNotes, error: notesError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (notesError) {
        console.error('[EduCamp NotificationService] direct notes query error:', notesError.message);
      }

      // 3. Transform Announcements to unified NotificationItem
      const announcementItems: NotificationItem[] = (announcements || []).map((a: any) => {
        const readRecord = (a.notification_reads || []).find((r: any) => r.user_id === userId);
        const isRead = !!readRecord?.read_at;

        // Construct target summary text if targets exist
        let targetSummary = 'Institute-Wide';
        if (a.targets && a.targets.length > 0) {
          const t = a.targets[0];
          const parts: string[] = [];
          if (t.board?.name) parts.push(t.board.name);
          if (t.class_level?.display_name) parts.push(t.class_level.display_name);
          if (t.batch?.name) parts.push(t.batch.name);
          if (parts.length > 0) targetSummary = parts.join(' • ');
        }

        return {
          id: a.id,
          source_type: 'announcement',
          announcement_id: a.id,
          notification_type: 'announcement',
          title: a.title,
          body: a.body,
          priority: a.priority,
          action_url: undefined,
          is_read: isRead,
          read_at: readRecord?.read_at || null,
          created_at: a.published_at || a.created_at,
          published_at: a.published_at,
          expires_at: a.expires_at,
          author_name: a.creator?.full_name || 'Institute Administration',
          target_summary: targetSummary,
        };
      });

      // 4. Transform Direct Notifications to unified NotificationItem
      const directItems: NotificationItem[] = (directNotes || []).map((n: any) => ({
        id: n.id,
        source_type: 'direct',
        announcement_id: n.announcement_id || null,
        notification_type: n.notification_type,
        title: n.title,
        body: n.body || '',
        priority: n.priority,
        action_url: n.action_url || null,
        is_read: !!n.read_at,
        read_at: n.read_at || null,
        created_at: n.created_at,
        published_at: n.created_at,
        expires_at: n.expires_at,
        author_name: 'EduCamp System',
        target_summary: 'Personal Alert',
      }));

      // 5. Merge and sort by latest date
      let merged = [...announcementItems, ...directItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // 6. Apply in-memory filters
      if (filters.read_status && filters.read_status !== 'all') {
        if (filters.read_status === 'unread') {
          merged = merged.filter((item) => !item.is_read);
        } else if (filters.read_status === 'read') {
          merged = merged.filter((item) => item.is_read);
        }
      }

      if (filters.priority && filters.priority !== 'all') {
        merged = merged.filter((item) => item.priority === filters.priority);
      }

      if (filters.notification_type && filters.notification_type !== 'all') {
        merged = merged.filter((item) => item.notification_type === filters.notification_type);
      }

      if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
        const q = filters.searchQuery.trim().toLowerCase();
        merged = merged.filter(
          (item) => item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q)
        );
      }

      const totalCount = merged.length;
      const unreadCount = merged.filter((i) => !i.is_read).length;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const startIndex = (page - 1) * pageSize;
      const paginatedData = merged.slice(startIndex, startIndex + pageSize);

      return {
        data: paginatedData,
        count: totalCount,
        unreadCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err: unknown) {
      console.error('[EduCamp NotificationService] Exception in getUserNotifications:', err);
      throw err;
    }
  },

  /**
   * Mark a single notification item as read (Idempotent)
   */
  async markAsRead(
    userId: string,
    item: { id: string; sourceType: 'announcement' | 'direct'; announcementId?: string | null }
  ): Promise<void> {
    try {
      const nowIso = new Date().toISOString();

      if (item.sourceType === 'announcement' || item.announcementId) {
        const targetAnnId = item.announcementId || item.id;
        const { error } = await supabase
          .from('notification_reads')
          .upsert(
            {
              user_id: userId,
              announcement_id: targetAnnId,
              read_at: nowIso,
            },
            { onConflict: 'user_id,announcement_id' }
          );

        if (error) {
          console.error('[EduCamp NotificationService] markAsRead announcement error:', error.message);
        }
      } else {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: nowIso, updated_at: nowIso })
          .eq('id', item.id)
          .eq('user_id', userId);

        if (error) {
          console.error('[EduCamp NotificationService] markAsRead direct error:', error.message);
        }
      }
    } catch (err) {
      console.error('[EduCamp NotificationService] Exception in markAsRead:', err);
    }
  },

  /**
   * Mark all unread notifications visible to user as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const nowIso = new Date().toISOString();

      // 1. Mark all unread direct notifications
      await supabase
        .from('notifications')
        .update({ read_at: nowIso, updated_at: nowIso })
        .eq('user_id', userId)
        .is('read_at', null);

      // 2. Fetch unread visible announcements to record reads
      const { data: visibleAnnouncements } = await supabase
        .from('announcements')
        .select('id, notification_reads(user_id, read_at)')
        .eq('status', 'published')
        .lte('published_at', nowIso)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .limit(100);

      if (visibleAnnouncements && visibleAnnouncements.length > 0) {
        const unreadAnnIds = visibleAnnouncements
          .filter((a: any) => !(a.notification_reads || []).some((r: any) => r.user_id === userId))
          .map((a: any) => a.id);

        if (unreadAnnIds.length > 0) {
          const rows = unreadAnnIds.map((annId) => ({
            user_id: userId,
            announcement_id: annId,
            read_at: nowIso,
          }));

          await supabase
            .from('notification_reads')
            .upsert(rows, { onConflict: 'user_id,announcement_id' });
        }
      }
    } catch (err) {
      console.error('[EduCamp NotificationService] Exception in markAllAsRead:', err);
    }
  },

  /**
   * Automated Event Notification Helpers (Foundation for Phases 6-9)
   */
  async createNotification(payload: CreateNotificationPayload): Promise<void> {
    try {
      const { error } = await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        user_id: payload.user_id,
        notification_type: payload.notification_type,
        title: payload.title.trim(),
        body: payload.body?.trim() || null,
        priority: payload.priority || 'normal',
        action_url: payload.action_url || null,
        announcement_id: payload.announcement_id || null,
        expires_at: payload.expires_at || null,
      });

      if (error) {
        console.error('[EduCamp NotificationService] createNotification error:', error.message);
      }
    } catch (err) {
      console.error('[EduCamp NotificationService] Exception in createNotification:', err);
    }
  },

  async notifyMaterialPublished(
    userId: string,
    title: string,
    subjectName: string
  ): Promise<void> {
    return this.createNotification({
      user_id: userId,
      notification_type: 'study_material',
      title: `New Study Material: ${title}`,
      body: `New resource uploaded in ${subjectName}. Click to open and read.`,
      priority: 'normal',
      action_url: '/materials',
    });
  },

  async notifyAssignmentPublished(
    userId: string,
    title: string,
    subjectName: string,
    dueAt: string
  ): Promise<void> {
    return this.createNotification({
      user_id: userId,
      notification_type: 'assignment',
      title: `New Homework: ${title}`,
      body: `Assignment assigned for ${subjectName}. Due on ${dueAt}.`,
      priority: 'important',
      action_url: '/assignments',
    });
  },

  async notifyExamPublished(
    userId: string,
    title: string,
    examDate: string
  ): Promise<void> {
    return this.createNotification({
      user_id: userId,
      notification_type: 'exam',
      title: `Exam Scheduled: ${title}`,
      body: `Examination scheduled for ${examDate}. Check subjects and marks format.`,
      priority: 'important',
      action_url: '/exams',
    });
  },

  async notifyResultPublished(
    userId: string,
    title: string
  ): Promise<void> {
    return this.createNotification({
      user_id: userId,
      notification_type: 'result',
      title: `Exam Results Published: ${title}`,
      body: `Your verified report card and subject marks are now available.`,
      priority: 'urgent',
      action_url: '/exams',
    });
  },
};
