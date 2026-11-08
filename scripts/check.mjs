import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { demoUsers, documents, activities, severityData, trendData } from '../src/data/mockData.js';

assert.equal(demoUsers.length, 4, 'four demo roles must exist');
assert.deepEqual(demoUsers.map(user => user.role).sort(), ['Admin', 'Creator', 'Legal', 'Reviewer']);
for (const user of demoUsers) assert.ok(user.email && user.password && user.name);
assert.ok(documents.length >= 4 && activities.length >= 3);
assert.ok(severityData.length === 4 && trendData.length === 7);

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx|js)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk('src');
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    assert.ok(['.js', '.jsx', '.css'].some(ext => fs.existsSync(target + ext)) || fs.existsSync(target), `Missing import ${match[1]} in ${file}`);
  }
}
for (const route of ['/login', '/register', '/forgot-password', '/app', 'knowledge/:section?']) {
  assert.ok(fs.readFileSync('src/App.jsx', 'utf8').includes(route), `Missing route ${route}`);
}
const kb = fs.readFileSync('src/pages/KnowledgeBasePage.jsx', 'utf8');
for (const section of ['overview','brand-bible','facts','terminology','assets','versions']) assert.ok(kb.includes(section), `Missing knowledge-base section ${section}`);
const store = fs.readFileSync('src/data/knowledgeBaseStore.js', 'utf8');
for (const api of ['getApprovedFacts','getTerminologyRules','getBrandReferenceData']) assert.ok(store.includes(api), `Missing shared data API ${api}`);
assert.ok(fs.readFileSync('src/components/layout/AppLayout.jsx','utf8').includes("'/app/knowledge/overview'"), 'Knowledge Base must be linked from role navigation');

const creator = fs.readFileSync('src/pages/CreatorWorkspacePage.jsx', 'utf8');
for (const feature of ['Scan document','Submit for review','Accept','Dismiss','Restore original','Pre-submission review','Image compliance check','contentEditable','Version history']) assert.ok(creator.includes(feature), `Missing Creator Workspace feature ${feature}`);
for (const route of ['my-documents','create/:documentId?']) assert.ok(fs.readFileSync('src/App.jsx','utf8').includes(route), `Missing Creator route ${route}`);
const scanner = fs.readFileSync('src/data/brandScanner.js','utf8');
for (const api of ['getApprovedFacts','getTerminologyRules','Unsupported claims','Accessibility issues','No approved source found']) assert.ok(scanner.includes(api), `Missing deterministic scanner capability ${api}`);
const creatorStore = fs.readFileSync('src/data/creatorStore.js','utf8');
for (const key of ['bg_creator_documents_v1','bg_creator_scans_v1','bg_creator_submissions_v1']) assert.ok(creatorStore.includes(key), `Missing Creator persistence key ${key}`);


const reviewer = fs.readFileSync('src/pages/ReviewerWorkspacePage.jsx', 'utf8');
for (const feature of ['Review Queue','Submitted document','Approved Documents','Changes Requested','Revision History','Audit Trail','No approved source found','Request changes','Send to Legal','markDocumentPublished','Legal assessment','Version comparison']) assert.ok(reviewer.includes(feature), `Missing Reviewer/Legal feature ${feature}`);
for (const route of ['queue','review/:submissionId','approved','changes-requested','revisions','audit','legal-reviews']) assert.ok(fs.readFileSync('src/App.jsx','utf8').includes(route), `Missing Part 4 route ${route}`);
const reviewStore = fs.readFileSync('src/data/reviewStore.js','utf8');
for (const key of ['bg_review_comments_v1','bg_review_decisions_v1','bg_legal_decisions_v1','bg_critical_overrides_v1','bg_audit_events_v1']) assert.ok(reviewStore.includes(key), `Missing review workflow persistence key ${key}`);
const creatorScene = creator;
assert.ok(creatorScene.includes('ScanSceneBoundary') && creatorScene.includes('useReducedMotion'), 'Creator scan animation needs a WebGL fallback and reduced-motion support');
assert.ok(fs.readFileSync('src/styles/global.css','utf8').includes('.cw-scan-webgl-fallback'), 'Missing Creator scan WebGL fallback styling');
assert.ok(reviewStore.includes('Critical issue overridden by'), 'Missing Critical override audit event');
for (const api of ['approveSubmission','requestDocumentChanges','sendToLegal','recordLegalDecision','recordOverride','markDocumentPublished','addReviewComment','setCommentResolved']) assert.ok(reviewStore.includes(`function ${api}`), `Missing review workflow API ${api}`);

console.log(`PASS: ${demoUsers.length} demo roles, mock data, ${sourceFiles.length} JS/JSX modules, local imports, Part 1 routes and Part 2 knowledge-base integration, Creator Workspace, deterministic scanner, Reviewer/Legal routes and workflow persistence contract.`);
