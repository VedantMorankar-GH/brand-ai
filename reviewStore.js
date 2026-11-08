export const REVIEW_COMMENTS_KEY = 'bg_review_comments_v1';
export const REVIEW_DECISIONS_KEY = 'bg_review_decisions_v1';
export const LEGAL_DECISIONS_KEY = 'bg_legal_decisions_v1';
export const OVERRIDES_KEY = 'bg_critical_overrides_v1';
export const AUDIT_EVENTS_KEY = 'bg_audit_events_v1';

const read = (key, fallback = []) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const now = () => new Date().toISOString();

export const readSubmissions = () => read('bg_creator_submissions_v1');
export const writeSubmissions = items => write('bg_creator_submissions_v1', items);
export const readDocuments = () => read('bg_creator_documents_v1');
export const writeDocuments = items => write('bg_creator_documents_v1', items);
export const readComments = () => read(REVIEW_COMMENTS_KEY);
export const readDecisions = () => read(REVIEW_DECISIONS_KEY);
export const readLegalDecisions = () => read(LEGAL_DECISIONS_KEY);
export const readOverrides = () => read(OVERRIDES_KEY);
export const readAuditEvents = () => read(AUDIT_EVENTS_KEY);

export function addAuditEvent(actor, action, document, details = {}, submissionId = null) {
  const events = readAuditEvents();
  const event = {
    id: uid('AUD'), action, documentId: document?.id || details.documentId || null,
    documentTitle: document?.title || details.documentTitle || 'Unknown document',
    submissionId, userId: actor?.email || actor?.name || 'system',
    userName: actor?.name || 'System', role: actor?.role || 'System',
    at: now(), details: structuredCloneSafe(details)
  };
  // Append-only through the application UI; no edit/delete operation is exposed.
  write(AUDIT_EVENTS_KEY, [event, ...events]);
  if(typeof window!=='undefined')window.dispatchEvent(new Event('bg_audit_updated'));
  return event;
}
const structuredCloneSafe = value => JSON.parse(JSON.stringify(value ?? {}));

export function updateSubmission(submissionId, patch) {
  const items = readSubmissions();
  const index = items.findIndex(item => item.id === submissionId);
  if (index < 0) return null;
  items[index] = { ...items[index], ...patch, updatedAt: now() };
  writeSubmissions(items);
  return items[index];
}
export function getReviewBundle(submissionId) {
  const submission = readSubmissions().find(item => item.id === submissionId);
  if (!submission) return null;
  const document = readDocuments().find(item => item.id === submission.documentId) || null;
  return { submission, document };
}
export function addReviewComment({ submissionId, documentId, actor, body, kind = 'general', anchorText = '', parentId = null }) {
  const comments = readComments();
  const comment = {
    id: uid('CMT'), submissionId, documentId, parentId, kind,
    anchorText: kind === 'anchored' ? String(anchorText || '').slice(0, 500) : '',
    body: String(body || '').trim(), authorId: actor?.email || actor?.name || 'unknown',
    authorName: actor?.name || 'Workspace user', role: actor?.role || 'User',
    createdAt: now(), updatedAt: now(), resolved: false, resolvedAt: null, resolvedBy: null
  };
  write(REVIEW_COMMENTS_KEY, [comment, ...comments]);
  const doc = readDocuments().find(item => item.id === documentId);
  addAuditEvent(actor, parentId ? 'Comment reply added' : 'Comment added', doc, { commentId: comment.id, kind, anchorText: comment.anchorText }, submissionId);
  return comment;
}
export function editReviewComment(commentId, actor, body) {
  const comments = readComments();
  const index = comments.findIndex(item => item.id === commentId);
  if (index < 0 || comments[index].authorId !== (actor?.email || actor?.name)) return null;
  comments[index] = { ...comments[index], body: String(body || '').trim(), updatedAt: now() };
  write(REVIEW_COMMENTS_KEY, comments);
  addAuditEvent(actor, 'Comment edited', readDocuments().find(d => d.id === comments[index].documentId), { commentId });
  return comments[index];
}
export function setCommentResolved(commentId, actor, resolved) {
  const comments = readComments();
  const index = comments.findIndex(item => item.id === commentId);
  if (index < 0) return null;
  comments[index] = { ...comments[index], resolved: !!resolved, resolvedAt: resolved ? now() : null, resolvedBy: resolved ? (actor?.name || actor?.email) : null };
  write(REVIEW_COMMENTS_KEY, comments);
  addAuditEvent(actor, resolved ? 'Comment resolved' : 'Comment reopened', readDocuments().find(d => d.id === comments[index].documentId), { commentId });
  return comments[index];
}
export function recordOverride({ submissionId, documentId, issue, actor, reason }) {
  if (!reason?.trim()) throw new Error('An override reason is required.');
  if (!['Reviewer', 'Legal'].includes(actor?.role)) throw new Error('Only Reviewer or Legal roles may override critical issues.');
  const activeSubmission=readSubmissions().find(item=>item.id===submissionId);
  if (!activeSubmission) throw new Error('Submission not found.');
  if (actor.role==='Reviewer'&&!['In Review','Submitted'].includes(activeSubmission.status)) throw new Error('Reviewer overrides are only available during active review.');
  if (actor.role==='Legal'&&activeSubmission.status!=='In Legal Review') throw new Error('Legal overrides are only available during Legal review.');
  const overrides = readOverrides();
  const record = {
    id: uid('OVR'), submissionId, documentId, issueId: issue.id, issueTitle: issue.title,
    actorId: actor.email || actor.name, actorName: actor.name, role: actor.role,
    reason: reason.trim(), at: now()
  };
  write(OVERRIDES_KEY, [record, ...overrides]);
  const doc = readDocuments().find(item => item.id === documentId);
  addAuditEvent(actor, `Critical issue overridden by ${actor.role}`, doc, { issueId: issue.id, issueTitle: issue.title, reason: record.reason }, submissionId);
  return record;
}
export function getOverridesForSubmission(submissionId) {
  return readOverrides().filter(item => item.submissionId === submissionId);
}
export function approveSubmission(submissionId, actor) {
  if (actor?.role !== 'Reviewer') throw new Error('Only Reviewer users can approve documents.');
  const bundle = getReviewBundle(submissionId);
  if (!bundle) throw new Error('Submission not found.');
  const { submission, document } = bundle;
  if (!['In Review','Submitted'].includes(submission.status)) throw new Error('Only submissions awaiting Reviewer review can be approved.');
  const overrides = getOverridesForSubmission(submissionId);
  const critical = (submission.issues || []).filter(issue => issue.severity === 'Critical' && issue.status !== 'Resolved');
  const missing = critical.filter(issue => !overrides.some(item => item.issueId === issue.id));
  if (missing.length) throw new Error(`${missing.length} Critical issue(s) still require resolution or a reasoned override.`);
  const updated = updateSubmission(submissionId, {
    status: 'Approved', reviewerId: actor.email, reviewerName: actor.name,
    reviewedAt: now(), reviewedVersion: submission.version,
    complianceScore: submission.complianceScore
  });
  const docs = readDocuments();
  const index = docs.findIndex(item => item.id === submission.documentId);
  let updatedDoc = document;
  if (index >= 0) {
    updatedDoc = { ...docs[index], status: 'Approved', reviewerId: actor.email, reviewerName: actor.name,
      approvedAt: now(), approvedVersion: submission.version, publicationStatus: 'Not published',
      reviewDecision: 'Approved' };
    updatedDoc.activity = [{ id: uid('EVT'), type: 'approved', label: `Approved by ${actor.name}`, at: now() }, ...(updatedDoc.activity || [])];
    docs[index] = updatedDoc; writeDocuments(docs);
  }
  write(REVIEW_DECISIONS_KEY, [{ id: uid('DEC'), submissionId, documentId: submission.documentId, decision: 'Approved', actorId: actor.email, actorName: actor.name, role: actor.role, at: now(), version: submission.version, comment: '' }, ...readDecisions()]);
  addAuditEvent(actor, 'Document approved', updatedDoc, { version: submission.version, overrideCount: overrides.length }, submissionId);
  return { submission: updated, document: updatedDoc };
}
export function requestDocumentChanges(submissionId, actor, comment) {
  if (actor?.role !== 'Reviewer') throw new Error('Only Reviewer users can request changes.');
  if (!comment?.trim()) throw new Error('A review comment is required when requesting changes.');
  const bundle = getReviewBundle(submissionId);
  if (!bundle) throw new Error('Submission not found.');
  const { submission, document } = bundle;
  if (!['In Review','Submitted'].includes(submission.status)) throw new Error('Only submissions awaiting Reviewer review can be returned for changes.');
  const updated = updateSubmission(submissionId, {
    status: 'Changes Requested', reviewerId: actor.email, reviewerName: actor.name,
    reviewedAt: now(), reviewComment: comment.trim()
  });
  const docs = readDocuments(); const index = docs.findIndex(item => item.id === submission.documentId);
  let updatedDoc = document;
  if (index >= 0) {
    updatedDoc = { ...docs[index], status: 'Changes Requested', reviewerId: actor.email, reviewerName: actor.name, reviewedSubmissionId: submissionId,
      changesRequestedAt: now(), changesRequestedReason: comment.trim() };
    updatedDoc.activity = [{ id: uid('EVT'), type: 'changes-requested', label: `Changes requested by ${actor.name}`, at: now() }, ...(updatedDoc.activity || [])];
    docs[index] = updatedDoc; writeDocuments(docs);
  }
  write(REVIEW_DECISIONS_KEY, [{ id: uid('DEC'), submissionId, documentId: submission.documentId, decision: 'Changes Requested', actorId: actor.email, actorName: actor.name, role: actor.role, at: now(), version: submission.version, comment: comment.trim() }, ...readDecisions()]);
  addAuditEvent(actor, 'Changes requested', updatedDoc, { comment: comment.trim(), version: submission.version }, submissionId);
  return { submission: updated, document: updatedDoc };
}
export function sendToLegal(submissionId, actor, reason) {
  if (actor?.role !== 'Reviewer') throw new Error('Only Reviewer users can send documents to Legal.');
  if (!reason?.trim()) throw new Error('A reason is required for Legal review.');
  const bundle = getReviewBundle(submissionId);
  if (!bundle) throw new Error('Submission not found.');
  if (!['In Review','Submitted'].includes(bundle.submission.status)) throw new Error('Only submissions awaiting review can be escalated to Legal.');
  const updated = updateSubmission(submissionId, { status: 'In Legal Review', legalRequestedBy: actor.name, legalRequestedAt: now(), legalReason: reason.trim() });
  const docs = readDocuments(); const index = docs.findIndex(item => item.id === bundle.submission.documentId);
  let doc = bundle.document;
  if (index >= 0) {
    doc = { ...docs[index], status: 'In Legal Review', legalReason: reason.trim(), legalRequestedAt: now() };
    doc.activity = [{ id: uid('EVT'), type: 'legal-review', label: `Sent for Legal review by ${actor.name}`, at: now() }, ...(doc.activity || [])];
    docs[index] = doc; writeDocuments(docs);
  }
  addAuditEvent(actor, 'Legal review requested', doc, { reason: reason.trim() }, submissionId);
  return { submission: updated, document: doc };
}
export function recordLegalDecision(submissionId, actor, decision, comment = '') {
  if (actor?.role !== 'Legal') throw new Error('Only Legal users can record a Legal decision.');
  if (!['Approved', 'Changes Requested', 'Rejected'].includes(decision)) throw new Error('Invalid Legal decision.');
  if (decision !== 'Approved' && !comment.trim()) throw new Error('A reason is required to reject or request changes.');
  const bundle = getReviewBundle(submissionId);
  if (!bundle) throw new Error('Submission not found.');
  if (bundle.submission.status !== 'In Legal Review') throw new Error('This document is not awaiting a Legal decision.');
  if (decision === 'Approved') {
    const overrides = getOverridesForSubmission(submissionId);
    const blocking = (bundle.submission.issues || []).filter(issue => issue.severity === 'Critical' && issue.status !== 'Resolved' && !overrides.some(item => item.issueId === issue.id));
    if (blocking.length) throw new Error(`${blocking.length} Critical issue(s) require resolution or a reasoned Legal override before legal approval.`);
  }
  const updated = updateSubmission(submissionId, { legalStatus: decision, legalReviewerId: actor.email, legalReviewerName: actor.name, legalReviewedAt: now(), legalComment: comment, status: decision === 'Approved' ? 'In Review' : decision });
  const docs = readDocuments(); const index = docs.findIndex(item => item.id === bundle.submission.documentId);
  let doc = bundle.document;
  if (index >= 0) {
    doc = { ...docs[index], legalStatus: decision, legalReviewerId: actor.email, legalReviewerName: actor.name, legalReviewedAt: now(), legalComment: comment, ...(decision === 'Changes Requested' ? { reviewedSubmissionId: submissionId } : {}), status: decision === 'Approved' ? 'In Review' : decision };
    doc.activity = [{ id: uid('EVT'), type: 'legal-decision', label: `Legal ${decision.toLowerCase()} by ${actor.name}`, at: now() }, ...(doc.activity || [])];
    docs[index] = doc; writeDocuments(docs);
  }
  write(LEGAL_DECISIONS_KEY, [{ id: uid('LGL'), submissionId, documentId: bundle.submission.documentId, decision, actorId: actor.email, actorName: actor.name, role: actor.role, comment, at: now() }, ...readLegalDecisions()]);
  addAuditEvent(actor, `Legal decision: ${decision}`, doc, { comment }, submissionId);
  return { submission: updated, document: doc };
}
export function markDocumentPublished(submissionId, actor) {
  if (actor?.role !== 'Reviewer') throw new Error('Only Reviewer users can mark documents as published.');
  const bundle = getReviewBundle(submissionId);
  if (!bundle || bundle.submission.status !== 'Approved') throw new Error('Only approved documents can be published.');
  const docs = readDocuments(); const index = docs.findIndex(item => item.id === bundle.document.id);
  const doc = { ...docs[index], status: 'Published', publicationStatus: 'Published', publishedAt: now(), publishedBy: actor.name };
  doc.activity = [{ id: uid('EVT'), type: 'published', label: `Marked as published by ${actor.name}`, at: now() }, ...(doc.activity || [])];
  docs[index] = doc; writeDocuments(docs);
  updateSubmission(submissionId, { publicationStatus: 'Published', publishedAt: doc.publishedAt, publishedBy: actor.name });
  addAuditEvent(actor, 'Document marked as published', doc, { version: bundle.submission.version }, submissionId);
  return doc;
}
export function getSubmissionComments(submissionId) {
  return readComments().filter(item => item.submissionId === submissionId);
}
export function getDocumentTimeline(documentId) {
  const docs = readDocuments().find(item => item.id === documentId);
  const audit = readAuditEvents().filter(item => item.documentId === documentId);
  const activity = (docs?.activity || []).map(item => ({ ...item, userName: item.userName || docs.creatorName, role: item.role || 'Creator' }));
  return [...audit, ...activity].sort((a,b)=>new Date(b.at)-new Date(a.at));
}
