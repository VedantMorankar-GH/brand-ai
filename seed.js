import { getDb, uid } from './database.js';
import bcrypt from 'bcryptjs';

const demoUsers = [
  { name: 'Alex Morgan', email: 'creator@brandguard.ai', password: 'creator123', role: 'Creator', initials: 'AM', department: 'Marketing' },
  { name: 'Jordan Lee', email: 'reviewer@brandguard.ai', password: 'reviewer123', role: 'Reviewer', initials: 'JL', department: 'Content' },
  { name: 'Taylor Smith', email: 'admin@brandguard.ai', password: 'admin123', role: 'Admin', initials: 'TS', department: 'Operations' },
  { name: 'Morgan Chen', email: 'legal@brandguard.ai', password: 'legal123', role: 'Legal', initials: 'MC', department: 'Legal' }
];

const sampleFacts = [
  { id: 'FACT-1', title: 'Company Founding Year', category: 'Company', statement: 'Northstar Studio was founded in 2019.', source: 'Corporate filing', status: 'Active', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 90 * 86400000).toISOString() },
  { id: 'FACT-2', title: 'Market Presence', category: 'Business', statement: 'Northstar Studio operates in 12 markets across North America and Europe.', source: 'Annual report 2025', status: 'Active', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 'FACT-3', title: 'Customer Satisfaction', category: 'Performance', statement: 'Customer satisfaction score of 94% based on Q3 2026 survey.', source: 'Q3 2026 NPS Survey', status: 'Active', until: '2027-03-31', addedBy: 'Alex Morgan', addedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: 'FACT-4', title: 'Employee Count (Outdated)', category: 'Company', statement: 'The company has 450 employees worldwide.', source: 'HR records 2024', status: 'Outdated', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 365 * 86400000).toISOString() }
];

const sampleTerminology = [
  { id: 'TERM-1', term: 'cheap', type: 'Banned', replacement: 'cost-effective', explanation: 'Avoid the word "cheap" as it implies low quality. Use "cost-effective" or "affordable" instead.' },
  { id: 'TERM-2', term: 'clients', type: 'Preferred', replacement: 'customers', explanation: 'We refer to the people we serve as "customers" across all content.' },
  { id: 'TERM-3', term: 'Northstar', type: 'Alias', replacement: 'Northstar Studio', explanation: 'Always use the full brand name "Northstar Studio" in external communications.' },
  { id: 'TERM-4', term: 'synergy', type: 'Banned', replacement: 'collaboration', explanation: 'Avoid corporate jargon. Use plain language like "collaboration" or "partnership".' },
  { id: 'TERM-5', term: 'leverage', type: 'Banned', replacement: 'use', explanation: 'Use simple language. Replace "leverage" with "use" or "apply".' }
];

const sampleDocuments = [
  { id: 'BRAND-1', name: 'Brand Voice Guidelines', description: 'Core tone, voice, and messaging principles for all Northstar Studio communications.', version: '2.1', category: 'Brand Voice', status: 'Active', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 120 * 86400000).toISOString() },
  { id: 'BRAND-2', name: 'Visual Identity Standards', description: 'Logo usage, colour palette, typography, and layout specifications.', version: '3.0', category: 'Visual Identity', status: 'Active', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 90 * 86400000).toISOString() }
];

const sampleAssets = [
  { id: 'ASSET-1', name: 'Primary Logo - Dark', category: 'Logo', format: 'SVG', status: 'Approved', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 100 * 86400000).toISOString() },
  { id: 'ASSET-2', name: 'Primary Logo - Light', category: 'Logo', format: 'SVG', status: 'Approved', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 100 * 86400000).toISOString() },
  { id: 'ASSET-3', name: 'Brand Icon', category: 'Icon', format: 'PNG', status: 'Approved', addedBy: 'Taylor Smith', addedAt: new Date(Date.now() - 80 * 86400000).toISOString() }
];

const sampleColors = [
  { name: 'Primary Blue', hex: '#2563EB', usage: 'Primary actions, headings, links' },
  { name: 'Success Green', hex: '#16A34A', usage: 'Success states, positive indicators' },
  { name: 'Warning Amber', hex: '#D97706', usage: 'Warnings, attention items' },
  { name: 'Error Red', hex: '#DC2626', usage: 'Errors, critical issues' },
  { name: 'Neutral Gray', hex: '#6B7280', usage: 'Body text, secondary content' }
];

export async function seed() {
  const db = getDb();

  // Check if already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding database...');

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role, department, status, initials, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, datetime('now', ?))
  `);

  const seedAll = db.transaction(() => {
    for (let i = 0; i < demoUsers.length; i++) {
      const u = demoUsers[i];
      const hashed = bcrypt.hashSync(u.password, 10);
      insertUser.run(
        `USR-${i + 1}`, u.name, u.email, hashed, u.role, u.department,
        u.initials, `-${(i + 2) * 30} days`
      );
    }

    // Seed knowledge base
    db.prepare(`
      UPDATE knowledge_base SET
        documents = ?, facts = ?, terminology = ?, assets = ?, colors = ?,
        typography = ?, logo_guidelines = ?, updated_at = datetime('now')
      WHERE id = 'main'
    `).run(
      JSON.stringify(sampleDocuments),
      JSON.stringify(sampleFacts),
      JSON.stringify(sampleTerminology),
      JSON.stringify(sampleAssets),
      JSON.stringify(sampleColors),
      JSON.stringify({ primary: 'Inter', secondary: 'Georgia', mono: 'JetBrains Mono' }),
      JSON.stringify({ minClearSpace: '2x', minSize: '24px', doNots: ['Do not stretch', 'Do not rotate', 'Do not change colors'] })
    );

    // Add a knowledge version snapshot
    db.prepare(`INSERT INTO knowledge_versions (version_number, label, changed_by, snapshot) VALUES (1, 'Initial brand guidelines', 'Taylor Smith', ?)`).run(
      JSON.stringify({ documents: sampleDocuments, facts: sampleFacts, terminology: sampleTerminology, assets: sampleAssets })
    );

    // Add initial audit event
    db.prepare(`INSERT INTO audit_events (id, action, user_id, user_name, role, details) VALUES (?, ?, ?, ?, ?, ?)`).run(
      uid('AUD'), 'Database seeded with demo data', 'admin@brandguard.ai', 'Taylor Smith', 'Admin', '{}'
    );
  });

  seedAll();
  console.log(`Seeded ${demoUsers.length} users, knowledge base, and sample data.`);
}

// Run directly
seed().catch(console.error);

