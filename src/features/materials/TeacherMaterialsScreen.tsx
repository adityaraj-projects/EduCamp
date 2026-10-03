import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  materialService,
  TeacherAssignmentContext,
} from '../../services/materialService';
import type { StudyMaterialDetail, MaterialType } from '../../types/material';
import {
  MATERIAL_TYPE_CONFIGS,
  MAX_MATERIAL_FILE_SIZE_BYTES,
  DEFAULT_PAGE_SIZE,
} from '../../types/material';
import {
  ArrowLeft,
  Upload,
  FileText,
  Search,
  ExternalLink,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
} from 'lucide-react';

export const TeacherMaterialsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = role === 'admin';

  // Navigation tab: 'list' | 'upload'
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');

  // Teacher Academic Assignments
  const [assignments, setAssignments] = useState<TeacherAssignmentContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string>('');
  const [applyToAllBatches, setApplyToAllBatches] = useState<boolean>(false);

  // Upload Form Fields
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadType, setUploadType] = useState<MaterialType>('notes');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  // List View State
  const [materials, setMaterials] = useState<StudyMaterialDetail[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [listErrorMessage, setListErrorMessage] = useState<string | null>(null);

  // List Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<MaterialType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // 1. Load Teacher Academic Assignments
  useEffect(() => {
    let isMounted = true;
    async function loadAssignments() {
      if (!user) return;
      try {
        const list = await materialService.getTeacherAssignments(user.id, isAdmin);
        if (isMounted) {
          setAssignments(list);
          if (list.length > 0 && !selectedContextId) {
            setSelectedContextId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load teacher assignments:', err);
      }
    }
    loadAssignments();
    return () => {
      isMounted = false;
    };
  }, [user, isAdmin]);

  // 2. Load Materials List
  const loadMaterialsList = useCallback(async () => {
    setIsLoadingList(true);
    setListErrorMessage(null);
    try {
      const res = await materialService.getMaterials({
        material_type: filterType !== 'all' ? filterType : undefined,
        searchQuery: searchQuery.trim() || undefined,
        status: 'active',
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
      });

      setMaterials(res.data);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.count);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading materials';
      setListErrorMessage(msg);
    } finally {
      setIsLoadingList(false);
    }
  }, [filterType, searchQuery, currentPage]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadMaterialsList();
    }
  }, [activeTab, loadMaterialsList]);

  // 3. File Selection & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileValidationError(null);
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // PDF extension check
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFileValidationError('Only PDF documents (.pdf) are allowed.');
      setSelectedFile(null);
      return;
    }

    // MIME type check
    if (file.type && file.type !== 'application/pdf') {
      setFileValidationError('File MIME type must be application/pdf.');
      setSelectedFile(null);
      return;
    }

    // Size limit check (25MB)
    if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFileValidationError(`File size (${sizeMB} MB) exceeds maximum allowed limit of 25 MB.`);
      setSelectedFile(null);
      return;
    }

    if (file.size <= 0) {
      setFileValidationError('Selected file is empty.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // If title is empty, prefill with file base name
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  // 4. Handle Material Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedFile) {
      setFileValidationError('Please select a valid PDF file to upload.');
      return;
    }

    if (!uploadTitle.trim()) {
      setFileValidationError('Please provide a document title.');
      return;
    }

    const context = assignments.find((a) => a.id === selectedContextId);
    if (!context) {
      setFileValidationError('Please select an academic class and subject assignment.');
      return;
    }

    setIsUploading(true);
    setFileValidationError(null);
    setUploadSuccessMessage(null);

    try {
      await materialService.uploadStudyMaterial(
        {
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || undefined,
          material_type: uploadType,
          academic_year_id: context.academic_year_id,
          board_id: context.board_id,
          class_level_id: context.class_level_id,
          stream_id: context.stream_id,
          subject_id: context.subject_id,
          batch_id: applyToAllBatches ? null : context.batch_id,
        },
        selectedFile,
        user.id
      );

      // Reset Form State
      setUploadTitle('');
      setUploadDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setUploadSuccessMessage('Study material uploaded and published successfully!');
      // Reload list and switch to list tab after 1 second
      setTimeout(() => {
        setActiveTab('list');
        loadMaterialsList();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setFileValidationError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // 5. Open Signed PDF
  const handleOpenMaterial = async (material: StudyMaterialDetail) => {
    setIsOpeningId(material.id);
    setListErrorMessage(null);
    try {
      const signedUrl = await materialService.getMaterialDownloadUrl(material.storage_path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to obtain access link.';
      setListErrorMessage(msg);
    } finally {
      setIsOpeningId(null);
    }
  };

  // 6. Soft Archive
  const handleArchive = async (materialId: string) => {
    if (!window.confirm('Are you sure you want to archive this study material? It will no longer appear in student listings.')) {
      return;
    }

    setIsArchivingId(materialId);
    try {
      await materialService.archiveStudyMaterial(materialId);
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive document.';
      alert(msg);
    } finally {
      setIsArchivingId(null);
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
              Study Materials Management
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
              {isAdmin ? 'System Administrator Portal' : 'Faculty Document Portal'}
            </p>
          </div>
        </div>

        {/* Role Badge */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            background: isAdmin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            border: `1px solid ${isAdmin ? '#EF4444' : '#F59E0B'}`,
            color: isAdmin ? '#FCA5A5' : '#FCD34D',
            borderRadius: '12px',
            padding: '3px 10px',
          }}
        >
          {role || 'Faculty'}
        </div>
      </header>

      <main
        style={{
          maxWidth: '820px',
          width: '100%',
          margin: '0 auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(22, 17, 58, 0.8)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'list' ? 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)' : 'transparent',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <FileText size={16} />
            <span>Published Documents ({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'upload' ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)' : 'transparent',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <Upload size={16} />
            <span>Upload New Material</span>
          </button>
        </div>

        {/* TAB 1: LIST VIEW */}
        {activeTab === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Search & Filter Bar */}
            <div
              style={{
                background: 'rgba(22, 17, 58, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  flex: '1 1 240px',
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
                  placeholder="Filter materials by title..."
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
              </div>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as MaterialType | 'all');
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

            {/* Error banner */}
            {listErrorMessage && (
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
                <span>{listErrorMessage}</span>
              </div>
            )}

            {/* Materials cards */}
            {isLoadingList ? (
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
                <Loader2 size={32} className="animate-spin" color="#8B5CF6" />
                <span style={{ fontSize: '13px' }}>Loading materials catalog...</span>
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
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>No Materials Uploaded</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>
                  Click the "Upload New Material" tab above to publish your first educational PDF.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {materials.map((m) => {
                  const typeCfg = getTypeConfig(m.material_type);
                  const isOpening = isOpeningId === m.id;
                  const isArchiving = isArchivingId === m.id;

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
                      }}
                    >
                      {/* Top Badges */}
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

                          {m.board && m.class_level && (
                            <span
                              style={{
                                fontSize: '11.5px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: '#E0E7FF',
                                padding: '2px 8px',
                                borderRadius: '8px',
                              }}
                            >
                              {m.board.code} • {m.class_level.display_name}
                            </span>
                          )}

                          {m.subject && (
                            <span
                              style={{
                                fontSize: '11.5px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#A5B4FC',
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

                      {/* Title & Description */}
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>
                          {m.title}
                        </h3>
                        {m.description && (
                          <p style={{ margin: 0, fontSize: '12.5px', color: '#A09CB8', lineHeight: 1.4 }}>
                            {m.description}
                          </p>
                        )}
                      </div>

                      {/* Footer Info & Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingTop: '10px',
                          fontSize: '11.5px',
                          color: '#9CA3AF',
                        }}
                      >
                        <div>
                          {m.batch ? (
                            <span style={{ color: '#F472B6' }}>Batch: {m.batch.name}</span>
                          ) : (
                            <span style={{ color: '#6EE7B7' }}>Available to All Batches</span>
                          )}
                          <span style={{ margin: '0 8px' }}>•</span>
                          <span>
                            {new Date(m.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Open Button */}
                          <button
                            type="button"
                            disabled={isOpening}
                            onClick={() => handleOpenMaterial(m)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '8px',
                              padding: '5px 12px',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isOpening ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {isOpening ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ExternalLink size={13} />
                            )}
                            <span>Open</span>
                          </button>

                          {/* Soft Archive Button */}
                          <button
                            type="button"
                            disabled={isArchiving}
                            onClick={() => handleArchive(m.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              color: '#FCA5A5',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isArchiving ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {isArchiving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Archive size={13} />
                            )}
                            <span>Archive</span>
                          </button>
                        </div>
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
                  disabled={currentPage <= 1 || isLoadingList}
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
                  disabled={currentPage >= totalPages || isLoadingList}
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
          </div>
        )}

        {/* TAB 2: UPLOAD FORM */}
        {activeTab === 'upload' && (
          <form
            onSubmit={handleUploadSubmit}
            style={{
              background: 'rgba(22, 17, 58, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700 }}>
                Publish Study Material
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#9CA3AF' }}>
                Files are securely encrypted in EduCamp private cloud storage. Maximum file size: 25 MB (PDF format only).
              </p>
            </div>

            {/* Success Banner */}
            {uploadSuccessMessage && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#34D399',
                  fontSize: '13px',
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{uploadSuccessMessage}</span>
              </div>
            )}

            {/* Error Banner */}
            {fileValidationError && (
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
                <span>{fileValidationError}</span>
              </div>
            )}

            {/* 1. Academic Context Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#E0E7FF' }}>
                Authorized Academic Assignment <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
                required
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                {assignments.length === 0 ? (
                  <option value="">No active teaching assignments found</option>
                ) : (
                  assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.board_name} • {a.class_name} • {a.subject_name} ({a.batch_name})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Batch Visibility Option */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12.5px',
                color: '#D1D5DB',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={applyToAllBatches}
                onChange={(e) => setApplyToAllBatches(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#8B5CF6' }}
              />
              <span>Make available to all batches of this class level</span>
            </label>

            {/* 2. Material Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#E0E7FF' }}>
                Document Category <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as MaterialType)}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                {MATERIAL_TYPE_CONFIGS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.description})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Document Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#E0E7FF' }}>
                Document Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Chapter 3: Trigonometric Identities & Notes"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                maxLength={200}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* 4. Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#E0E7FF' }}>
                Description / Instructions (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief guidelines, important formula highlights, or revision instructions..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                style={{
                  background: '#0B0826',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 5. PDF File Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#E0E7FF' }}>
                Select PDF File <span style={{ color: '#EF4444' }}>*</span>
              </label>

              <div
                style={{
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'rgba(11, 8, 38, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={28} color="#10B981" />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#34D399' }}>
                        {formatFileSize(selectedFile.size)} • Valid PDF Document
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={28} color="#EC4899" />
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to browse PDF file</div>
                    <div style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
                      Strictly PDF documents up to 25 MB
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isUploading || assignments.length === 0}
              style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: isUploading || assignments.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                opacity: isUploading || assignments.length === 0 ? 0.6 : 1,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Encrypting & Uploading Document...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Publish Study Material</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};
