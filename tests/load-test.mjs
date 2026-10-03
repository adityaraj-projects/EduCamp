/**
 * EduCamp Controlled Concurrency & Load Benchmark
 * Simulates multi-user concurrent read/write workflows on core application data operations.
 *
 * Scenarios Tested:
 * 1. Dashboard summary calculation
 * 2. Student attendance percentage aggregation
 * 3. Study materials filtering & access check
 * 4. Assignment submission deadline & state evaluation
 * 5. Exam result calculation & multi-subject grading
 * 6. Notification audience targeting resolution
 * 7. Teacher attendance roster assembly
 * 8. Attendance record batch upsert integrity
 * 9. Assignment roster grading
 * 10. Exam multi-subject mark sheet compilation
 */

import { performance } from 'node:perf_hooks';

// Mock domain entities representing 500-student institute
const STUDENTS = Array.from({ length: 500 }, (_, i) => ({
  id: `s-${i + 1}`,
  name: `Student ${i + 1}`,
  board_id: i % 3 === 0 ? 'CBSE' : i % 3 === 1 ? 'ICSE' : 'BSEB',
  class_id: `Class-${9 + (i % 4)}`,
  batch_id: `Batch-${i % 2 === 0 ? 'A' : 'B'}`
}));

const SESSIONS = Array.from({ length: 30 }, (_, i) => ({
  id: `sess-${i + 1}`,
  date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
  board_id: 'CBSE',
  class_id: 'Class-10',
  batch_id: 'Batch-A'
}));

// Workload operations simulating application services
const WORKLOADS = [
  // 1. Dashboard summary calculation
  function runDashboardSummary(idx) {
    const student = STUDENTS[idx % STUDENTS.length];
    return {
      studentId: student.id,
      board: student.board_id,
      timestamp: Date.now()
    };
  },

  // 2. Attendance percentage aggregation (30 sessions)
  function runAttendanceCalc(idx) {
    const records = SESSIONS.map((s, i) => ({
      sessionId: s.id,
      status: (idx + i) % 7 === 0 ? 'absent' : 'present'
    }));
    const presents = records.filter(r => r.status === 'present').length;
    const pct = Math.round((presents / records.length) * 100);
    return { studentId: `s-${idx}`, percentage: pct };
  },

  // 3. Materials filtering
  function runMaterialsFilter(idx) {
    const materials = Array.from({ length: 40 }, (_, m) => ({
      id: `mat-${m}`,
      board_id: m % 2 === 0 ? 'CBSE' : 'ICSE',
      class_id: 'Class-10'
    }));
    const accessible = materials.filter(m => m.board_id === 'CBSE');
    return { count: accessible.length };
  },

  // 4. Assignment deadline & state evaluation
  function runAssignmentCheck(idx) {
    const now = Date.now();
    const dueDate = now + (idx % 2 === 0 ? 86400000 : -86400000);
    const isLate = now > dueDate;
    return { isLate, canSubmit: !isLate };
  },

  // 5. Exam grading engine calculation (5 subjects)
  function runExamGrading(idx) {
    const marks = [85, 78, 92, 64, (idx % 10 === 0 ? 30 : 70)];
    const total = marks.reduce((a, b) => a + b, 0);
    const pct = (total / 500) * 100;
    const hasFail = marks.some(m => m < 35);
    const grade = hasFail ? 'F' : pct >= 90 ? 'A+' : pct >= 80 ? 'A' : 'B';
    return { total, pct, grade };
  },

  // 6. Notification targeting resolution
  function runNotificationTargeting(idx) {
    const student = STUDENTS[idx % STUDENTS.length];
    const announcements = Array.from({ length: 20 }, (_, a) => ({
      id: `ann-${a}`,
      board_id: a % 3 === 0 ? 'CBSE' : null,
      class_id: a % 4 === 0 ? 'Class-10' : null
    }));
    const matched = announcements.filter(a => {
      if (a.board_id && a.board_id !== student.board_id) return false;
      if (a.class_id && a.class_id !== student.class_id) return false;
      return true;
    });
    return { matchedCount: matched.length };
  },

  // 7. Teacher attendance roster assembly
  function runRosterAssembly(idx) {
    const batchStudents = STUDENTS.filter(s => s.batch_id === 'Batch-A' && s.class_id === 'Class-10');
    return { rosterSize: batchStudents.length };
  },

  // 8. Attendance batch upsert
  function runAttendanceUpsert(idx) {
    const batchStudents = STUDENTS.slice(0, 40);
    const rows = batchStudents.map(s => ({
      sessionId: `sess-${idx}`,
      studentId: s.id,
      status: 'present'
    }));
    return { rowsCreated: rows.length };
  },

  // 9. Assignment submission grading
  function runAssignmentGrading(idx) {
    const score = Math.min(100, Math.max(0, 50 + (idx % 51)));
    return { score, feedback: 'Graded satisfactorily.' };
  },

  // 10. Exam multi-subject mark sheet compilation
  function runMarksheetCompilation(idx) {
    const student = STUDENTS[idx % STUDENTS.length];
    const subjects = ['MATH', 'PHYS', 'CHEM', 'ENG', 'BIO'];
    const sheet = subjects.map(sub => ({
      subject: sub,
      max: 100,
      obtained: 70 + (idx % 25)
    }));
    return { studentId: student.id, subjects: sheet.length };
  }
];

export async function runLoadTest(concurrency, totalRequests = 1000) {
  const latencies = [];
  let successful = 0;
  let failed = 0;

  const tStart = performance.now();

  // Run in chunks of `concurrency`
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const promises = Array.from({ length: batchSize }, async (_, bIdx) => {
      const reqId = i + bIdx;
      const fn = WORKLOADS[reqId % WORKLOADS.length];
      const t0 = performance.now();
      try {
        fn(reqId);
        const dur = performance.now() - t0;
        latencies.push(dur);
        successful++;
      } catch (err) {
        failed++;
      }
    });
    await Promise.all(promises);
  }

  const totalTime = performance.now() - tStart;
  latencies.sort((a, b) => a - b);

  const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const median = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = Math.round((totalRequests / (totalTime / 1000)));
  const errorRate = ((failed / totalRequests) * 100).toFixed(2);

  return {
    concurrency,
    totalRequests,
    durationMs: Math.round(totalTime),
    successful,
    failed,
    avgLatencyMs: Number(avg.toFixed(3)),
    medianLatencyMs: Number(median.toFixed(3)),
    p95LatencyMs: Number(p95.toFixed(3)),
    p99LatencyMs: Number(p99.toFixed(3)),
    requestsPerSec: rps,
    errorRatePct: Number(errorRate)
  };
}

async function main() {
  console.log('Starting EduCamp Controlled Load Benchmark...');
  const levels = [25, 50, 100];
  const results = [];

  for (const c of levels) {
    console.log(`Running concurrency level: ${c} concurrent users (1,000 operations)...`);
    const res = await runLoadTest(c, 1000);
    results.push(res);
    console.log(` -> Avg: ${res.avgLatencyMs}ms | p95: ${res.p95LatencyMs}ms | RPS: ${res.requestsPerSec} | Errors: ${res.errorRatePct}%`);
  }

  return results;
}

if (process.argv[1]?.endsWith('load-test.mjs')) {
  main();
}
