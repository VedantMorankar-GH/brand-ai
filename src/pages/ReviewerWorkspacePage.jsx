import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight,
  Clock3, FileText, Gavel, History, MessageCircle, MessageSquare, RefreshCw, Reply,
  Search, Send, ShieldAlert, ShieldCheck, Sparkles, X, Lock, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  readSubmissions, readDocuments, readComments, readAuditEvents, readOverrides,
  readLegalDecisions, getReviewBundle, addReviewComment, editReviewComment,
  setCommentResolved, recordOverride, approveSubmission, requestDocumentChanges,
  sendToLegal, recordLegalDecision, markDocumentPublished, getSubmissionComments,
  getDocumentTimeline, getOverridesForSubmission, addAuditEvent
} from '../data/reviewStore';
import { appendDocumentActivity } from '../data/creatorStore';

const dateTime = value => value ? new Date(value).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const dateOnly = value => value ? new Date(value).toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'}) : '—';
const openIssue = issue => !['Resolved'].includes(issue.status);
const riskFor = submission => {
  const issues = submission.issues || [];
  if (issues.some(i => i.severity === 'Critical' && openIssue(i))) return 'Critical';
  if (issues.some(i => i.severity === 'Major' && openIssue(i))) return 'High';
  if (issues.some(i => i.severity === 'Minor' && openIssue(i))) return 'Medium';
  return 'Low';
};
const issueCounts = issues => ({
  critical: issues.filter(i=>i.severity==='Critical'&&openIssue(i)).length,
  major: issues.filter(i=>i.severity==='Major'&&openIssue(i)).length,
  resolved: issues.filter(i=>i.status==='Resolved').length,
  unresolved: issues.filter(openIssue).length
});
const htmlToText = html => {
  const el = document.createElement('div'); el.innerHTML = html || '';
  el.querySelectorAll('script,style,iframe,object,embed').forEach(n=>n.remove());
  return (el.textContent || '').replace(/\s+/g,' ').trim();
};
function safeHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(n=>n.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name) || (['href','src','xlink:href'].includes(attr.name.toLowerCase()) && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    });
  });
  return doc.body.firstElementChild?.innerHTML || '';
}
function Pill({children,tone='neutral'}) { return <span className={`rw-pill ${tone}`}>{children}</span>; }
function Risk({value}) { return <span className={`rw-risk ${String(value||'Low').toLowerCase()}`}><i/>{value}</span>; }
function Severity({value}) { return <span className={`rw-severity ${String(value||'Minor').toLowerCase()}`}>{value}</span>; }
function PageHeader({eyebrow,title,desc,action}) {
 return <div className="rw-page-header"><div><div className="rw-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action}</div>;
}
function Metric({label,value,icon:Icon,tone='blue'}) {
 return <div className="rw-metric"><span className={`rw-metric-icon ${tone}`}><Icon size={17}/></span><div><b>{value}</b><small>{label}</small></div></div>;
}
function Empty({icon:Icon=FileText,title,desc}) {
 return <div className="rw-empty"><span><Icon size={23}/></span><b>{title}</b><p>{desc}</p></div>;
}
function Modal({title,children,onClose}) {
 return <div className="rw-overlay" onMouseDown={onClose}><motion.section className="rw-modal" initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} onMouseDown={e=>e.stopPropagation()}><header><h3>{title}</h3><button onClick={onClose}><X size={17}/></button></header>{children}</motion.section></div>;
}
function AccessDenied({role}) { return <div className="rw-page"><Empty icon={Lock} title="Access restricted" desc={`This workspace is available to ${role} accounts only.`}/></div>; }
function useRefresh() {
 const [tick,setTick]=useState(0);
 const refresh=()=>setTick(v=>v+1);
 useEffect(()=>{const fn=()=>refresh();window.addEventListener('storage',fn);return()=>window.removeEventListener('storage',fn);},[]);
 return [tick,refresh];
}

export function ReviewQueuePage() {
 const {user}=useAuth();
 const [tick,refresh]=useRefresh(), nav=useNavigate();
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('All submissions'),[creator,setCreator]=useState('All creators'),[severity,setSeverity]=useState('All severities'),[dateFilter,setDateFilter]=useState('Any date'),[sort,setSort]=useState('priority'),[page,setPage]=useState(1),[creatorDetails,setCreatorDetails]=useState(null);
 const submissions=readSubmissions();
 const queue=submissions.filter(s=>['In Review','Submitted'].includes(s.status));
 const creators=[...new Set(submissions.map(s=>s.creatorName).filter(Boolean))];
 const filtered=submissions.filter(s=>{
   const risk=riskFor(s), counts=issueCounts(s.issues||[]);
   const text=`${s.documentTitle} ${s.creatorName} ${s.id}`.toLowerCase();
   const age=Date.now()-new Date(s.submittedAt).getTime();
   const matchFilter=filter==='All submissions'?['In Review','Submitted'].includes(s.status):filter==='Pending review'?['In Review','Submitted'].includes(s.status):filter==='High risk'?['In Review','Submitted'].includes(s.status)&&['Critical','High'].includes(risk):filter==='Critical issues'?['In Review','Submitted'].includes(s.status)&&counts.critical>0:filter==='Recently submitted'?['In Review','Submitted'].includes(s.status)&&age<7*86400000:filter==='Changes requested'?s.status==='Changes Requested':false;
   const matchDate=dateFilter==='Any date'||(dateFilter==='Last 24 hours'&&age<86400000)||(dateFilter==='Last 7 days'&&age<7*86400000)||(dateFilter==='Last 30 days'&&age<30*86400000)||(dateFilter==='Older'&&age>=30*86400000);
   return matchFilter&&matchDate&&text.includes(query.toLowerCase())&&(creator==='All creators'||s.creatorName===creator)&&(severity==='All severities'||(s.issues||[]).some(i=>i.severity===severity&&openIssue(i)));
 }).sort((a,b)=>sort==='oldest'?new Date(a.submittedAt)-new Date(b.submittedAt):sort==='newest'?new Date(b.submittedAt)-new Date(a.submittedAt):({Critical:0,High:1,Medium:2,Low:3}[riskFor(a)]-({Critical:0,High:1,Medium:2,Low:3}[riskFor(b)])||new Date(a.submittedAt)-new Date(b.submittedAt)));
 const pageSize=8,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),visible=filtered.slice((page-1)*pageSize,page*pageSize);
 const allCritical=queue.filter(s=>riskFor(s)==='Critical').length;
 if(user?.role!=='Reviewer')return <AccessDenied role="Reviewer"/>;
 return <div className="rw-page">
  <PageHeader eyebrow="REVIEW OPERATIONS" title="Review Queue" desc="Prioritise submitted content, inspect evidence and record accountable decisions." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh queue</button>}/>
  <div className="rw-metrics"><Metric label="Pending review" value={queue.length} icon={Clock3}/><Metric label="Critical risk" value={allCritical} icon={AlertTriangle} tone="red"/><Metric label="Changes requested" value={submissions.filter(s=>s.status==='Changes Requested').length} icon={MessageSquare} tone="amber"/><Metric label="Approved" value={submissions.filter(s=>s.status==='Approved').length} icon={ShieldCheck} tone="green"/></div>
  <section className="rw-card">
   <div className="rw-card-head"><div><h2>Incoming submissions</h2><p>{filtered.length} matching documents · queue data from Creator Workspace</p></div><Pill tone="blue">Live local queue</Pill></div>
   <div className="rw-filter-tabs">{['All submissions','Pending review','High risk','Critical issues','Recently submitted','Changes requested'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>{setFilter(x);setPage(1)}}>{x}</button>)}</div>
   <div className="rw-toolbar"><label className="rw-search"><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Search document, creator or ID"/></label><select value={creator} onChange={e=>{setCreator(e.target.value);setPage(1)}}><option>All creators</option>{creators.map(x=><option key={x}>{x}</option>)}</select><select value={severity} onChange={e=>{setSeverity(e.target.value);setPage(1)}}><option>All severities</option>{['Critical','Major','Minor','Informational'].map(x=><option key={x}>{x}</option>)}</select><select value={dateFilter} onChange={e=>{setDateFilter(e.target.value);setPage(1)}}><option>Any date</option><option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option><option>Older</option></select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Sort: risk priority</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
   <div className="rw-table-wrap"><table className="rw-table"><thead><tr><th>DOCUMENT</th><th>CREATOR</th><th>SUBMITTED</th><th>VERSION</th><th>SCORE</th><th>CRITICAL / MAJOR</th><th>RISK</th><th>STATUS</th><th/></tr></thead><tbody>
    {visible.map(s=>{const c=issueCounts(s.issues||[]),risk=riskFor(s);return <tr key={s.id}><td><div className="rw-doc-cell"><span><FileText size={16}/></span><div><b>{s.documentTitle}</b><small>{s.id}</small></div></div></td><td><button className="rw-creator-link" onClick={()=>setCreatorDetails(s)}>{s.creatorName||'—'}</button></td><td>{dateTime(s.submittedAt)}</td><td>v{s.version||1}</td><td><b className={s.complianceScore<60?'rw-score-low':''}>{s.complianceScore??'—'}{s.complianceScore!=null?'%':''}</b></td><td><span className="rw-count red">{c.critical}</span><span className="rw-count amber">{c.major}</span></td><td><Risk value={risk}/></td><td><Pill tone="blue">{s.status}</Pill></td><td><button className="rw-icon-action" title="Open review" onClick={()=>nav(`/app/review/${s.id}`)}><ChevronRight size={17}/></button></td></tr>})}
   </tbody></table>{!visible.length&&<Empty icon={CheckCircle2} title="Queue is clear" desc="No submissions match these filters. New Creator submissions will appear here automatically."/>}</div>
   <div className="rw-pagination"><span>Showing {filtered.length?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,filtered.length)} of {filtered.length}</span><div><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><b>{page} / {totalPages}</b><button disabled={page>=totalPages} onClick={()=>setPage(v=>v+1)}>Next</button></div></div>
  </section>
  <AnimatePresence>{creatorDetails&&<Modal title="Creator submission details" onClose={()=>setCreatorDetails(null)}><div className="rw-creator-detail"><div className="rw-creator-avatar">{(creatorDetails.creatorName||'C').split(' ').map(x=>x[0]).slice(0,2).join('')}</div><b>{creatorDetails.creatorName}</b><span>{creatorDetails.creatorId||'Creator account'}</span><p>Document: {creatorDetails.documentTitle}</p><p>Submitted: {dateTime(creatorDetails.submittedAt)}</p><p>Version: {creatorDetails.version||1}</p><button className="rw-button primary" onClick={()=>nav(`/app/review/${creatorDetails.id}`)}>Open submission <ArrowRight size={13}/></button></div></Modal>}</AnimatePresence>
 </div>;
}

export function DocumentReviewPage() {
 const {submissionId}=useParams(),{user}=useAuth(),nav=useNavigate();
 const [tick,refresh]=useRefresh(),[bundle,setBundle]=useState(()=>getReviewBundle(submissionId));
 const [selected,setSelected]=useState(null),[comment,setComment]=useState(''),[anchor,setAnchor]=useState(''),[replyTo,setReplyTo]=useState(null),[replyText,setReplyText]=useState('');
 const [decisionComment,setDecisionComment]=useState(''),[legalReason,setLegalReason]=useState(''),[overrideIssue,setOverrideIssue]=useState(null),[overrideReason,setOverrideReason]=useState(''),[toast,setToast]=useState('');
 const docRef=useRef(null);
 useEffect(()=>{const b=getReviewBundle(submissionId);setBundle(b);if(b&&!selected)setSelected(b.submission.issues?.[0]?.id||null);},[submissionId,tick]);
 const {submission,document}=bundle||{};
 const issues=submission?.issues||[],counts=issueCounts(issues),comments=submission?getSubmissionComments(submission.id):[],overrides=submission?getOverridesForSubmission(submission.id):[];
 const unresolvedCritical=issues.filter(i=>i.severity==='Critical'&&i.status!=='Resolved'&&!overrides.some(o=>o.issueId===i.id));
 const selectedIssue=issues.find(i=>i.id===selected);
 const notify=msg=>{setToast(msg);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(''),3200);};
 useEffect(()=>{
  const root=docRef.current;if(!root)return;
  root.querySelectorAll('.rw-doc-highlight').forEach(mark=>{const parent=mark.parentNode;while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);parent.removeChild(mark);});
  const candidates=issues.filter(issue=>(issue.snippet||'').trim()&&issue.status!=='Resolved').slice().sort((a,b)=>b.snippet.length-a.snippet.length);
  candidates.forEach(issue=>{
   const target=issue.snippet.trim(),walker=window.document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,done=false;
   while((node=walker.nextNode())&&!done){
    if(node.parentElement?.closest('.rw-doc-highlight'))continue;
    const index=node.nodeValue.toLowerCase().indexOf(target.toLowerCase());
    if(index>=0){const range=window.document.createRange();range.setStart(node,index);range.setEnd(node,index+target.length);const mark=window.document.createElement('mark');mark.className=`rw-doc-highlight ${String(issue.severity||'Minor').toLowerCase()} ${issue.id===selected?'selected':''}`;mark.dataset.reviewIssue=issue.id;range.surroundContents(mark);done=true;}
   }
  });
 },[selected,submissionId,document?.content,issues]);
 if(user?.role!=='Reviewer')return <AccessDenied role="Reviewer"/>;
 if(!submission||!document)return <div className="rw-page"><PageHeader eyebrow="DOCUMENT REVIEW" title="Submission not found" desc="This submission may have been removed or is no longer available."/><button className="rw-button ghost" onClick={()=>nav('/app/queue')}><ArrowLeft size={14}/> Back to queue</button></div>;
 const submitSelection=()=>{const text=window.getSelection()?.toString().trim();if(text){setAnchor(text);setComment('');window.getSelection()?.removeAllRanges();}else notify('Select a phrase in the document before adding an anchored comment.');};
 const addComment=()=>{if(!comment.trim()){notify('Enter a comment first.');return;}addReviewComment({submissionId,documentId:document.id,actor:user,body:comment,kind:anchor?'anchored':'general',anchorText:anchor});setComment('');setAnchor('');refresh();};
 const addReply=parentId=>{if(!replyText.trim())return;addReviewComment({submissionId,documentId:document.id,actor:user,body:replyText,parentId});setReplyTo(null);setReplyText('');refresh();};
 const doApprove=()=>{try{approveSubmission(submissionId,user);refresh();notify('Document approved. Publishing remains a separate manual action.');}catch(e){notify(e.message);}};
 const doChanges=()=>{try{requestDocumentChanges(submissionId,user,decisionComment);setDecisionComment('');refresh();notify('Changes requested. The document is back with its Creator.');}catch(e){notify(e.message);}};
 const doLegal=()=>{try{sendToLegal(submissionId,user,legalReason);setLegalReason('');refresh();notify('Sent to the Legal review queue.');}catch(e){notify(e.message);}};
 const doOverride=()=>{try{recordOverride({submissionId,documentId:document.id,issue:overrideIssue,actor:user,reason:overrideReason});setOverrideIssue(null);setOverrideReason('');refresh();notify('Critical override recorded with an audit event.');}catch(e){notify(e.message);}};
 const threadRoots=comments.filter(c=>!c.parentId);
 return <div className="rw-page rw-review-page">
  <div className="rw-backline"><button onClick={()=>nav('/app/queue')}><ArrowLeft size={14}/> Review Queue</button><span>/</span><span>{submission.documentTitle}</span><div className="rw-back-actions"><Pill tone={submission.status==='Approved'?'green':'blue'}>{submission.status}</Pill><button className="rw-button ghost small" onClick={refresh}><RefreshCw size={13}/> Refresh</button></div></div>
  <div className="rw-review-title"><div><div className="rw-eyebrow">DOCUMENT REVIEW · {submission.id}</div><h1>{submission.documentTitle}</h1><p>Submitted by {submission.creatorName} · {dateTime(submission.submittedAt)} · Version {submission.version||1}</p></div><div className="rw-review-title-score"><b>{submission.complianceScore??'—'}<small>{submission.complianceScore!=null?'/100':''}</small></b><span>Compliance score</span></div></div>
  <div className="rw-review-stats"><span><b>{issues.length}</b>Total issues</span><span><b className="red">{counts.critical}</b>Critical</span><span><b className="amber">{counts.major}</b>Major</span><span><b className="green">{counts.resolved}</b>Resolved</span><span><b>{counts.unresolved}</b>Unresolved</span><span><b>v{submission.version||1}</b>Submitted version</span></div>
  <div className="rw-review-grid">
   <section className="rw-card rw-document-pane">
    <div className="rw-card-head"><div><h2><FileText size={16}/> Submitted document</h2><p>Read-only snapshot · Creator's submitted version</p></div><Pill tone="neutral">v{submission.version||1}</Pill></div>
    <div className="rw-doc-meta"><span><User size={13}/>{submission.creatorName}</span><span><Clock3 size={13}/>{dateTime(submission.submittedAt)}</span><span><ShieldCheck size={13}/>{submission.status}</span></div>
    <div className="rw-document-body" ref={docRef} onClick={e=>{const mark=e.target.closest?.("[data-review-issue]");if(mark)setSelected(mark.dataset.reviewIssue);}} dangerouslySetInnerHTML={{__html:safeHtml(document.content)}}/>
    <div className="rw-selection-tip"><span><Sparkles size={13}/> Select text in the document to attach a comment.</span><button onClick={submitSelection}><MessageSquare size={13}/> Comment on selection</button></div>
    <div className="rw-issues-inline"><h3>Detected issues</h3>{issues.map(issue=><button key={issue.id} className={selected===issue.id?'active':''} onClick={()=>setSelected(issue.id)}><Severity value={issue.severity}/><span>{issue.title}</span><small>{issue.status||'Open'}</small></button>)}</div>
   </section>
   <aside className="rw-review-side">
    <section className="rw-card"><div className="rw-card-head"><div><h2><ShieldAlert size={16}/> Review findings</h2><p>Issue evidence and creator actions</p></div><Pill>{issues.length} issues</Pill></div>
     <div className="rw-issue-list">{issues.length?issues.map(issue=>{const over=overrides.find(o=>o.issueId===issue.id);return <article key={issue.id} className={`rw-issue-card ${selected===issue.id?'selected':''}`} onClick={()=>setSelected(issue.id)}><div><Severity value={issue.severity}/><Pill tone={over?'violet':issue.status==='Resolved'?'green':issue.status==='Dismissed'?'amber':'neutral'}>{over?`Overridden by ${over.role}`:issue.status==='Dismissed'?'Dismissed by Creator':issue.status||'Unresolved'}</Pill></div><b>{issue.title}</b><blockquote>{issue.snippet||'No exact text snippet was recorded.'}</blockquote><p>{issue.explanation}</p><div className="rw-evidence"><FileText size={13}/><span><b>{issue.source||'No approved source found'}</b><small>{issue.reference||'No page or section reference available'}</small></span></div>{issue.suggestion&&<div className="rw-suggestion"><small>Suggested correction</small><p>{issue.suggestion}</p></div>}{issue.dismissalReason&&<p className="rw-dismiss-reason">Creator dismissal reason: {issue.dismissalReason}</p>}{over&&<p className="rw-override-note">Override reason: {over.reason}</p>}{issue.severity==='Critical'&&issue.status!=='Resolved'&&!over&&user?.role==='Reviewer'&&<button className="rw-button danger small" onClick={e=>{e.stopPropagation();setOverrideIssue(issue);}}><ShieldAlert size={13}/> Override with reason</button>}</article>}) : <Empty icon={CheckCircle2} title="No detected issues" desc="The submitted scan did not return any issues."/ >}</div>
    </section>
    <section className="rw-card"><div className="rw-card-head"><div><h2><MessageCircle size={16}/> Reviewer comments</h2><p>General notes and text-anchored feedback</p></div><Pill>{comments.length}</Pill></div>
     <div className="rw-comment-compose">{anchor&&<div className="rw-anchor-chip">Selected text: “{anchor}” <button onClick={()=>setAnchor('')}><X size={12}/></button></div>}<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Add a general comment or select document text first…"/><div><span>{anchor?'Anchored comment':'General comment'}</span><button className="rw-button primary small" onClick={addComment}><Send size={13}/> Add comment</button></div></div>
     <div className="rw-comments">{threadRoots.map(c=><CommentThread key={c.id} comment={c} all={comments} actor={user} onReply={addReply} replyTo={replyTo} setReplyTo={setReplyTo} replyText={replyText} setReplyText={setReplyText} onEdit={(id,body)=>{editReviewComment(id,user,body);refresh();}} onResolve={(id,value)=>{setCommentResolved(id,user,value);refresh();}}/>)}</div>
    </section>
    <section className="rw-card rw-decision-card"><div className="rw-card-head"><div><h2><CheckCircle2 size={16}/> Decision</h2><p>Actions are recorded in the audit trail</p></div></div>
     {unresolvedCritical.length>0&&<div className="rw-alert"><AlertTriangle size={15}/><span><b>{unresolvedCritical.length} critical issue(s) block normal approval.</b><small>Resolve them or record a reasoned Critical override. Creator-dismissed issues are not treated as resolved.</small></span></div>}
     {submission.status==='In Review'||submission.status==='Submitted'?<><label className="rw-field">Reason for requesting changes<textarea value={decisionComment} onChange={e=>setDecisionComment(e.target.value)} placeholder="Required only when requesting changes…"/></label><label className="rw-field">Reason for Legal review<textarea value={legalReason} onChange={e=>setLegalReason(e.target.value)} placeholder="Required only when sending to Legal…"/></label><div className="rw-decision-actions"><button className="rw-button primary" onClick={doApprove} disabled={unresolvedCritical.length>0}><Check size={14}/> Approve</button><button className="rw-button amber" onClick={doChanges} disabled={!decisionComment.trim()}><MessageSquare size={14}/> Request changes</button><button className="rw-button ghost" onClick={doLegal} disabled={!legalReason.trim()}><Gavel size={14}/> Send to Legal</button></div></>:<div className="rw-decision-result"><CheckCircle2 size={18}/><b>{submission.status}</b><span>{submission.reviewComment||submission.legalComment||'This submission has already received a decision.'}</span></div>}
     {submission.reviewerName&&<p className="rw-decision-by">Decision recorded by {submission.reviewerName} · {dateTime(submission.reviewedAt)}</p>}
    </section>
   </aside>
  </div>
  <AnimatePresence>{overrideIssue&&<Modal title="Override critical issue" onClose={()=>setOverrideIssue(null)}><div className="rw-modal-body"><div className="rw-alert"><AlertTriangle size={16}/><span><b>{overrideIssue.title}</b><small>Overrides do not resolve the original issue. The audit record remains visible.</small></span></div><label className="rw-field">Mandatory override explanation<textarea value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} placeholder="Explain the business rationale, evidence reviewed and residual risk…"/></label><div className="rw-modal-actions"><button className="rw-button ghost" onClick={()=>setOverrideIssue(null)}>Cancel</button><button className="rw-button danger" disabled={!overrideReason.trim()} onClick={doOverride}><Lock size={14}/> Record override</button></div></div></Modal>}</AnimatePresence>
  {toast&&<div className="rw-toast"><CheckCircle2 size={15}/>{toast}</div>}
 </div>;
}

function CommentThread({comment,all,actor,onReply,replyTo,setReplyTo,replyText,setReplyText,onEdit,onResolve}) {
 const [editing,setEditing]=useState(false),[body,setBody]=useState(comment.body);
 const replies=all.filter(x=>x.parentId===comment.id);
 return <div className={`rw-comment ${comment.resolved?'resolved':''}`}><div className="rw-comment-head"><span className="rw-comment-avatar">{(comment.authorName||'U').split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><b>{comment.authorName}</b><small>{comment.role} · {dateTime(comment.createdAt)}{comment.updatedAt!==comment.createdAt?' · edited':''}</small></div><Pill tone={comment.kind==='anchored'?'violet':'neutral'}>{comment.kind==='anchored'?'Text comment':'General'}</Pill></div>{comment.anchorText&&<blockquote>“{comment.anchorText}”</blockquote>}{editing?<textarea value={body} onChange={e=>setBody(e.target.value)}/>:<p>{comment.body}</p>}<div className="rw-comment-actions">{editing?<><button onClick={()=>{onEdit(comment.id,body);setEditing(false);}}>Save edit</button><button onClick={()=>setEditing(false)}>Cancel</button></>:<>{comment.authorId===(actor?.email||actor?.name)&&<button onClick={()=>setEditing(true)}>Edit</button>}<button onClick={()=>setReplyTo(replyTo===comment.id?null:comment.id)}><Reply size={12}/> Reply</button><button onClick={()=>onResolve(comment.id,!comment.resolved)}>{comment.resolved?'Reopen':'Resolve'}</button></>}</div>{replyTo===comment.id&&<div className="rw-reply-compose"><textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write a reply…"/><button className="rw-button primary small" onClick={()=>onReply(comment.id)}><Send size={12}/> Reply</button></div>}{replies.map(reply=><div className="rw-reply" key={reply.id}><b>{reply.authorName} <small>{reply.role} · {dateTime(reply.createdAt)}</small></b><p>{reply.body}</p></div>)}</div>;
}

export function ApprovedDocumentsPage() {
 const {user}=useAuth();
 const [tick,refresh]=useRefresh(),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[sort,setSort]=useState('newest');
 const items=readSubmissions().filter(s=>['Approved'].includes(s.status)||s.status==='Published').filter(s=>(filter==='All'||(filter==='Published'?s.publicationStatus==='Published':s.publicationStatus!=='Published'))&&`${s.documentTitle} ${s.creatorName} ${s.reviewerName||''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='oldest'?new Date(a.reviewedAt)-new Date(b.reviewedAt):sort==='score'?((b.complianceScore||0)-(a.complianceScore||0)):new Date(b.reviewedAt)-new Date(a.reviewedAt));
 const nav=useNavigate();
 if(user?.role!=='Reviewer')return <AccessDenied role="Reviewer"/>;
 return <div className="rw-page"><PageHeader eyebrow="CONTROLLED CONTENT LIBRARY" title="Approved Documents" desc="Approved content is retained here. Publication is a separate, manual action." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh</button>}/><div className="rw-toolbar rw-library-toolbar"><label className="rw-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search approved documents"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Not published</option><option>Published</option></select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest approved</option><option value="oldest">Oldest approved</option><option value="score">Highest score</option></select></div><div className="rw-card"><div className="rw-table-wrap"><table className="rw-table"><thead><tr><th>DOCUMENT</th><th>CREATOR</th><th>REVIEWER</th><th>APPROVED</th><th>VERSION</th><th>SCORE</th><th>OVERRIDES</th><th>PUBLICATION</th><th/></tr></thead><tbody>{items.map(s=>{const bundle=getReviewBundle(s.id),count=getOverridesForSubmission(s.id).length;return <tr key={s.id}><td><b>{s.documentTitle}</b><small className="rw-subtext">{s.id}</small></td><td>{s.creatorName}</td><td>{s.reviewerName||'—'}</td><td>{dateOnly(s.reviewedAt)}</td><td>v{s.reviewedVersion||s.version}</td><td>{s.complianceScore??'—'}</td><td>{count}</td><td><Pill tone={s.publicationStatus==='Published'?'green':'amber'}>{s.publicationStatus||'Not published'}</Pill></td><td><button className="rw-button ghost small" onClick={()=>nav(`/app/review/${s.id}`)}>View</button>{s.publicationStatus!=='Published'&&<button className="rw-button primary small" onClick={()=>{try{markDocumentPublished(s.id,user);refresh();}catch(e){alert(e.message)}}}>Mark published</button>}</td></tr>})}</tbody></table>{!items.length&&<Empty title="No approved documents yet" desc="Documents appear here after a Reviewer records an approval decision."/>}</div></div></div>;
}

export function ChangesRequestedPage() {
 const {user}=useAuth();
 const [tick,refresh]=useRefresh(),nav=useNavigate();
 const all=readSubmissions();
 const items=all.filter(s=>['Changes Requested','Resubmitted'].includes(s.status));
 if(user?.role!=='Reviewer')return <AccessDenied role="Reviewer"/>;
 return <div className="rw-page"><PageHeader eyebrow="CREATOR FEEDBACK LOOP" title="Changes Requested" desc="Track documents returned to Creators and monitor their resubmissions." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh</button>}/><div className="rw-card"><div className="rw-table-wrap"><table className="rw-table"><thead><tr><th>DOCUMENT</th><th>REVIEWER</th><th>REQUESTED</th><th>REASON</th><th>COMMENTS</th><th>VERSION</th><th>STATUS</th><th/></tr></thead><tbody>{items.map(s=><tr key={s.id}><td><b>{s.documentTitle}</b><small className="rw-subtext">{s.creatorName}</small></td><td>{s.reviewerName||'—'}</td><td>{dateTime(s.reviewedAt)}</td><td className="rw-reason-cell">{s.reviewComment||'—'}</td><td>{getSubmissionComments(s.id).length}</td><td>v{s.version}</td><td><Pill tone={s.status==='Resubmitted'?'blue':'amber'}>{s.status}</Pill></td><td>{s.status==='Resubmitted'&&all.find(next=>next.previousSubmissionId===s.id)?<button className="rw-button primary small" onClick={()=>nav(`/app/review/${all.find(next=>next.previousSubmissionId===s.id).id}`)}>Open resubmission</button>:<button className="rw-button ghost small" onClick={()=>nav(`/app/review/${s.id}`)}>Review record</button>}</td></tr>)}</tbody></table>{!items.length&&<Empty icon={CheckCircle2} title="No returned documents" desc="Documents requiring Creator revisions will be listed here."/>}</div></div></div>;
}

export function RevisionHistoryPage() {
 const {user}=useAuth();
 const [tick,refresh]=useRefresh(),[query,setQuery]=useState(''),[chosen,setChosen]=useState(null);
 const docs=readDocuments().filter(d=>`${d.title} ${d.creatorName}`.toLowerCase().includes(query.toLowerCase())&&(d.versions?.length||0)>0);
 const selected=docs.find(d=>d.id===chosen)||docs[0];
 const versions=selected?[...(selected.versions||[]),{version:selected.version,title:selected.title,content:selected.content,status:selected.status,savedAt:selected.updatedAt,updatedBy:selected.creatorName,role:selected.creatorRole||'Creator',scanResults:selected.scanResults,current:true}].sort((a,b)=>a.version-b.version):[];
 const [left,setLeft]=useState(0),[right,setRight]=useState(1);
 if(user?.role!=='Reviewer')return <AccessDenied role="Reviewer"/>;
 const a=versions[left],b=versions[right];
 const lines=content=>(htmlToText(content).split(/(?<=[.!?])\s+/).filter(Boolean));
 const oldLines=lines(a?.content),newLines=lines(b?.content);
 const added=newLines.filter(x=>!oldLines.includes(x)),removed=oldLines.filter(x=>!newLines.includes(x)),same=newLines.filter(x=>oldLines.includes(x));
 return <div className="rw-page"><PageHeader eyebrow="DOCUMENT GOVERNANCE" title="Revision History" desc="Inspect immutable version snapshots and compare the submitted version with earlier checkpoints." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh</button>}/><div className="rw-history-layout"><section className="rw-card"><div className="rw-card-head"><div><h2>Documents with version history</h2><p>Choose a document to inspect its checkpoints.</p></div></div><label className="rw-search rw-history-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search documents"/></label><div className="rw-history-docs">{docs.map(d=><button className={selected?.id===d.id?'active':''} key={d.id} onClick={()=>{setChosen(d.id);setLeft(0);setRight(Math.max(1,d.versions.length));}}><FileText size={15}/><span><b>{d.title}</b><small>{d.versions.length+1} versions · {d.status}</small></span><ChevronRight size={15}/></button>)}</div></section><section className="rw-card"><div className="rw-card-head"><div><h2><FileText size={16}/> Version comparison</h2><p>{selected?.title||'Select a document'}</p></div></div>{selected&&versions.length>1?<><div className="rw-compare-select"><label>Compare version<select value={left} onChange={e=>setLeft(Number(e.target.value))}>{versions.map((v,i)=><option key={i} value={i}>v{v.version}{v.current?' · Current':''}</option>)}</select></label><span>against</span><label>Version<select value={right} onChange={e=>setRight(Number(e.target.value))}>{versions.map((v,i)=><option key={i} value={i}>v{v.version}{v.current?' · Current':''}</option>)}</select></label></div><div className="rw-diff-summary"><Pill tone="green">+ {added.length} added</Pill><Pill tone="red">− {removed.length} removed</Pill><Pill>{same.length} unchanged</Pill></div><div className="rw-diff-grid"><div><h4>Version {a?.version} · {dateTime(a?.savedAt)} · {a?.updatedBy||selected.creatorName} ({a?.role||selected.creatorRole||'Creator'})</h4>{removed.map((x,i)=><p className="removed" key={i}>− {x}</p>)}{same.map((x,i)=><p className="same" key={i}>{x}</p>)}</div><div><h4>Version {b?.version} · {dateTime(b?.savedAt)} · {b?.updatedBy||selected.creatorName} ({b?.role||selected.creatorRole||'Creator'})</h4>{added.map((x,i)=><p className="added" key={i}>+ {x}</p>)}{same.map((x,i)=><p className="same" key={i}>{x}</p>)}</div></div></>:<Empty icon={History} title="Not enough versions to compare" desc="A document needs at least two saved checkpoints before a side-by-side comparison is available."/>}</section></div></div>;
}

export function AuditTrailPage() {
 const {user}=useAuth();
 const [tick,refresh]=useRefresh(),[query,setQuery]=useState(''),[role,setRole]=useState('All roles'),[action,setAction]=useState('All actions'),[person,setPerson]=useState('All users');
 const events=readAuditEvents();
 const users=[...new Set(events.map(e=>e.userName))],actions=[...new Set(events.map(e=>e.action))];
 const filtered=events.filter(e=>`${e.documentTitle} ${e.userName} ${e.action} ${e.details?.reason||''}`.toLowerCase().includes(query.toLowerCase())&&(role==='All roles'||e.role===role)&&(action==='All actions'||e.action===action)&&(person==='All users'||e.userName===person)).sort((a,b)=>new Date(b.at)-new Date(a.at));
 if(!['Reviewer','Legal','Admin'].includes(user?.role))return <AccessDenied role="Reviewer, Legal or Admin"/>;
 return <div className="rw-page"><PageHeader eyebrow="ACCOUNTABILITY & TRACEABILITY" title="Audit Trail" desc="Append-only activity history for review, legal, override and publication decisions." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh</button>}/><div className="rw-audit-note"><Lock size={15}/> Audit events are not editable or deletable through this interface. LocalStorage is demo persistence, not a tamper-proof production audit service.</div><div className="rw-toolbar rw-audit-toolbar"><label className="rw-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search event, user or document"/></label><select value={person} onChange={e=>setPerson(e.target.value)}><option>All users</option>{users.map(u=><option key={u}>{u}</option>)}</select><select value={role} onChange={e=>setRole(e.target.value)}><option>All roles</option>{['Creator','Reviewer','Legal','Admin','System'].map(x=><option key={x}>{x}</option>)}</select><select value={action} onChange={e=>setAction(e.target.value)}><option>All actions</option>{actions.map(x=><option key={x}>{x}</option>)}</select></div><div className="rw-card"><div className="rw-table-wrap"><table className="rw-table"><thead><tr><th>EVENT</th><th>USER</th><th>ROLE</th><th>DOCUMENT</th><th>DATE & TIME</th><th>DETAILS</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><b>{e.action||e.label}</b></td><td>{e.userName||'—'}</td><td><Pill>{e.role||'Creator'}</Pill></td><td>{e.documentTitle||'—'}</td><td>{dateTime(e.at)}</td><td className="rw-reason-cell">{e.details?.reason||e.details?.comment||e.details?.issueTitle||'—'}</td></tr>)}</tbody></table>{!filtered.length&&<Empty icon={Activity} title="No audit events found" desc="Review actions and decisions will appear here as the workflow is used."/>}</div></div></div>;
}

export function LegalWorkspacePage() {
 const {user}=useAuth(),[tick,refresh]=useRefresh(),[query,setQuery]=useState(''),[selected,setSelected]=useState(null),[comment,setComment]=useState(''),[overrideIssue,setOverrideIssue]=useState(null),[reason,setReason]=useState('');
 const nav=useNavigate();
 const claimsOnly=window.location.pathname.endsWith('/claims');
 const queue=readSubmissions().filter(s=>(claimsOnly?['Critical','High'].includes(riskFor(s)):s.status==='In Legal Review')&&`${s.documentTitle} ${s.creatorName}`.toLowerCase().includes(query.toLowerCase()));
 const bundle=selected?getReviewBundle(selected):null,issues=bundle?.submission.issues||[],overrides=selected?getOverridesForSubmission(selected):[];
 if(user?.role!=='Legal')return <AccessDenied role="Legal"/>;
 const decide=(decision)=>{try{recordLegalDecision(selected,user,decision,comment);setComment('');refresh();if(decision==='Approved')setSelected(null);}catch(e){alert(e.message)}};
 const override=()=>{try{recordOverride({submissionId:selected,documentId:bundle.document.id,issue:overrideIssue,actor:user,reason});setOverrideIssue(null);setReason('');refresh();}catch(e){alert(e.message)}};
 return <div className="rw-page"><PageHeader eyebrow="LEGAL & CLAIMS GOVERNANCE" title="Legal Review" desc="Review escalated claims, record legal decisions and document critical-risk overrides." action={<button className="rw-button ghost" onClick={refresh}><RefreshCw size={14}/> Refresh</button>}/><div className="rw-legal-layout"><section className="rw-card"><div className="rw-card-head"><div><h2>{claimsOnly?'High-risk claims':'Legal review queue'}</h2><p>{claimsOnly?`${queue.length} high-risk submissions to inspect`:`${queue.length} documents awaiting legal assessment`}</p></div><Pill tone="violet">Legal only</Pill></div><label className="rw-search rw-legal-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search legal queue"/></label><div className="rw-legal-queue">{queue.map(s=><button key={s.id} className={selected===s.id?'active':''} onClick={()=>setSelected(s.id)}><span className="rw-legal-file"><Gavel size={16}/></span><span><b>{s.documentTitle}</b><small>{s.creatorName} · {dateTime(s.legalRequestedAt)}</small><em>{s.legalReason}</em></span><ChevronRight size={15}/></button>)}{!queue.length&&<Empty icon={ShieldCheck} title="No legal escalations" desc="Documents sent by Reviewers will appear here."/>}</div></section><section className="rw-card"><div className="rw-card-head"><div><h2>Legal assessment</h2><p>{bundle?.submission.documentTitle||'Select an item from the queue'}</p></div></div>{bundle?<><div className="rw-legal-summary"><Pill tone="violet">{bundle.submission.status}</Pill><span>Submitted v{bundle.submission.version} · score {bundle.submission.complianceScore??'—'}</span></div><div className="rw-legal-issues">{issues.map(issue=>{const over=overrides.find(o=>o.issueId===issue.id);return <article key={issue.id}><div><Severity value={issue.severity}/><b>{issue.title}</b></div><p>{issue.explanation}</p><small>{issue.source||'No approved source found'} · {issue.reference||'No reference available'}</small>{over?<Pill tone="violet">Overridden by {over.role}</Pill>:bundle.submission.status==='In Legal Review'&&issue.severity==='Critical'&&issue.status!=='Resolved'&&<button className="rw-button danger small" onClick={()=>setOverrideIssue(issue)}>Override critical issue</button>}</article>})}</div>{bundle.submission.status==='In Legal Review'?<><label className="rw-field">Legal comments / rationale<textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Record legal assessment and conditions…"/></label><div className="rw-decision-actions"><button className="rw-button primary" onClick={()=>decide('Approved')}><Check size={14}/> Approve legal review</button><button className="rw-button amber" disabled={!comment.trim()} onClick={()=>decide('Changes Requested')}>Request changes</button><button className="rw-button danger" disabled={!comment.trim()} onClick={()=>decide('Rejected')}>Reject document</button><button className="rw-button ghost" onClick={()=>nav('/app/audit')}>View audit trail</button></div></>:<div className="rw-alert"><Lock size={15}/><span><b>Not formally escalated to Legal.</b><small>Inspect this high-risk claim here. A Reviewer must send it to Legal before a Legal decision or override can be recorded.</small></span></div>}</>:<Empty icon={Gavel} title="Select a legal escalation" desc="The selected document's issue evidence and decision controls will appear here."/>}</section></div><AnimatePresence>{overrideIssue&&<Modal title="Legal Critical override" onClose={()=>setOverrideIssue(null)}><div className="rw-modal-body"><div className="rw-alert"><AlertTriangle size={15}/><span><b>{overrideIssue.title}</b><small>Legal override requires a written rationale and is permanently recorded in the demo audit history.</small></span></div><label className="rw-field">Mandatory reason<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="rw-modal-actions"><button className="rw-button ghost" onClick={()=>setOverrideIssue(null)}>Cancel</button><button className="rw-button danger" disabled={!reason.trim()} onClick={override}>Record Legal override</button></div></div></Modal>}</AnimatePresence></div>;
}

export function DocumentReviewIndexPage(){return <ReviewQueuePage/>;}
