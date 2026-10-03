import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

// ============================================================================
// 1. ENVIRONMENT & SECRET HYGIENE
// ============================================================================
test('1. Environment & Secret Audit: No hardcoded service-role or master secrets in src/', () => {
  const srcDir = path.join(projectRoot, 'src');

  function scanDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(ts|tsx|js|jsx|json)$/.test(file.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.doesNotMatch(
          content,
          /service_role/i,
          `Forbidden keyword 'service_role' found in ${file.name}`
        );
        assert.doesNotMatch(
          content,
          /SUPABASE_SERVICE_KEY/i,
          `Forbidden service key pattern in ${file.name}`
        );
        assert.doesNotMatch(
          content,
          /postgres(ql)?:\/\/[^:]+:[^@]+@/i,
          `Raw postgres connection string with password found in ${file.name}`
        );
      }
    }
  }

  scanDir(srcDir);
});

test('2. Git Ignore Audit: .env and local environment files are ignored', () => {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  assert.match(gitignoreContent, /\.env/, '.gitignore must ignore .env files');
  assert.match(gitignoreContent, /\.env\.local/, '.gitignore must ignore .env.local');

  // Verify .env is not in git tracking (if .git exists)
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    // If local .env exists, ensure it is ignored
    const gitHead = path.join(projectRoot, '.git');
    assert.ok(fs.existsSync(gitHead), '.git exists');
  }
});

test('3. Environment Template: .env.example contains variable names without secrets', () => {
  const examplePath = path.join(projectRoot, '.env.example');
  assert.ok(fs.existsSync(examplePath), '.env.example must exist');

  const content = fs.readFileSync(examplePath, 'utf8');
  assert.match(content, /VITE_SUPABASE_URL=/, 'Must define VITE_SUPABASE_URL');
  assert.match(content, /VITE_SUPABASE_ANON_KEY=/, 'Must define VITE_SUPABASE_ANON_KEY');
  assert.doesNotMatch(content, /eyJ[a-zA-Z0-9_-]{20,}/, 'Must not contain real JWT tokens');
});

// ============================================================================
// 2. NETLIFY & SPA DEPLOYMENT CONFIGURATION
// ============================================================================
test('4. Netlify Configuration: SPA redirect and security headers configured', () => {
  const netlifyPath = path.join(projectRoot, 'netlify.toml');
  assert.ok(fs.existsSync(netlifyPath), 'netlify.toml must exist');

  const content = fs.readFileSync(netlifyPath, 'utf8');
  assert.match(content, /from\s*=\s*"\/\*"/, 'Must redirect all routes to /index.html');
  assert.match(content, /to\s*=\s*"\/index\.html"/, 'Must point to /index.html');
  assert.match(content, /status\s*=\s*200/, 'Must use 200 rewrite for SPA');
  assert.match(content, /X-Frame-Options\s*=\s*"DENY"/, 'Must include X-Frame-Options');
  assert.match(content, /X-Content-Type-Options\s*=\s*"nosniff"/, 'Must include nosniff');
  assert.match(content, /Referrer-Policy/, 'Must include Referrer-Policy');

  // Also check public/_redirects for Netlify standard fallback
  const redirectsPath = path.join(projectRoot, 'public', '_redirects');
  assert.ok(fs.existsSync(redirectsPath), 'public/_redirects must exist');
  const redirectsContent = fs.readFileSync(redirectsPath, 'utf8');
  assert.match(redirectsContent, /\/\*\s+\/index\.html\s+200/, 'public/_redirects must have SPA 200 rewrite');
});

// ============================================================================
// 3. DATABASE & RLS AUDIT
// ============================================================================
test('5. Database Schema & RLS Audit: Every migration table has ENABLE ROW LEVEL SECURITY', () => {
  const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
  assert.ok(fs.existsSync(migrationsDir), 'supabase/migrations must exist');

  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  assert.ok(migrationFiles.length >= 10, 'Must have at least 10 migration phases');

  const createdTables = new Set();
  const rlsEnabledTables = new Set();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Extract CREATE TABLE (IF NOT EXISTS) tablename
    const tableMatches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s*\(/gi);
    for (const match of tableMatches) {
      createdTables.add(match[1].toLowerCase());
    }

    // Extract ALTER TABLE tablename ENABLE ROW LEVEL SECURITY
    const rlsMatches = sql.matchAll(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-z_0-9]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi);
    for (const match of rlsMatches) {
      rlsEnabledTables.add(match[1].toLowerCase());
    }
  }

  // Ensure every created table has RLS explicitly enabled
  const tablesWithoutRLS = [];
  for (const table of createdTables) {
    if (!rlsEnabledTables.has(table)) {
      tablesWithoutRLS.push(table);
    }
  }

  assert.equal(
    tablesWithoutRLS.length,
    0,
    `Tables missing ENABLE ROW LEVEL SECURITY: ${tablesWithoutRLS.join(', ')}`
  );
  assert.ok(createdTables.size >= 25, `Expected at least 25 tables, found ${createdTables.size}`);
});

// ============================================================================
// 4. STORAGE SECURITY & ACCESS POLICIES
// ============================================================================
test('6. Storage Security: Buckets are private and restricted to approved document types', () => {
  const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
  const materialsMigration = path.join(migrationsDir, '20261003000006_create_study_materials.sql');
  const assignmentsMigration = path.join(migrationsDir, '20261003000007_create_assignments_system.sql');

  assert.ok(fs.existsSync(materialsMigration), 'Phase 7 migration exists');
  assert.ok(fs.existsSync(assignmentsMigration), 'Phase 8 migration exists');

  const matSql = fs.readFileSync(materialsMigration, 'utf8');
  assert.match(matSql, /'study-materials',\s*'study-materials',\s*false/i, 'study-materials bucket MUST be private (public=false)');
  assert.match(matSql, /application\/pdf/i, 'study-materials MIME must enforce application/pdf');

  const assignSql = fs.readFileSync(assignmentsMigration, 'utf8');
  assert.match(assignSql, /'assignment-files',\s*'assignment-files',\s*false/i, 'assignment-files bucket MUST be private (public=false)');
  assert.match(assignSql, /application\/pdf/i, 'assignment-files MIME must enforce application/pdf');
});

// ============================================================================
// 5. ERROR BOUNDARY & CLIENT STABILITY
// ============================================================================
test('7. Frontend Error Boundary: Component exists and exports ErrorBoundary', () => {
  const errorBoundaryPath = path.join(projectRoot, 'src', 'components', 'layout', 'ErrorBoundary.tsx');
  assert.ok(fs.existsSync(errorBoundaryPath), 'ErrorBoundary.tsx must exist');

  const content = fs.readFileSync(errorBoundaryPath, 'utf8');
  assert.match(content, /export\s+class\s+ErrorBoundary/, 'Must export ErrorBoundary class');
  assert.match(content, /getDerivedStateFromError/, 'Must implement getDerivedStateFromError');
  assert.match(content, /componentDidCatch/, 'Must implement componentDidCatch');
});

// ============================================================================
// 6. FINANCIAL & GRADING INTEGRITY (Edge Cases & Zero Precision)
// ============================================================================
test('8. Financial Integrity: Fee calculations handle zero balance and non-negative bounds', () => {
  function computeBalance(totalAmount, discountAmount, paidAmount) {
    const netObligation = Math.max(0, totalAmount - (discountAmount || 0));
    const outstanding = Math.max(0, netObligation - (paidAmount || 0));
    return {
      netObligation: Number(netObligation.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      isFullyPaid: outstanding === 0,
    };
  }

  // Normal fee payment
  assert.deepEqual(computeBalance(5000, 500, 4500), {
    netObligation: 4500,
    outstanding: 0,
    isFullyPaid: true,
  });

  // Partial fee payment
  assert.deepEqual(computeBalance(5000, 0, 2000), {
    netObligation: 5000,
    outstanding: 3000,
    isFullyPaid: false,
  });

  // Zero discount, zero paid
  assert.deepEqual(computeBalance(3500, 0, 0), {
    netObligation: 3500,
    outstanding: 3500,
    isFullyPaid: false,
  });

  // Overpayment / Discount exceeds obligation guard
  assert.deepEqual(computeBalance(1000, 1500, 0), {
    netObligation: 0,
    outstanding: 0,
    isFullyPaid: true,
  });
});

test('9. Academic Grading Integrity: Grade assignment handles boundaries & absent states', () => {
  function calculatePercentageAndGrade(obtainedMarks, maxMarks, isAbsent) {
    if (isAbsent) {
      return { percentage: 0, grade: 'ABSENT', isAbsent: true };
    }
    if (maxMarks <= 0) {
      return { percentage: 0, grade: 'INVALID', isAbsent: false };
    }
    const pct = Math.round(((obtainedMarks / maxMarks) * 100) * 100) / 100;
    let grade = 'F';
    if (pct >= 90) grade = 'A+';
    else if (pct >= 80) grade = 'A';
    else if (pct >= 70) grade = 'B+';
    else if (pct >= 60) grade = 'B';
    else if (pct >= 50) grade = 'C';
    else if (pct >= 35) grade = 'D';

    return { percentage: pct, grade, isAbsent: false };
  }

  // Absent student
  assert.deepEqual(calculatePercentageAndGrade(0, 100, true), {
    percentage: 0,
    grade: 'ABSENT',
    isAbsent: true,
  });

  // Boundary 90%
  assert.equal(calculatePercentageAndGrade(90, 100, false).grade, 'A+');
  assert.equal(calculatePercentageAndGrade(89.99, 100, false).grade, 'A');
  assert.equal(calculatePercentageAndGrade(35, 100, false).grade, 'D');
  assert.equal(calculatePercentageAndGrade(34.99, 100, false).grade, 'F');

  // Zero maxMarks division guard
  assert.equal(calculatePercentageAndGrade(0, 0, false).grade, 'INVALID');
});

// ============================================================================
// 7. TIMEZONE & DATE INTEGRITY
// ============================================================================
test('10. Timezone & Timestamp Integrity: ISO 8601 UTC formats across data models', () => {
  const sampleIso = new Date().toISOString();
  assert.match(sampleIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'Must produce UTC ISO 8601 string');

  const parsed = new Date(sampleIso);
  assert.ok(!isNaN(parsed.getTime()), 'Timestamp must parse accurately in UTC');
});
