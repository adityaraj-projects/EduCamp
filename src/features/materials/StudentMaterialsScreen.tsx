import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { materialService, StudentEnrollmentContext } from '../../services/materialService';
import type { StudyMaterialDetail, MaterialType } from '../../types/material';
import {
  MATERIAL_TYPE_CONFIGS,
  DEFAULT_PAGE_SIZE,
} from '../../types/material';
import {
  ArrowLeft,
  FileText,
  Search,
  ExternalLink,
  BookOpen,
  Calendar,
  User,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const StudentMaterialsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // State
  const [enrollment, setEnrollment] = useState<StudentEnrollmentContext | null>(null);
  const [materials, setMaterials] = useState<StudyMaterialDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<MaterialType | 'all'>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string }[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // 1. Fetch Student Enrollment Context on mount
  useEffect(() => {
    let isMounted = true;
    async function loadStudentEnrollment() {
      if (!user) return;
      try {
        const enroll = await materialService.getStudentEnrollment(user.id);
        if (isMounted) {
          setEnrollment(enroll);
        }
      } catch (err) {
        console.error('Failed to load student enrollment:', err);
      }
    }
    loadStudentEnrollment();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Fetch Paginated Materials
  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await materialService.getMaterials({
        academic_year_id: enrollment?.academic_year_id,
        board_id: enrollment?.board_id,
        class_level_id: enrollment?.class_level_id,
        batch_id: enrollment?.batch_id,
        subject_id: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
        material_type: selectedType !== 'all' ? selectedType : undefined,
        searchQuery: searchQuery.trim() || undefined,
        status: 'active',
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setMaterials(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);

      // Extract unique subjects for the filter dropdown
      const subjectsMap = new Map<string, string>();
      res.data.forEach((m) => {
        if (m.subject) {
          subjectsMap.set(m.subject.id, m.subject.name);
        }
      });
      setAvailableSubjects((prev) => {
        const merged = new Map(prev.map((s) => [s.id, s.name]));
        subjectsMap.forEach((v, k) => merged.set(k, v));
        return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading materials';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [enrollment, selectedSubjectId, selectedType, searchQuery, currentPage]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // 3. Secure On-Demand Document Download / View
  const handleOpenMaterial = async (material: StudyMaterialDetail) => {
    setIsOpeningId(material.id);
    setErrorMessage(null);
    try {
      const signedUrl = await materialService.getMaterialDownloadUrl(material.storage_path);
      // Open in secure new tab
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to obtain access to document.';
      setErrorMessage(msg);
    } finally {
      setIsOpeningId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeConfig = (type: MaterialType) => {
    return (
      MATERIAL_TYPE_CONFIGS.find((c) => c.value === type) || {
        value: type,
        label: type,
        color: '#6B7280',
      }
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0B0826',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        paddingBottom: '40px',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: 'rgba(22, 17, 58, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.3px',
              }}
            >
              Study Materials & Notes
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
              Academic documents, chapters & revision resources
            </p>
          </div>
        </div>

        {/* Security Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '11px',
            color: '#34D399',
            fontWeight: 600,
          }}
        >
          <ShieldCheck size={14} />
          <span>Private & Encrypted</span>
        </div>
      </header>

      <main
        style={{
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Enrolled Context Badge */}
        {enrollment ? (
          <div
            style={{
              background: 'rgba(33, 26, 69, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={16} color="#EC4899" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {enrollment.board_name} • {enrollment.class_name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(236, 72, 153, 0.2)',
                  color: '#F472B6',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                {enrollment.batch_name}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {totalCount} {totalCount === 1 ? 'document' : 'documents'} available
            </span>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(33, 26, 69, 0.5)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#A09CB8',
            }}
          >
            Showing authorized academic study materials for {profile?.full_name || 'student'}.
          </div>
        )}

        {/* Search & Filter Controls */}
        <div
          style={{
            background: 'rgba(22, 17, 58, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0B0826',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '8px 12px',
              gap: '10px',
            }}
          >
            <Search size={16} color="#9CA3AF" />
            <input
              type="text"
              placeholder="Search by topic, chapter or title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                width: '100%',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Type & Subject Selectors */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Subject Selector */}
            <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>
                Filter by Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                <option value="all">All Subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Material Type Selector */}
            <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>
                Material Category
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as MaterialType | 'all');
                  setCurrentPage(1);
                }}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              >
                <option value="all">All Categories</option>
                {MATERIAL_TYPE_CONFIGS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FCA5A5',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Materials List */}
        {isLoading ? (
          <div
            style={{
              padding: '48px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: '#9CA3AF',
            }}
          >
            <Loader2 size={32} className="animate-spin" color="#EC4899" />
            <span style={{ fontSize: '13px' }}>Loading academic materials...</span>
          </div>
        ) : materials.length === 0 ? (
          <div
            style={{
              background: 'rgba(22, 17, 58, 0.5)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <FileText size={40} color="#6B7280" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>No Documents Found</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', maxWidth: '380px' }}>
              No study materials have been published yet for the selected filters. Your teachers will
              upload relevant notes and worksheets here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {materials.map((m) => {
              const typeCfg = getTypeConfig(m.material_type);
              const isOpening = isOpeningId === m.id;

              return (
                <div
                  key={m.id}
                  style={{
                    background: 'rgba(22, 17, 58, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  {/* Top Bar: Subject Badge & Category */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: `${typeCfg.color}22`,
                          border: `1px solid ${typeCfg.color}`,
                          color: typeCfg.color,
                          borderRadius: '8px',
                          padding: '2px 8px',
                        }}
                      >
                        {typeCfg.label}
                      </span>
                      {m.subject && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#E0E7FF',
                            background: 'rgba(255, 255, 255, 0.08)',
                            padding: '2px 8px',
                            borderRadius: '8px',
                          }}
                        >
                          {m.subject.name}
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
                      {formatFileSize(m.file_size_bytes)}
                    </span>
                  </div>

                  {/* Document Title & Description */}
                  <div>
                    <h3
                      style={{
                        margin: '0 0 4px 0',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        lineHeight: 1.4,
                      }}
                    >
                      {m.title}
                    </h3>
                    {m.description && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12.5px',
                          color: '#A09CB8',
                          lineHeight: 1.4,
                        }}
                      >
                        {m.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row: Class, Batch, Uploader, Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '11.5px',
                      color: '#9CA3AF',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {m.uploader && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={13} color="#9CA3AF" />
                          {m.uploader.full_name}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} color="#9CA3AF" />
                        {new Date(m.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {m.batch ? (
                        <span style={{ color: '#F472B6' }}>Batch: {m.batch.name}</span>
                      ) : (
                        <span style={{ color: '#6EE7B7' }}>All Batches</span>
                      )}
                    </div>

                    {/* Action Button: Open PDF via Signed URL */}
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => handleOpenMaterial(m)}
                      style={{
                        background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '6px 14px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isOpening ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 10px rgba(236, 72, 153, 0.3)',
                        opacity: isOpening ? 0.7 : 1,
                      }}
                    >
                      {isOpening ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Preparing Link...</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink size={13} />
                          <span>Open PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '16px 0',
            }}
          >
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: currentPage <= 1 ? '#6B7280' : '#FFFFFF',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: currentPage >= totalPages ? '#6B7280' : '#FFFFFF',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
              }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
