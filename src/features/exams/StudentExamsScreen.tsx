import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { examService } from '../../services/examService';
import type { ExamDetail, StudentExamReport } from '../../types/exam';
import { EXAM_TYPE_OPTIONS } from '../../types/exam';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronRight,
  X,
  AlertCircle,
} from 'lucide-react';

export const StudentExamsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exams, setExams] = useState<ExamDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Exam Report Modal
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [report, setReport] = useState<StudentExamReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadPublishedExams = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await examService.getStudentPublishedExams(user.id);
      setExams(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load published exams';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPublishedExams();
  }, [loadPublishedExams]);

  const handleOpenReport = async (examId: string) => {
    if (!user) return;
    setSelectedExamId(examId);
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const data = await examService.getStudentExamReport(examId, user.id);
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load exam report';
      setReportError(msg);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleCloseReport = () => {
    setSelectedExamId(null);
    setReport(null);
    setReportError(null);
  };

  const getExamTypeLabel = (type: string) => {
    const found = EXAM_TYPE_OPTIONS.find((t) => t.value === type);
    return found ? found.label : type.replace(/_/g, ' ').toUpperCase();
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
              title="Return to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Award className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Exams & Results</h1>
            </div>
          </div>
          <button
            onClick={loadPublishedExams}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh Published Exams"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* Information Banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-start space-x-3">
          <BookOpen className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-indigo-900">
            <p className="font-medium">Published Academic Assessment Results</p>
            <p className="text-indigo-700 mt-0.5">
              Review your verified evaluation marks, subject-wise scores, percentage, and official teacher feedback.
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Fetching published examination records...</p>
          </div>
        ) : exams.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm max-w-lg mx-auto mt-8">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Published Results Available</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              There are currently no published exams for your enrolled class. Results will appear here once verified and published by your faculty.
            </p>
          </div>
        ) : (
          /* Exam Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                onClick={() => handleOpenReport(exam.id)}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {getExamTypeLabel(exam.exam_type)}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Published
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {exam.title}
                  </h3>

                  {exam.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {exam.description}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-500">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.exam_date}</span>
                    </div>
                    {exam.class_level && (
                      <div className="flex items-center space-x-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.class_level.display_name}</span>
                      </div>
                    )}
                    {exam.exam_subjects && (
                      <div className="flex items-center space-x-1.5 font-medium text-slate-600">
                        <span>{exam.exam_subjects.length} {exam.exam_subjects.length === 1 ? 'Subject' : 'Subjects'}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-indigo-600 font-semibold pt-2">
                  <span>View Full Report Card</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Report Modal */}
      {selectedExamId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">Official Examination Report Card</h2>
              </div>
              <button
                onClick={handleCloseReport}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingReport ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium text-slate-600">Calculating academic performance metrics...</p>
                </div>
              ) : reportError ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
                  {reportError}
                </div>
              ) : report ? (
                <div className="space-y-6">
                  {/* Exam Title & Context */}
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {getExamTypeLabel(report.exam_type)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Conducted on {report.exam_date}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900">{report.exam_title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {report.board_name} • {report.class_name} {report.batch_name ? `• ${report.batch_name}` : ''}
                    </p>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Overall Status */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                      <span
                        className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          report.overall_status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : report.overall_status === 'FAILED'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : report.overall_status === 'ABSENT'
                            ? 'bg-gray-100 text-gray-800 border border-gray-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {report.overall_status}
                      </span>
                    </div>

                    {/* Total Marks */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Score</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        {report.total_obtained !== null ? report.total_obtained : '—'}{' '}
                        <span className="text-xs font-normal text-slate-500">/ {report.total_max}</span>
                      </p>
                    </div>

                    {/* Percentage */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Percentage</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        {report.percentage !== null ? `${report.percentage}%` : '—'}
                      </p>
                    </div>

                    {/* Grade */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Grade</p>
                      <p className="text-lg font-black text-indigo-600 mt-0.5">
                        {report.overall_grade || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Incomplete Warning if applicable */}
                  {!report.is_complete && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        Some subject assessments are pending final verification. Complete aggregated percentage and grade will appear once all subjects are finalized.
                      </span>
                    </div>
                  )}

                  {/* Subject Wise Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Subject-Wise Evaluation
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase">
                          <tr>
                            <th className="py-3 px-4">Subject</th>
                            <th className="py-3 px-3 text-center">Max</th>
                            <th className="py-3 px-3 text-center">Pass</th>
                            <th className="py-3 px-3 text-center">Obtained</th>
                            <th className="py-3 px-3 text-center">Status</th>
                            <th className="py-3 px-4">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.subject_scores.map((sc) => (
                            <tr key={sc.exam_subject_id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {sc.subject_name}
                                {sc.subject_code && (
                                  <span className="text-xs font-normal text-slate-400 block">
                                    {sc.subject_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center text-slate-600">{sc.max_marks}</td>
                              <td className="py-3 px-3 text-center text-slate-500">{sc.passing_marks}</td>
                              <td className="py-3 px-3 text-center font-bold">
                                {sc.attendance_status === 'absent' ? (
                                  <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                    ABSENT
                                  </span>
                                ) : sc.attendance_status === 'exempted' ? (
                                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                    EXEMPTED
                                  </span>
                                ) : sc.obtained_marks !== null ? (
                                  <span className={sc.result_status === 'passed' ? 'text-emerald-700' : 'text-red-600'}>
                                    {sc.obtained_marks}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">Pending</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {sc.result_status === 'passed' ? (
                                  <span className="inline-flex items-center text-emerald-700 text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pass
                                  </span>
                                ) : sc.result_status === 'failed' ? (
                                  <span className="inline-flex items-center text-red-600 text-xs font-semibold">
                                    <X className="w-3.5 h-3.5 mr-1" /> Fail
                                  </span>
                                ) : sc.result_status === 'absent' ? (
                                  <span className="text-xs text-red-500 font-medium">Absent</span>
                                ) : sc.result_status === 'exempted' ? (
                                  <span className="text-xs text-slate-500 font-medium">Exempted</span>
                                ) : (
                                  <span className="text-xs text-slate-400">Evaluating</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600 italic">
                                {sc.remarks || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
              <button
                onClick={handleCloseReport}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-sm font-semibold transition-colors"
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
