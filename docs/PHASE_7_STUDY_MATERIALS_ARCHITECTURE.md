# Phase 7 — Production-Grade Study Materials & Document Management Architecture

## 1. Executive Summary & Design Principles

EduCamp Phase 7 establishes the production-grade foundation for managing and distributing educational resources (Lecture Notes, Chapter Booklets, Worksheets, Question Papers, and Practice Problem Sets) across multiple educational boards (CBSE, ICSE, BSEB, etc.), classes (1 through 12), subjects, batches, and academic years.

### Architectural Core Principles:
1. **Separation of Storage & Relational Metadata**: Binary document bytes (PDF files) are **never** stored inside PostgreSQL. Documents reside strictly in a private Supabase Storage bucket (`study-materials`). PostgreSQL stores only relational metadata, academic links, status, and storage keys.
2. **Private Document Storage with Zero Public Access**: The storage bucket is configured with `public = false`. Permanent public file links are forbidden. Access is granted strictly via short-lived (5-minute TTL) cryptographic signed URLs issued to authorized users.
3. **Database & Storage Double-Layer Authorization**: Access authorization is enforced at both the database row-level security (RLS) and storage object policy level. Knowing a storage key does not permit unauthorized download.
4. **Academic Authorization Enforcement**: Students can only discover and download materials belonging to their active, enrolled academic context (board, class, subject, and matching batch if batch-specific). Teachers can only upload and manage materials for academic contexts they are assigned to teach (`teacher_assignments`).
5. **Mobile-First & Lightweight Network Payload**: Browsing document listings loads strictly relational metadata and summary attributes. PDF documents are never fetched during listing, conserving mobile bandwidth.
6. **Upload Atomicity & Orphan File Protection**: Uploading a document is a two-step process (Storage upload followed by database insert). If database insertion fails, an automated rollback cleans up the uploaded file from storage, preventing orphaned objects.
7. **PWA Offline Safety**: The Service Worker workbox caching strategy explicitly avoids caching Supabase Storage signed URLs or PDF binaries, preventing unauthorized offline leakage.

---

## 2. Entity Relationship Diagram (ERD) & Conceptual Flow

```text
+-----------------------+
|     Academic Year     |
|   (academic_years)    |
+-----------+-----------+
            |
            | 1-to-Many
            v
+-----------+-----------+          +-----------------------+
|         Board         |          |      Class Level      |
|        (boards)       |          |    (class_levels)     |
+-----------+-----------+          +-----------+-----------+
            |                                  |
            +----------------+-----------------+
                             |
                             v
                  +-----------------------+
                  |      Board Class      |
                  |    (board_classes)    |
                  +-----------+-----------+
                              |
            +-----------------+-----------------+
            |                                   |
            v                                   v
+-----------------------+           +-----------------------+
|        Subject        |           |         Batch         |
|      (subjects)       |           |       (batches)       |
+-----------+-----------+           +-----------+-----------+
            |                                   |
            +----------------+------------------+
                             |
                             v
                  +-----------------------+
                  |    Study Material     |
                  |   (study_materials)   |
                  +-----------+-----------+
                              |
        +---------------------+---------------------+
        |                                           |
        v                                           v
+-----------------------+               +-----------------------+
|  PostgreSQL Metadata  |               |  Supabase Storage     |
|  (Relational Database)|               |  (Private Bucket)     |
+-----------------------+               +-----------+-----------+
                                                    |
                                                    | On-demand
                                                    v
                                        +-----------------------+
                                        |   Signed URL (5-min)  |
                                        +-----------+-----------+
                                                    |
                                                    v
                                        +-----------------------+
                                        |    Authorized User    |
                                        |   (Student / Teacher) |
                                        +-----------------------+
```

---

## 3. Storage Bucket Configuration & Security

- **Bucket ID**: `study-materials`
- **Bucket Visibility**: `public = false` (Private bucket; direct HTTP GET requests return `403 Forbidden`).
- **File Size Limit**: `26,214,400 bytes` (25 MB maximum per document).
- **Allowed MIME Types**: `['application/pdf']`.
- **Encryption**: Supabase AES-256 server-side encryption at rest.

---

## 4. Storage Path Design & Information Safety

To prevent namespace collisions, directory congestion, and data leakage, EduCamp utilizes a deterministic, hierarchical directory structure based strictly on stable UUIDs:

```text
study-materials/
  └── {academic_year_id}/
        └── {board_id}/
              └── {class_level_id}/
                    └── {subject_id}/
                          └── {material_id}/
                                └── {sanitized_filename}.pdf
```

### Privacy & PII Rules:
- **No Personal Identifiers in Paths**: Student names, phone numbers, roll numbers, or teacher names are **never** used in storage paths.
- **Stable UUIDs**: Paths rely on stable database keys (`academic_year_id`, `board_id`, `class_level_id`, `subject_id`, and `material_id`).
- **Sanitized Filenames**: User-provided file names are sanitized to alphanumeric characters, dashes, and underscores before forming the storage key.

---

## 5. Database Metadata Model (`study_materials`)

| Column Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique document identifier |
| `title` | `VARCHAR(200)` | NOT NULL | Human-readable document title |
| `description` | `TEXT` | Nullable | Optional syllabus notes or instructions |
| `material_type` | `VARCHAR(50)` | NOT NULL, CHECK in `('notes', 'chapter', 'worksheet', 'question_paper', 'practice', 'other')` | Controlled document category |
| `academic_year_id` | `UUID` | NOT NULL, FK `academic_years(id)` | Associated academic year |
| `board_id` | `UUID` | NOT NULL, FK `boards(id)` | Board identifier |
| `class_level_id` | `UUID` | NOT NULL, FK `class_levels(id)` | Class level identifier |
| `stream_id` | `UUID` | Nullable, FK `streams(id)` | Optional stream (Science, Commerce, etc.) |
| `subject_id` | `UUID` | NOT NULL, FK `subjects(id)` | Associated subject identifier |
| `batch_id` | `UUID` | Nullable, FK `batches(id)` | Null = available to all batches; populated = restricted to batch |
| `file_name` | `VARCHAR(255)` | NOT NULL | Original uploaded filename for client display |
| `storage_path` | `TEXT` | NOT NULL, UNIQUE | Relative path within `study-materials` bucket |
| `mime_type` | `VARCHAR(100)` | NOT NULL, CHECK = `'application/pdf'` | Content MIME type |
| `file_size_bytes` | `BIGINT` | NOT NULL, CHECK > 0 AND <= 26214400 | File size in bytes (max 25 MB) |
| `uploader_profile_id` | `UUID` | NOT NULL, FK `profiles(id)` | Faculty member or administrator who uploaded the file |
| `status` | `VARCHAR(30)` | NOT NULL, DEFAULT `'active'`, CHECK in `('active', 'archived')` | Lifecycle status |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | Auto-updated via trigger |

### Foreign Key Consistency Constraint:
```sql
CONSTRAINT fk_study_materials_board_class
  FOREIGN KEY (board_id, class_level_id)
  REFERENCES public.board_classes(board_id, class_level_id)
  ON DELETE RESTRICT
```

---

## 6. Controlled Material Types

EduCamp categorizes academic documents using a controlled enumeration rather than arbitrary free-text strings:

1. **`notes` (Lecture Notes)**: Class lectures, revision notes, and faculty presentations.
2. **`chapter` (Chapter PDF)**: Complete textbook chapters and module booklets.
3. **`worksheet` (Worksheet)**: Problem sheets, classroom drills, and graded exercises.
4. **`question_paper` (Question Paper)**: Previous year board exams, sample papers, and unit test question banks.
5. **`practice` (Practice Material)**: Daily Practice Problems (DPP) and reference drills.
6. **`other` (Other Academic Resource)**: Formula cheat-sheets, syllabus breakdowns, and lab manuals.

---

## 7. Academic Access & Authorization Model

### Student Access Model:
- **Visibility Condition**: A student can only view materials where:
  1. `study_materials.status = 'active'`
  2. The student has an active current enrollment (`is_current = true`, `status = 'enrolled'`) in the identical `academic_year_id`, `board_id`, and `class_level_id`.
  3. If the material specifies a `stream_id`, the student's enrollment stream must match.
  4. If the material specifies a `batch_id`, the student must be enrolled in that specific batch. If `batch_id IS NULL`, all students in that class level can access the document.
- **Restrictions**: Students cannot upload, modify, soft-delete, or archive study materials.

### Teacher Access Model:
- **Upload Authorization**: A teacher can only upload materials for an academic context (board, class, subject, batch) if they hold an active assignment in `teacher_assignments`.
- **Management**: A teacher can view and update metadata or archive materials they have authored or teach.
- **Cross-Subject Protection**: A Mathematics teacher cannot upload Physics or Chemistry materials unless explicitly assigned to those subjects in `teacher_assignments`.

### Administrator Access Model:
- System administrators (`role = 'admin'`) have universal management rights across all academic years, boards, classes, batches, and subjects.

---

## 8. Signed URL Generation & Expiration Strategy

1. **On-Demand Generation**: Signed URLs are generated **only** when a student or teacher clicks "Open PDF" or "Download".
2. **Short-Lived TTL**: Signed URLs are configured with an expiration lifetime of **300 seconds (5 minutes)**.
3. **Zero Database Persistence**: Signed URLs are **never** saved to PostgreSQL or client local storage. Each session or reopen generates a fresh temporary cryptographic signature.
4. **Storage Authorization Check**: When `createSignedUrl` is invoked, Supabase Storage verifies the user's JWT against `storage.objects` RLS policies. Unauthorized users receive an access denied error.

---

## 9. File Validation Rules & Size Limits

| Check | Specification | Enforced At |
| :--- | :--- | :--- |
| File Format | Strict PDF document (`.pdf`) | Client-side, DB trigger (`validate_study_material_consistency`), Storage bucket |
| MIME Type | `application/pdf` | Client-side, DB trigger, Storage bucket |
| Maximum File Size | 25 MB (`26,214,400 bytes`) | Client-side, DB constraint (`file_size_bytes <= 26214400`), Storage bucket |
| Empty Files | Blocked (`file_size_bytes > 0`) | Client-side, DB constraint |
| Executables / Scripts | Strictly prohibited | Supabase Storage bucket allowed MIME type whitelist |

---

## 10. Duplicate Prevention & Upload Idempotency

1. **Database Partial Unique Index**:
   ```sql
   CREATE UNIQUE INDEX idx_study_materials_prevent_duplicate
     ON public.study_materials (
       academic_year_id,
       board_id,
       class_level_id,
       subject_id,
       COALESCE(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
       COALESCE(batch_id, '00000000-0000-0000-0000-000000000000'::uuid),
       material_type,
       lower(trim(title))
     )
     WHERE status = 'active';
   ```
   This prevents accidental double-creation of active documents having the exact same title, type, and academic context.
2. **Client-Side Submit Locking**: The upload button enters a disabled loading state (`isUploading = true`) during processing, preventing duplicate submissions from double clicks.

---

## 11. Upload Failure Handling & Orphan-File Rollback

Storage uploads and database transactions run as separate distributed operations. To prevent orphaned files in Supabase Storage:

1. **Step 1**: Unique `material_id` generated on the client (`crypto.randomUUID()`).
2. **Step 2**: File uploaded to Supabase Storage at deterministic path.
3. **Step 3**: Metadata inserted into `study_materials` table.
4. **Step 4 (Rollback)**: If metadata insertion fails (e.g. database validation failure, duplicate title constraint, network disconnect), the client catch block immediately issues a storage removal call:
   ```typescript
   await supabase.storage.from('study-materials').remove([storagePath]);
   ```
   This ensures storage remains clean without dangling, unindexed binary files.

---

## 12. Soft-Delete & Lifecycle Management

- **No Casually Destructive Deletes**: Normal document retirement is executed by setting `status = 'archived'` (`archiveStudyMaterial`).
- **Student Privacy & Continuity**: Archived materials are automatically filtered out from student queries, while preserving educational history for audits, syllabus review, and teacher reference.
- **Future Garbage Collection**: A documented maintenance script can later prune archived files older than the retention period (e.g., 3 years) if required by institute storage budgets.

---

## 13. Query Performance & Pagination Strategy

- **Server-Side Pagination**: Materials catalog uses `.range(from, to)` with a default page size of 20 items.
- **Selective Column Projections**: The query requests only metadata columns (`title`, `description`, `material_type`, `file_size_bytes`, `created_at`, joined boards/classes/subjects).
- **Zero Binary Download on Browse**: No file binary is ever loaded during list queries.
- **Indexed Filter Expressions**: Dedicated B-Tree indexes on `academic_year_id`, `(board_id, class_level_id)`, `subject_id`, `batch_id`, `material_type`, and `status`.

---

## 14. PWA Cache Safety & Offline Strategy

- **Service Worker Review**: In `vite.config.ts`, Workbox runtime caching is restricted to Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
- **Supabase Storage Excluded**: Signed URLs (`/storage/v1/object/sign/...`) and educational PDF documents are **explicitly excluded** from service worker caching.
- **Offline Safety**: Documents remain strictly online-only under authenticated session control, ensuring institute-owned copyright materials are never leaked or cached offline on unauthorized or shared mobile devices.

---

## 15. Future Versioning Strategy

If curriculum revisions require versioning individual documents in future phases:
- A new `material_version` integer column can be introduced with a parent `root_material_id UUID`.
- Replaced PDFs will create a new storage object at `.../{new_material_id}/document.pdf` while archiving previous versions.
- For Phase 7, the foundation supports controlled soft-archival and metadata updates, fulfilling all current requirements cleanly without over-engineering.
