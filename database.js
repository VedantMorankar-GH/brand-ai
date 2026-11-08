import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'brandguard.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Creator','Reviewer','Admin','Legal')),
      department TEXT DEFAULT 'Unassigned',
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      initials TEXT,
      joined_at TEXT DEFAULT (datetime('now')),
      last_activity TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled document',
      content TEXT DEFAULT '',
      creator_id TEXT NOT NULL,
      creator_name TEXT,
      creator_role TEXT DEFAULT 'Creator',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'Draft',
      version INTEGER DEFAULT 1,
      submission_id TEXT,
      type TEXT DEFAULT 'Content',
      department TEXT DEFAULT 'Unassigned',
      scan_results TEXT,
      dismissed_issues TEXT DEFAULT '{}',
      last_checkpoint_content TEXT,
      last_checkpoint_title TEXT,
      last_checkpoint_at TEXT,
      last_checkpoint_scan_results TEXT,
      reviewer_id TEXT,
      reviewer_name TEXT,
      approved_at TEXT,
      approved_version INTEGER,
      publication_status TEXT,
      review_decision TEXT,
      changes_requested_at TEXT,
      changes_requested_reason TEXT,
      reviewed_submission_id TEXT,
      legal_status TEXT,
      legal_reviewer_id TEXT,
      legal_reviewer_name TEXT,
      legal_reviewed_at TEXT,
      legal_comment TEXT,
      legal_reason TEXT,
      legal_requested_at TEXT,
      published_at TEXT,
      published_by TEXT,
      FOREIGN KEY (creator_id) REFERENCES users(email)
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT,
      content TEXT,
      status TEXT,
      saved_at TEXT,
      updated_by TEXT,
      role TEXT,
      scan_results TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_activity (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT,
      at TEXT DEFAULT (datetime('now')),
      user_name TEXT,
      role TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      document_title TEXT,
      document_type TEXT DEFAULT 'Content',
      creator_id TEXT NOT NULL,
      creator_name TEXT,
      department TEXT DEFAULT 'Unassigned',
      submitted_at TEXT DEFAULT (datetime('now')),
      version INTEGER,
      status TEXT DEFAULT 'In Review',
      previous_submission_id TEXT,
      compliance_score INTEGER,
      issues TEXT DEFAULT '[]',
      reviewer_id TEXT,
      reviewer_name TEXT,
      reviewed_at TEXT,
      reviewed_version INTEGER,
      review_comment TEXT,
      legal_status TEXT,
      legal_reviewer_id TEXT,
      legal_reviewer_name TEXT,
      legal_reviewed_at TEXT,
      legal_comment TEXT,
      legal_requested_by TEXT,
      legal_requested_at TEXT,
      legal_reason TEXT,
      publication_status TEXT,
      published_at TEXT,
      published_by TEXT,
      resubmitted_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      score INTEGER,
      issues TEXT DEFAULT '[]',
      scanned_text_length INTEGER,
      category_breakdown TEXT,
      severity_breakdown TEXT,
      source_coverage INTEGER,
      evidence_breakdown TEXT,
      engine TEXT,
      notes TEXT,
      scanned_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      submission_id TEXT,
      document_id TEXT,
      parent_id TEXT,
      kind TEXT DEFAULT 'general',
      anchor_text TEXT DEFAULT '',
      body TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT,
      role TEXT DEFAULT 'User',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      FOREIGN KEY (submission_id) REFERENCES submissions(id),
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS review_decisions (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      document_id TEXT,
      decision TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      role TEXT,
      at TEXT DEFAULT (datetime('now')),
      version INTEGER,
      comment TEXT DEFAULT '',
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    );

    CREATE TABLE IF NOT EXISTS legal_decisions (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      document_id TEXT,
      decision TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      role TEXT,
      comment TEXT DEFAULT '',
      at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    );

    CREATE TABLE IF NOT EXISTS overrides (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      document_id TEXT,
      issue_id TEXT NOT NULL,
      issue_title TEXT,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      role TEXT,
      reason TEXT NOT NULL,
      at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (submission_id) REFERENCES submissions(id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      document_id TEXT,
      document_title TEXT,
      submission_id TEXT,
      user_id TEXT,
      user_name TEXT,
      role TEXT DEFAULT 'System',
      at TEXT DEFAULT (datetime('now')),
      details TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY DEFAULT 'main',
      documents TEXT DEFAULT '[]',
      facts TEXT DEFAULT '[]',
      terminology TEXT DEFAULT '[]',
      assets TEXT DEFAULT '[]',
      colors TEXT DEFAULT '[]',
      typography TEXT DEFAULT '{}',
      logo_guidelines TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_number INTEGER,
      label TEXT,
      changed_by TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      snapshot TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'main',
      organization TEXT DEFAULT '{}',
      appearance TEXT DEFAULT '{}',
      notifications TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      user_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      PRIMARY KEY (user_id, notification_id)
    );
  `);

  // Ensure default knowledge base row exists
  const kb = db.prepare('SELECT id FROM knowledge_base WHERE id = ?').get('main');
  if (!kb) {
    db.prepare('INSERT INTO knowledge_base (id) VALUES (?)').run('main');
  }

  // Ensure default settings row exists
  const s = db.prepare('SELECT id FROM settings WHERE id = ?').get('main');
  if (!s) {
    db.prepare(`INSERT INTO settings (id, organization, appearance, notifications) VALUES (?, ?, ?, ?)`).run(
      'main',
      JSON.stringify({ name: 'Northstar Studio', description: 'A collaborative workspace for trusted, consistent brand communication.', website: '', logoName: '' }),
      JSON.stringify({ theme: 'light', compact: false }),
      JSON.stringify({ documents: true, reviews: true, approvals: true, legal: true })
    );
  }
}

export function uid(prefix = 'ID') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

