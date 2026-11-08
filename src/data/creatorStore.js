import { addAuditEvent } from './reviewStore.js';
export const CREATOR_DOCUMENTS_KEY = 'bg_creator_documents_v1';
export const CREATOR_SCAN_KEY = 'bg_creator_scans_v1';
export const CREATOR_SUBMISSIONS_KEY = 'bg_creator_submissions_v1';

const safeRead = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
const id = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const now = () => new Date().toISOString();

export function readCreatorDocuments() { return safeRead(CREATOR_DOCUMENTS_KEY, []); }
export function writeCreatorDocuments(items) { localStorage.setItem(CREATOR_DOCUMENTS_KEY, JSON.stringify(items)); }
export function readCreatorScans() { return safeRead(CREATOR_SCAN_KEY, []); }
export function writeCreatorScans(items) { localStorage.setItem(CREATOR_SCAN_KEY, JSON.stringify(items)); }
export function readCreatorSubmissions() { return safeRead(CREATOR_SUBMISSIONS_KEY, []); }

export function createCreatorDocument(user, title = 'Untitled document', content = '') {
  const timestamp = now();
  const created = {
    id: id('BGD'), title, content, creatorId: user?.email || user?.name || 'demo-creator',
    creatorName: user?.name || 'Demo Creator', creatorRole: user?.role || 'Creator', createdAt: timestamp, updatedAt: timestamp,
    status: 'Draft', scanResults: null, version: 1, versions: [], submissionId: null, lastCheckpointContent: content, lastCheckpointTitle: title, lastCheckpointAt: timestamp,
    dismissedIssues: {}, activity: [{ id: id('EVT'), type: 'created', label: 'Document created', at: timestamp }]
  };
  addAuditEvent(user, 'Document created', {id:created.id,title:created.title}, {documentId:created.id});
  return created;
}
export function saveCreatorDocument(document, all = readCreatorDocuments(), options = {}) {
  const previous = all.find(item => item.id === document.id);
  const next = {
    ...document, updatedAt: now(),
    version: options.newVersion ? (previous?.version || document.version || 1) + 1 : (previous?.version || document.version || 1)
  };
  if (previous && options.newVersion) {
    next.versions = [...(previous.versions || []), {
      version: previous.version || 1,
      title: previous.lastCheckpointTitle ?? previous.title,
      content: previous.lastCheckpointContent ?? previous.content,
      status: previous.status,
      savedAt: previous.lastCheckpointAt || previous.createdAt || previous.updatedAt,
      updatedBy: previous.creatorName || 'Creator', role: previous.creatorRole || 'Creator',
      scanResults: previous.lastCheckpointScanResults ?? previous.scanResults ?? null
    }];
    next.lastCheckpointAt = now();
  }
  const items = previous ? all.map(item => item.id === next.id ? next : item) : [next, ...all];
  writeCreatorDocuments(items);
  return next;
}
export function appendDocumentActivity(document, label, type = 'updated') {
  return { ...document, activity: [{ id: id('EVT'), type, label, at: now() }, ...(document.activity || [])].slice(0, 40) };
}
export function deleteCreatorDocument(documentId) {
  const items = readCreatorDocuments().filter(item => item.id !== documentId);
  writeCreatorDocuments(items);
  return items;
}
export function duplicateCreatorDocument(document, user) {
  const copy = createCreatorDocument(user, `${document.title} (Copy)`, document.content);
  copy.scanResults = document.scanResults;
  copy.activity = [{ id: id('EVT'), type: 'created', label: `Duplicated from ${document.title}`, at: now() }];
  return saveCreatorDocument(copy);
}
export function saveScanResult(documentId, result, actor = null) {
  const items = readCreatorScans();
  const scan = { ...result, id: id('SCAN'), documentId, scannedAt: now() };
  writeCreatorScans([scan, ...items].slice(0, 100));
  const doc=readCreatorDocuments().find(item=>item.id===documentId);
  addAuditEvent(actor, 'Document scanned', doc, {score:result?.score, issueCount:result?.issues?.length||0, criticalIssueCount:(result?.issues||[]).filter(i=>i.severity==='Critical').length});
  return scan;
}
export function submitCreatorDocument(document, user, scan) {
  if (user?.role !== 'Creator') throw new Error('Only Creator users can submit their own documents.');
  if (document && document.creatorId !== user?.email && document.creatorId !== user?.name) throw new Error('Creators can only submit documents they own.');
  if (!document || !scan) throw new Error('A document and completed scan are required for submission.');
  const records = readCreatorSubmissions();
  const previous = records.find(item => item.documentId === document.id && item.status === 'Changes Requested');
  if (previous) {
    previous.status = 'Resubmitted';
    previous.resubmittedAt = now();
  }
  const submission = {
    id: id('SUB'), documentId: document.id, documentTitle: document.title,
    creatorId: document.creatorId, creatorName: user?.name || document.creatorName,
    submittedAt: now(), version: document.version, status: 'In Review',
    previousSubmissionId: previous?.id || null,
    complianceScore: scan?.score ?? null, issues: scan?.issues || []
  };
  localStorage.setItem(CREATOR_SUBMISSIONS_KEY, JSON.stringify([submission, ...records]));
  addAuditEvent(user, previous?'Document resubmitted':'Document submitted', document, {version:submission.version, complianceScore:submission.complianceScore}, submission.id);
  return submission;
}
export function getCreatorDocument(documentId) {
  return readCreatorDocuments().find(item => item.id === documentId) || null;
}
