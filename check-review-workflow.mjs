import assert from 'node:assert/strict';
import {
  readSubmissions, readDocuments, readAuditEvents, readComments, readOverrides,
  getReviewBundle, addReviewComment, editReviewComment, setCommentResolved,
  recordOverride, approveSubmission, requestDocumentChanges, sendToLegal,
  recordLegalDecision, markDocumentPublished, getSubmissionComments
} from '../src/data/reviewStore.js';
import { submitCreatorDocument, saveCreatorDocument, createCreatorDocument, readCreatorDocuments, readCreatorSubmissions } from '../src/data/creatorStore.js';

const memory = new Map();
globalThis.localStorage = {
  getItem(k){return memory.has(k)?memory.get(k):null},
  setItem(k,v){memory.set(k,String(v))},
  removeItem(k){memory.delete(k)}
};
const creator={name:'Alex Morgan',email:'creator@brandguard.ai',role:'Creator'};
const reviewer={name:'Jordan Lee',email:'reviewer@brandguard.ai',role:'Reviewer'};
const legal={name:'Morgan Chen',email:'legal@brandguard.ai',role:'Legal'};
const doc=saveCreatorDocument(createCreatorDocument(creator,'Governance test','<h1>Launch</h1><p>Claim text requiring review.</p>'));
const issue={id:'ISS-CRIT-1',severity:'Critical',status:'Open',title:'Unsupported absolute claim',snippet:'Claim text',source:'No approved source found',reference:null,explanation:'No source'};
const submission=submitCreatorDocument(doc,creator,{score:42,issues:[issue]});
assert.equal(submission.status,'In Review');
assert.equal(getReviewBundle(submission.id).document.id,doc.id);

const comment=addReviewComment({submissionId:submission.id,documentId:doc.id,actor:reviewer,body:'Please substantiate this claim.',kind:'anchored',anchorText:'Claim text'});
const reply=addReviewComment({submissionId:submission.id,documentId:doc.id,actor:creator,body:'We will revise this.',parentId:comment.id});
assert.equal(getSubmissionComments(submission.id).length,2);
assert.ok(editReviewComment(comment.id,reviewer,'Please provide a supporting source.'));
setCommentResolved(comment.id,reviewer,true);
assert.equal(readComments().find(x=>x.id===comment.id).resolved,true);
setCommentResolved(comment.id,reviewer,false);
assert.equal(readComments().find(x=>x.id===comment.id).resolved,false);

assert.throws(()=>approveSubmission(submission.id,reviewer),/Critical issue/);
assert.throws(()=>recordOverride({submissionId:submission.id,documentId:doc.id,issue,actor:reviewer,reason:''}),/required/);
recordOverride({submissionId:submission.id,documentId:doc.id,issue,actor:reviewer,reason:'Legal reviewed the exact wording and approved the residual risk.'});
assert.equal(readOverrides().length,1);
const approval=approveSubmission(submission.id,reviewer);
assert.equal(approval.submission.status,'Approved');
assert.equal(approval.document.status,'Approved');
assert.equal(approval.document.publicationStatus,'Not published');
assert.equal(readAuditEvents().some(e=>e.action==='Document approved'),true);
const published=markDocumentPublished(submission.id,reviewer);
assert.equal(published.status,'Published');
assert.equal(readSubmissions().find(s=>s.id===submission.id).publicationStatus,'Published');

const secondDoc=saveCreatorDocument(createCreatorDocument(creator,'Changes workflow','<p>Draft content</p>'));
const second=submitCreatorDocument(secondDoc,creator,{score:80,issues:[]});
requestDocumentChanges(second.id,reviewer,'Please update the campaign date and add the required disclaimer.');
assert.equal(readSubmissions().find(s=>s.id===second.id).status,'Changes Requested');
assert.equal(readDocuments().find(d=>d.id===secondDoc.id).status,'Changes Requested');
const revised=saveCreatorDocument({...readDocuments().find(d=>d.id===secondDoc.id),content:'<p>Updated content</p>'},readCreatorDocuments(),{newVersion:true});
const resubmitted=submitCreatorDocument(revised,creator,{score:94,issues:[]});
assert.equal(resubmitted.version,2);
assert.equal(resubmitted.previousSubmissionId,second.id);
assert.equal(readSubmissions().find(s=>s.id===second.id).status,'Resubmitted');
assert.equal(readSubmissions().find(s=>s.id===resubmitted.id).status,'In Review');
assert.equal(readDocuments().find(d=>d.id===secondDoc.id).versions.length,1);

const legalDoc=saveCreatorDocument(createCreatorDocument(creator,'Legal escalation','<p>High risk claim</p>'));
const legalSub=submitCreatorDocument(legalDoc,creator,{score:30,issues:[{...issue,id:'ISS-LEGAL-1'}]});
sendToLegal(legalSub.id,reviewer,'Contractual claim needs legal interpretation.');
assert.equal(readSubmissions().find(s=>s.id===legalSub.id).status,'In Legal Review');
assert.throws(()=>recordLegalDecision(legalSub.id,legal,'Approved',''),/Critical issue/);
recordOverride({submissionId:legalSub.id,documentId:legalDoc.id,issue:{...issue,id:'ISS-LEGAL-1'},actor:legal,reason:'Legal accepts the residual risk based on contract clause 8.'});
recordLegalDecision(legalSub.id,legal,'Approved','Approved subject to contract clause 8.');
assert.equal(readSubmissions().find(s=>s.id===legalSub.id).status,'In Review');
assert.equal(readDocuments().find(d=>d.id===legalDoc.id).legalStatus,'Approved');
sendToLegal(legalSub.id,reviewer,'Second legal pass for a revision decision.');
recordLegalDecision(legalSub.id,legal,'Changes Requested','Request revision for the next test state.');
assert.equal(readSubmissions().find(s=>s.id===legalSub.id).status,'Changes Requested');
const rejectedDoc=saveCreatorDocument(createCreatorDocument(creator,'Legal rejection test','<p>Rejected content</p>'));
const rejectedSub=submitCreatorDocument(rejectedDoc,creator,{score:10,issues:[]});
sendToLegal(rejectedSub.id,reviewer,'Escalated for legal decision.');
recordLegalDecision(rejectedSub.id,legal,'Rejected','The claim is prohibited by the contract and cannot proceed.');
assert.equal(readSubmissions().find(s=>s.id===rejectedSub.id).status,'Rejected');

const audit=readAuditEvents();
for(const action of ['Comment added','Comment reply added','Comment edited','Comment resolved','Comment reopened','Critical issue overridden by Reviewer','Document approved','Document marked as published','Changes requested','Legal review requested','Critical issue overridden by Legal','Legal decision: Approved','Legal decision: Changes Requested','Legal decision: Rejected']) {
  assert.ok(audit.some(e=>e.action===action),`Missing audit event ${action}`);
}
assert.ok(memory.has('bg_creator_documents_v1'));
assert.ok(memory.has('bg_creator_submissions_v1'));
console.log(`PASS: reviewer queue linkage, threaded comments, comment edit/resolve/reopen, Critical override gates, approval, manual publishing, changes requested, Creator resubmission versioning, Legal escalation/decision, audit events and LocalStorage persistence.`);
