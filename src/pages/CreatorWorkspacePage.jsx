import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bold, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, Copy, Download, Eye,
  FileClock, FilePlus2, FileText, Filter, Heading1, Heading2, Image as ImageIcon,
  Italic, Link2, List, ListOrdered, LoaderCircle, Lock, MessageSquareText, MoreHorizontal,
  PanelRightClose, PanelRightOpen, Pencil, Plus, Redo2, RotateCcw, Save, ScanLine,
  Search, Send, ShieldAlert, ShieldCheck, Sparkles, Strikethrough, Trash2, Underline,
  Undo2, Upload, X, XCircle, Zap
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../data/api.js';
import { addAuditEvent, getSubmissionComments } from '../data/reviewStore';
import { getBrandReferenceData, getApprovedFacts, getTerminologyRules, readKnowledgeBase } from '../data/knowledgeBaseStore';
import { scanBrandContent, extractPlainText } from '../data/brandScanner';
import {
  appendDocumentActivity, createCreatorDocument, deleteCreatorDocument, duplicateCreatorDocument,
  getCreatorDocument, readCreatorDocuments, saveCreatorDocument, saveScanResult, submitCreatorDocument,
  writeCreatorDocuments
} from '../data/creatorStore';

const fmt = value => value ? new Date(value).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const wordCount = value => (value.trim().match(/\b[\w'-]+\b/g) || []).length;
const scoreFor = issues => Math.max(0, Math.min(100, Math.round(100 - issues.filter(i=>!['Resolved','Dismissed'].includes(i.status)).reduce((n,i)=>n+({Critical:24,Major:12,Minor:5,Informational:1}[i.severity]||0),0))));
const cleanHtml = html => {
  const node=document.createElement('div'); node.innerHTML=html||'';
  node.querySelectorAll('mark[data-issue-id]').forEach(mark=>{const parent=mark.parentNode;while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);parent.removeChild(mark);});
  return node.innerHTML;
};
const plainEscape = value => String(value||'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function IconButton({title,children,onClick,active=false,disabled=false}){return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`cw-icon-button ${active?'active':''}`}>{children}</button>}
function Pill({children,tone='neutral'}){return <span className={`cw-pill ${tone}`}>{children}</span>}
function Severity({value}){return <span className={`cw-severity ${String(value||'Minor').toLowerCase()}`}>{value}</span>}
function ScanScene({reduced}){
 const ring=useRef(),beam=useRef();
 useFrame((state,delta)=>{if(reduced)return;if(ring.current)ring.current.rotation.z+=delta*.22;if(beam.current)beam.current.position.y=Math.sin(state.clock.elapsedTime*1.7)*.62;});
 return <group><ambientLight intensity={.9}/><pointLight position={[2,3,4]} intensity={2.4} color="#6aaaff"/><Float speed={reduced?0:1.1} rotationIntensity={reduced?0:.06} floatIntensity={reduced?0:.13}><mesh><boxGeometry args={[1.55,1.95,.08]}/><meshStandardMaterial color="#f8fbff" roughness={.8}/></mesh><mesh position={[-.45,.58,.052]}><boxGeometry args={[.52,.055,.015]}/><meshBasicMaterial color="#b5c9eb"/></mesh>{Array.from({length:5},(_,i)=><mesh key={i} position={[-.15,.28-i*.25,.052]}><boxGeometry args={[1.05-i%2*.18,.035,.015]}/><meshBasicMaterial color="#d3dff0"/></mesh>)}<mesh ref={beam} position={[0,0,.09]}><boxGeometry args={[1.6,.035,.02]}/><meshBasicMaterial color="#4e9bff" transparent opacity={.85}/></mesh><mesh ref={ring} position={[.68,.75,.15]}><torusGeometry args={[.16,.025,8,48]}/><meshBasicMaterial color="#8875e8"/></mesh></Float></group>;
}
class ScanSceneBoundary extends Component{
 constructor(props){super(props);this.state={failed:false};}
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
function ScanVisual({stage,progress}){
 const reduced=useReducedMotion();
 const fallback=<div className="cw-scan-webgl-fallback"><ShieldCheck size={32}/><span>Brand rules active</span></div>;
 return <div className="cw-scan-visual"><ScanSceneBoundary fallback={fallback}><Canvas camera={{position:[0,0,5],fov:38}} dpr={[1,1.5]} gl={{alpha:true,antialias:true}}><ScanScene reduced={reduced}/></Canvas></ScanSceneBoundary><div className="cw-scan-orbit"/><div className="cw-scan-float"><ShieldCheck size={16}/><span>Brand rules active</span></div><div className="cw-scan-caption"><b>{progress}%</b><span>{stage}</span></div></div>;
}
function Modal({title,children,onClose,wide=false}){return <div className="cw-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><motion.section className={`cw-modal ${wide?'wide':''}`} initial={{opacity:0,y:12,scale:.985}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}}><header><h3>{title}</h3><button onClick={onClose}><X size={17}/></button></header>{children}</motion.section></div>;}
function IssueCard({issue,active,onSelect,onAccept,onEdit,onDismiss,onRestore}) {
 const resolved=['Resolved','Dismissed'].includes(issue.status);
 return <motion.article layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.2}} className={`cw-issue-card ${active?'selected':''} ${resolved?'resolved':''}`} onClick={()=>onSelect(issue)}>
  <div className="cw-issue-top"><Severity value={issue.severity}/><span className="cw-issue-status">{issue.status}</span><button title="Issue details" onClick={e=>{e.stopPropagation();onSelect(issue);}}><ChevronRight size={15}/></button></div>
  <h4>{issue.title}</h4><blockquote>{issue.snippet}</blockquote>
  <div className="cw-issue-meta"><span>{issue.category}</span><span>·</span><span>{issue.evidenceStatus}</span></div>
  <p>{issue.explanation}</p>
  {issue.source&&<div className={`cw-source ${issue.source==='No approved source found'?'missing':''}`}><FileText size={13}/><span><b>{issue.source}</b><small>{issue.reference||'No page or section reference available'}</small></span></div>}
  {issue.suggestion&&<div className="cw-suggestion"><small>Suggested correction</small><p>{issue.suggestion}</p></div>}
  {issue.dismissalReason&&<div className="cw-dismissal"><b>Dismissal reason</b><span>{issue.dismissalReason}</span></div>}
  <div className="cw-issue-actions" onClick={e=>e.stopPropagation()}>
   {!resolved&&issue.suggestion&&<button className="primary" onClick={()=>onAccept(issue)}><Check size={13}/> Accept</button>}
   {!resolved&&issue.suggestion&&<button onClick={()=>onEdit(issue)}><Pencil size={13}/> Edit</button>}
   {!resolved&&<button onClick={()=>onDismiss(issue)}><X size={13}/> Dismiss</button>}
   {issue.status==='Resolved'&&issue.replacementApplied&&<button onClick={()=>onRestore(issue)}><RotateCcw size={13}/> Restore original</button>}
  </div>
 </motion.article>;
}
function ScoreRing({score}){
 const radius=29,circumference=2*Math.PI*radius,offset=circumference-(Math.max(0,Math.min(100,score))/100)*circumference;
 return <div className="cw-score-ring"><svg viewBox="0 0 72 72" aria-label={`Compliance score ${score} out of 100`}><circle className="track" cx="36" cy="36" r={radius}/><motion.circle className="progress" cx="36" cy="36" r={radius} strokeDasharray={circumference} initial={{strokeDashoffset:circumference}} animate={{strokeDashoffset:offset}} transition={{duration:.8,ease:'easeOut'}}/></svg><div><b>{score}</b><small>/ 100</small></div></div>;
}
function Summary({scan}){
 const issues=scan?.issues||[];
 const count=s=>issues.filter(i=>i.severity===s&&!['Resolved','Dismissed'].includes(i.status)).length;
 const resolved=issues.filter(i=>i.status==='Resolved').length, dismissed=issues.filter(i=>i.status==='Dismissed').length;
 return <div className="cw-summary-grid"><div className="cw-summary-score"><ScoreRing score={scoreFor(issues)}/><span>Demo compliance score</span></div><div className="cw-summary-stats"><div><b>{issues.length}</b><small>Total detected</small></div><div><b className="critical">{count('Critical')}</b><small>Critical open</small></div><div><b className="major">{count('Major')}</b><small>Major open</small></div><div><b className="minor">{count('Minor')}</b><small>Minor open</small></div><div><b className="resolved">{resolved}</b><small>Resolved</small></div><div><b>{dismissed}</b><small>Dismissed</small></div></div></div>;
}

export default function CreatorWorkspacePage(){
 const {documentId}=useParams();
 const navigate=useNavigate();
 const {user}=useAuth();
 const editorRef=useRef(null),fileRef=useRef(null),imageRef=useRef(null),scanTimer=useRef(null),skipEditorSync=useRef(false),didInit=useRef(false);
 const [doc,setDoc]=useState(null);
 const [docs,setDocs]=useState(()=>readCreatorDocuments());
 const [saveState,setSaveState]=useState('Saved');
 const [scan,setScan]=useState(null);
 const [scanning,setScanning]=useState(false);
 const [stageIndex,setStageIndex]=useState(0);
 const [progress,setProgress]=useState(0);
 const [activeIssue,setActiveIssue]=useState(null);
 const [issueFilter,setIssueFilter]=useState('All');
 const [issueSearch,setIssueSearch]=useState('');
 const [rightOpen,setRightOpen]=useState(true);
 const [modal,setModal]=useState(null);
 const [suggestionText,setSuggestionText]=useState('');
 const [dismissReason,setDismissReason]=useState('');
 const [preview,setPreview]=useState(false);
 const [imageData,setImageData]=useState(null);
 const [imageAlt,setImageAlt]=useState('');
 const [imageCheck,setImageCheck]=useState(null);
 const [toast,setToast]=useState('');
 const stages=['Reading document','Checking terminology','Verifying approved facts','Reviewing tone and messaging','Checking accessibility','Generating recommendations'];
 const kb=useMemo(()=>readKnowledgeBase(),[doc?.updatedAt,scan?.scannedAt]);
 const facts=useMemo(()=>getApprovedFacts(),[doc?.updatedAt,scan?.scannedAt]);
 const terminology=useMemo(()=>getTerminologyRules(),[doc?.updatedAt,scan?.scannedAt]);
 const brand=useMemo(()=>getBrandReferenceData(),[doc?.updatedAt,scan?.scannedAt]);
 const words=wordCount(extractPlainText(doc?.content||''));
 const chars=extractPlainText(doc?.content||'').length;
 const unresolved=(scan?.issues||[]).filter(i=>!['Resolved','Dismissed'].includes(i.status));
 const critical=unresolved.filter(i=>i.severity==='Critical');
 const visibleIssues=(scan?.issues||[]).filter(issue=>(issueFilter==='All'||(issueFilter==='Unresolved'?!['Resolved','Dismissed'].includes(issue.status):issue.status===issueFilter||issue.severity===issueFilter))&&`${issue.title} ${issue.snippet} ${issue.category} ${issue.explanation}`.toLowerCase().includes(issueSearch.toLowerCase()));
 const activeIssueObject=(scan?.issues||[]).find(i=>i.id===activeIssue);

 const refreshDocs=()=>setDocs(readCreatorDocuments());
 const persist=(next,options={})=>{
   const saved=saveCreatorDocument(next,readCreatorDocuments(),options);
   setDoc(saved);refreshDocs();setSaveState('Saved');
   const payload={title:saved.title,content:saved.content,clientDocumentId:saved.id};
   (saved.backendId?api(`/documents/${saved.backendId}`,{method:'PATCH',body:payload}):api('/documents',{method:'POST',body:payload})).then(remote=>{if(!saved.backendId){const linked={...saved,backendId:remote._id};saveCreatorDocument(linked,readCreatorDocuments());setDoc(current=>current?.id===linked.id?linked:current);refreshDocs();}}).catch(err=>console.error('Backend document sync failed:',err.message));
   return saved;
 };
 const notify=message=>{setToast(message);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(''),2600);};
 const updateDoc=patch=>setDoc(current=>current?({...current,...patch}):current);

 useEffect(()=>{
   if(user?.role!=='Creator')return;
   if(!documentId&&didInit.current)return;
   didInit.current=true;
   if(documentId){
     const existing=getCreatorDocument(documentId);
     if(existing&&(existing.creatorId===user?.email||existing.creatorId===user?.name)){setDoc(existing);setScan(existing.scanResults||null);setSaveState('Saved');}else if(existing){notify('This document belongs to another creator.');navigate('/app/my-documents',{replace:true});}
     else {notify('Document not found. Create a new draft.');navigate('/app/create',{replace:true});}
   } else {
     const created=createCreatorDocument(user);
     const saved=saveCreatorDocument(created);
     addAuditEvent(user,'Document created',saved,{documentId:saved.id});
     setDoc(saved);setScan(null);refreshDocs();navigate(`/app/create/${saved.id}`,{replace:true});
   }
   return ()=>{if(scanTimer.current)window.clearInterval(scanTimer.current);};
 },[documentId,user?.role]);

 useEffect(()=>{
   if(!doc||!editorRef.current||skipEditorSync.current)return;
   if(editorRef.current.dataset.docId!==doc.id){
     editorRef.current.dataset.docId=doc.id;
     editorRef.current.innerHTML=doc.content||'';
   }
 },[doc?.id]);
 useEffect(()=>{
   if(!doc||!editorRef.current)return;
   if(saveState==='Saved')return;
   const timer=window.setTimeout(()=>{
     const content=cleanHtml(editorRef.current?.innerHTML||doc.content);
     const saved=saveCreatorDocument({...doc,content},readCreatorDocuments());
     const payload={title:saved.title,content:saved.content,clientDocumentId:saved.id};
     (saved.backendId?api(`/documents/${saved.backendId}`,{method:'PATCH',body:payload}):api('/documents',{method:'POST',body:payload})).then(remote=>{if(!saved.backendId){const linked={...saved,backendId:remote._id};saveCreatorDocument(linked,readCreatorDocuments());setDoc(current=>current?.id===linked.id?linked:current);}}).catch(err=>console.error('Backend autosave failed:',err.message));
     addAuditEvent(user,'Document edited',saved,{version:saved.version,autosave:true});
     setDoc(saved);refreshDocs();setSaveState('Saved');
   },850);
   return ()=>window.clearTimeout(timer);
 },[doc?.content,doc?.title,doc?.status,saveState]);
 useEffect(()=>()=>{if(imageData?.url)URL.revokeObjectURL(imageData.url);},[imageData?.url]);
 useEffect(()=>{if(scan&&editorRef.current)applyHighlights(scan.issues);},[scan?.issues,doc?.id]);

 function applyHighlights(issues){
   const root=editorRef.current;if(!root)return;
   root.querySelectorAll('mark[data-issue-id]').forEach(mark=>{const parent=mark.parentNode;while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);parent.removeChild(mark);});
   const textIssues=(issues||[]).filter(i=>i.start>=0&&i.snippet&&!['Resolved','Dismissed'].includes(i.status));
   textIssues.forEach(issue=>{
     const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
     let node,done=false;
     while((node=walker.nextNode())){
       const index=node.textContent.toLowerCase().indexOf(issue.snippet.toLowerCase());
       if(index<0)continue;
       const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+issue.snippet.length);
       const mark=document.createElement('mark');mark.className=`cw-highlight ${issue.severity.toLowerCase()}`;mark.dataset.issueId=issue.id;
       try{range.surroundContents(mark);done=true;}catch{}
       if(done)break;
     }
   });
 }
 function selectIssue(issue){
   setActiveIssue(issue.id);setRightOpen(true);
   if(issue.start<0||!issue.snippet||!editorRef.current)return;
   const root=editorRef.current;
   const marks=[...root.querySelectorAll('mark[data-issue-id]')];
   const target=marks.find(m=>m.dataset.issueId===issue.id);
   if(target){target.scrollIntoView({behavior:'smooth',block:'center'});const range=document.createRange();range.selectNodeContents(target);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
   else{
     const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
     while((node=walker.nextNode())){const i=node.textContent.toLowerCase().indexOf(issue.snippet.toLowerCase());if(i>=0){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+issue.snippet.length);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);node.parentElement?.scrollIntoView({behavior:'smooth',block:'center'});break;}}
   }
 }
 function onEditorInput(){
   if(!doc)return;
   editorRef.current?.querySelectorAll('mark[data-issue-id]').forEach(mark=>{const parent=mark.parentNode;while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);parent.removeChild(mark);});
   const content=cleanHtml(editorRef.current?.innerHTML||'');
   setSaveState('Saving…');setDoc(current=>({...current,content,updatedAt:new Date().toISOString()}));
   if(scan){setScan(null);updateDoc({scanResults:null});}
 }
 async function runScan(){
   if(!doc||scanning)return;
   const content=cleanHtml(editorRef.current?.innerHTML||doc.content||'');
   if(!extractPlainText(content).trim()){notify('Add document content before scanning.');return;}
   setScanning(true);setProgress(8);setStageIndex(0);
   try{
     let backendId=doc.backendId;
     if(!backendId){
       const created=await api('/documents',{method:'POST',body:{title:doc.title,content,clientDocumentId:doc.id}});
       backendId=created._id;
     }else{
       await api(`/documents/${backendId}`,{method:'PATCH',body:{title:doc.title,content,clientDocumentId:doc.id}});
     }
     const base=await api('/scan',{method:'POST',body:{content,documentId:backendId}});
     const previous=scan?.issues||doc.scanResults?.issues||[];
     const issues=(base.issues||[]).map(issue=>{const old=previous.find(item=>item.ruleId===issue.ruleId&&String(item.snippet||'').toLowerCase()===String(issue.snippet||'').toLowerCase());return old&&['Dismissed','Resolved'].includes(old.status)?{...issue,status:old.status,dismissalReason:old.dismissalReason,originalText:old.originalText,replacementApplied:old.replacementApplied}:issue;});
     const merged={...base,issues,scannedAt:new Date().toISOString()};
     setProgress(100);setStageIndex(stages.length-1);
     const savedScan=saveScanResult(doc.id,merged,user);
     addAuditEvent(user,'Scan performed',doc,{scanId:savedScan.id,issueCount:issues.length,score:merged.score});
     const result={...merged,id:savedScan.id,scannedAt:savedScan.scannedAt};
     setScan(result);setDoc(current=>({...current,content,scanResults:result}));setSaveState('Saving…');
     persist({...doc,backendId,content,scanResults:result});
     notify(`AI scan complete · ${issues.length} issue${issues.length===1?'':'s'} detected.`);
   }catch(error){notify(error.message||'Could not connect to the BrandGuard API.');}
   finally{setScanning(false);setProgress(0);setStageIndex(0);}
 }

 function replaceSnippet(issue,replacement){
   const root=editorRef.current;if(!root||!issue.snippet)return false;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode())){
     const index=node.textContent.toLowerCase().indexOf(issue.snippet.toLowerCase());
     if(index<0)continue;
     const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+issue.snippet.length);
     range.deleteContents();range.insertNode(document.createTextNode(replacement));
     return true;
   }
   return false;
 }
 function updateIssueStatus(issueId,patch){
   setScan(current=>{
     if(!current)return current;
     const issues=current.issues.map(issue=>issue.id===issueId?{...issue,...patch}:issue);
     const next={...current,issues,score:scoreFor(issues)};
     setDoc(d=>d?({...d,scanResults:next}):d);
     return next;
   });
 }
 function acceptSuggestion(issue,replacement=issue.suggestion){
   if(!replacement?.trim()){notify('No suggested replacement is available.');return;}
   const replaced=replaceSnippet(issue,replacement);
   if(!replaced){notify('The original text could not be located. Re-scan the document.');return;}
   const content=cleanHtml(editorRef.current.innerHTML);
   const nextIssues=(scan?.issues||[]).map(item=>item.id===issue.id?{...item,status:'Resolved',originalText:issue.snippet,replacementApplied:replacement}:item);
   const nextScan={...scan,issues:nextIssues,score:scoreFor(nextIssues),scannedAt:new Date().toISOString()};
   setScan(nextScan);setDoc(current=>({...current,content,scanResults:nextScan,updatedAt:new Date().toISOString()}));setSaveState('Saving…');
   persist({...doc,content,scanResults:nextScan});addAuditEvent(user,'Suggestion accepted',doc,{issueId:issue.id,suggestion:replacement});setActiveIssue(issue.id);notify('Suggestion applied and issue marked resolved.');
 }
 function editSuggestion(issue){setSuggestionText(issue.suggestion||'');setModal({type:'edit-suggestion',issue});}
 function dismissIssue(issue){
   setDismissReason('');setModal({type:'dismiss',issue});
 }
 function confirmDismiss(){
   const issue=modal.issue;
   if(issue.severity==='Critical'&&!dismissReason.trim()){notify('A dismissal reason is required for Critical issues.');return;}
   const issues=scan.issues.map(item=>item.id===issue.id?{...item,status:'Dismissed',dismissalReason:dismissReason.trim()||'Dismissed by creator'}:item);
   const nextScan={...scan,issues,score:scoreFor(issues)};
   setScan(nextScan);persist({...doc,scanResults:nextScan,dismissedIssues:{...(doc.dismissedIssues||{}),[issue.id]:dismissReason.trim()||'Dismissed by creator'}});
   addAuditEvent(user,'Issue dismissed',doc,{issueId:issue.id,reason:dismissReason.trim()||'Dismissed by creator'});setModal(null);notify('Issue dismissal recorded.');
 }
 function restoreOriginal(issue){
   if(!issue.originalText||!issue.replacementApplied){notify('Original text is not available.');return;}
   const root=editorRef.current;const text=extractPlainText(root.innerHTML);
   if(!text.includes(issue.replacementApplied)){notify('Applied text is no longer present. Restore manually.');return;}
   const reverse={...issue,snippet:issue.replacementApplied};
   const replaced=replaceSnippet(reverse,issue.originalText);
   if(!replaced){notify('Could not restore original text.');return;}
   const content=cleanHtml(root.innerHTML);
   const issues=scan.issues.map(item=>item.id===issue.id?{...item,status:'Open',originalText:null,replacementApplied:null}:item);
   const nextScan={...scan,issues,score:scoreFor(issues)};
   setScan(nextScan);persist({...doc,content,scanResults:nextScan});notify('Original wording restored.');
 }
 function saveNow(checkpoint=true){
   if(!doc)return;
   const content=cleanHtml(editorRef.current?.innerHTML||doc.content);
   const changed=doc.lastCheckpointContent!==content||doc.lastCheckpointTitle!==doc.title;
   const checkpointFields=checkpoint?{lastCheckpointContent:content,lastCheckpointTitle:doc.title,lastCheckpointAt:new Date().toISOString()}:{};
   const next=appendDocumentActivity({...doc,content,...checkpointFields},'Draft saved','saved');
   const saved=persist(next,{newVersion:checkpoint&&changed});
   addAuditEvent(user,'Document edited',saved,{version:saved.version});
   notify('Draft saved.');
   return saved;
 }
 function duplicate(){
   if(!doc)return;
   const copy=duplicateCreatorDocument(doc,user);refreshDocs();navigate(`/app/create/${copy.id}`);notify('Document duplicated.');
 }
 function deleteCurrent(){
   if(!doc||!window.confirm(`Delete “${doc.title}”? This cannot be undone.`))return;
   deleteCreatorDocument(doc.id);addAuditEvent(user,'Document deleted',doc,{documentId:doc.id});refreshDocs();navigate('/app/my-documents');notify('Document deleted.');
 }
 function setTitle(value){updateDoc({title:value});setSaveState('Saving…');}
 function insertCommand(command,value=null){editorRef.current?.focus();document.execCommand(command,false,value);onEditorInput();}
 function addLink(){const url=window.prompt('Enter the link URL (https://…)');if(!url)return;if(!/^https?:\/\//i.test(url)){notify('Use a complete http or https URL.');return;}insertCommand('createLink',url);}
 async function importFile(file){
   if(!file)return;
   const ext=file.name.split('.').pop().toLowerCase();
   if(!['txt','md'].includes(ext)){notify('This build supports TXT and Markdown imports. DOCX parsing is not installed.');return;}
   const content=await file.text();
   if(editorRef.current)editorRef.current.innerHTML=ext==='md'?markdownToHtml(content):`<p>${plainEscape(content).replace(/\n/g,'<br>')}</p>`;
   onEditorInput();notify(`${file.name} imported.`);
 }
 function markdownToHtml(value){
   return value.split(/\n/).map(line=>line.startsWith('### ')?`<h3>${plainEscape(line.slice(4))}</h3>`:line.startsWith('## ')?`<h2>${plainEscape(line.slice(3))}</h2>`:line.startsWith('# ')?`<h1>${plainEscape(line.slice(2))}</h1>`:line.startsWith('- ')?`<p>• ${plainEscape(line.slice(2))}</p>`:`<p>${plainEscape(line)||'<br>'}</p>`).join('');
 }
 function downloadDocument(){
   if(!doc)return;
   const content=extractPlainText(cleanHtml(editorRef.current?.innerHTML||doc.content||''));
   const blob=new Blob([content],{type:'text/markdown;charset=utf-8'});
   const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
   anchor.href=url;anchor.download=`${(doc.title||'brandguard-document').replace(/[^a-z0-9-_]+/gi,'-')}.md`;
   document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);notify('Markdown document downloaded.');
 }
 function submitOpen(){saveNow(false);setModal({type:'submit'});}
 async function submitForReview(){
   const currentScan=scan;
   if(!extractPlainText(cleanHtml(editorRef.current?.innerHTML||doc.content||'')).trim()){notify('Add document content before submitting.');return;}
   if(!currentScan){notify('Run a scan before submitting for review.');return;}
   const content=cleanHtml(editorRef.current?.innerHTML||doc.content||'');
   let backendId=doc.backendId;
   let serverScan;
   try{
     if(!backendId){const remote=await api('/documents',{method:'POST',body:{title:doc.title,content,clientDocumentId:doc.id}});backendId=remote._id;}
     else await api(`/documents/${backendId}`,{method:'PATCH',body:{title:doc.title,content,clientDocumentId:doc.id}});
     serverScan=await api('/scan',{method:'POST',body:{content,documentId:backendId}});
     await api(`/documents/${backendId}/submit`,{method:'POST'});
   }catch(error){notify(`Could not submit to the server: ${error.message}`);return;}
   const checkpoint=saveCreatorDocument({...doc,backendId,content,lastCheckpointContent:content,lastCheckpointTitle:doc.title,lastCheckpointAt:new Date().toISOString(),lastCheckpointScanResults:serverScan},readCreatorDocuments(),{newVersion:true});
   const submission=submitCreatorDocument(checkpoint,user,serverScan);
   const next=appendDocumentActivity({...checkpoint,status:'In Review',submissionId:submission.id,submittedAt:submission.submittedAt},'Submitted for review','submitted');
   persist(next);addAuditEvent(user,submission.previousSubmissionId?'Document resubmitted':'Document submitted',next,{version:submission.version,submissionId:submission.id,previousSubmissionId:submission.previousSubmissionId||null},submission.id);setModal(null);notify('Submitted to the Reviewer Queue.');
 }
 async function inspectImage(file){
   if(!file)return;
   if(!file.type.startsWith('image/')){notify('Choose an image file.');return;}
   const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{
     let dominant='#808080';
     try{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,24,24);const pixels=ctx.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;for(let i=0;i<pixels.length;i+=16){r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];n++;}dominant='#'+[r/n,g/n,b/n].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}catch{}
     const colors=brand?.colors||[];const rgb=h=>{const x=h.replace('#','');return [0,2,4].map(i=>parseInt(x.slice(i,i+2),16));};const dist=(a,b)=>Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0));const nearest=colors.filter(c=>/^#[0-9a-f]{6}$/i.test(c.hex)).map(c=>({name:c.name,hex:c.hex,distance:dist(rgb(dominant),rgb(c.hex))})).sort((a,b)=>a.distance-b.distance)[0];
     setImageData({url,name:file.name,width:img.naturalWidth,height:img.naturalHeight,size:file.size});setImageCheck({dominant,nearest,colorMatch:!!nearest&&nearest.distance<95,method:'Average sampled pixel colour compared with Part 2 HEX palette; not computer vision.'});setImageAlt('');
   };img.onerror=()=>{URL.revokeObjectURL(url);notify('Image could not be read.');};img.src=url;
 }
 function addImageToDocument(){
   if(!imageData)return;
   const html=`<p><img src="about:blank" alt="${plainEscape(imageAlt)}" data-brand-image="true"></p><p><br></p>`;
   insertCommand('insertHTML',html);notify('Image placeholder added. The uploaded binary remains temporary in this browser session.');
 }
 const handleEditorClick=e=>{const mark=e.target.closest('mark[data-issue-id]');if(mark){const issue=scan?.issues?.find(i=>i.id===mark.dataset.issueId);if(issue)selectIssue(issue);}};
 const severityCounts=useMemo(()=>['Critical','Major','Minor','Informational'].map(s=>({severity:s,count:unresolved.filter(i=>i.severity===s).length})),[scan?.issues]);
 const locked=!!doc&&['In Review','In Legal Review','Approved','Published','Rejected'].includes(doc.status);
 const reviewerComments=doc?(getSubmissionComments(doc.reviewedSubmissionId||doc.submissionId).filter(item=>['Reviewer','Legal'].includes(item.role))):[];
 if(user?.role!=='Creator')return <div className="cw-access-denied"><ShieldAlert size={25}/><b>Creator access required</b><span>This workspace is available to Creator accounts only.</span></div>;
 if(!doc)return <div className="cw-loading"><LoaderCircle className="spin" size={24}/> Opening creator workspace…</div>;

 return <div className="creator-workspace">
  <div className="cw-topline"><div><div className="cw-eyebrow"><Sparkles size={13}/> CREATOR STUDIO <span>·</span> BRAND GOVERNANCE</div><div className="cw-title-row"><input className="cw-title-input" aria-label="Document title" disabled={locked} value={doc.title} onChange={e=>setTitle(e.target.value)} onBlur={()=>setSaveState('Saving…')}/><button title="Document actions" className="cw-more" onClick={()=>setModal({type:'actions'})}><MoreHorizontal size={19}/></button></div><div className="cw-meta"><span><span className="cw-save-dot"/> {saveState}</span><span>·</span><span>Version {doc.version||1}</span><span>·</span><span>Updated {fmt(doc.updatedAt)}</span><Pill tone={doc.status==='In Review'?'blue':'neutral'}>{doc.status}</Pill></div></div>
   <div className="cw-top-actions"><button className="cw-btn secondary" onClick={()=>setPreview(true)}><Eye size={15}/> Preview</button><button className="cw-btn secondary" onClick={saveNow} disabled={locked}><Save size={15}/> Save draft</button><button className="cw-btn primary" onClick={runScan} disabled={scanning||locked}><ScanLine size={16}/> {scanning?'Scanning…':'Scan document'}</button><button className="cw-btn submit" onClick={submitOpen} disabled={locked}><Send size={15}/> {doc.status==='Changes Requested'?'Resubmit for review':'Submit for review'}</button></div>
  </div>
  {(doc.status==='Changes Requested'||reviewerComments.length>0)&&<section className="cw-review-feedback cw-review-feedback-panel"><div><b>Reviewer feedback</b><Pill tone="amber">{doc.status}</Pill></div>{doc.changesRequestedReason&&<p>{doc.changesRequestedReason}</p>}{reviewerComments.map(item=><article key={item.id}><b>{item.authorName} · {item.role}</b><span>{item.anchorText&&`Selected text: “${item.anchorText}” · `}{item.body}</span><small>{fmt(item.createdAt)}{item.resolved?' · Resolved':''}</small></article>)}</section>}<div className="cw-main-grid">
   <section className="cw-editor-column">
    <div className="cw-editor-toolbar"><div className="cw-tool-group"><IconButton title="Undo" onClick={()=>insertCommand('undo')}><Undo2 size={15}/></IconButton><IconButton title="Redo" onClick={()=>insertCommand('redo')}><Redo2 size={15}/></IconButton></div><i/><div className="cw-tool-group"><select aria-label="Text style" onChange={e=>insertCommand('formatBlock',e.target.value)} defaultValue="P"><option value="P">Paragraph</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option><option value="BLOCKQUOTE">Quote</option></select><IconButton title="Bold" onClick={()=>insertCommand('bold')}><Bold size={15}/></IconButton><IconButton title="Italic" onClick={()=>insertCommand('italic')}><Italic size={15}/></IconButton><IconButton title="Underline" onClick={()=>insertCommand('underline')}><Underline size={15}/></IconButton></div><i/><div className="cw-tool-group"><IconButton title="Bulleted list" onClick={()=>insertCommand('insertUnorderedList')}><List size={15}/></IconButton><IconButton title="Numbered list" onClick={()=>insertCommand('insertOrderedList')}><ListOrdered size={15}/></IconButton><IconButton title="Insert link" onClick={addLink}><Link2 size={15}/></IconButton><IconButton title="Clear formatting" onClick={()=>insertCommand('removeFormat')}><Strikethrough size={15}/></IconButton></div><i/><div className="cw-tool-group"><IconButton title="Import TXT or Markdown" onClick={()=>fileRef.current?.click()}><Upload size={15}/></IconButton><IconButton title="Image compliance" onClick={()=>imageRef.current?.click()}><ImageIcon size={15}/></IconButton></div></div>
    <input ref={fileRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={e=>{importFile(e.target.files[0]);e.target.value='';}}/><input ref={imageRef} hidden type="file" accept="image/*" onChange={e=>{inspectImage(e.target.files[0]);e.target.value='';}}/>
    <div className="cw-paper-wrap"><div className="cw-paper-top"><span><FileText size={14}/> DOCUMENT EDITOR</span><span>Autosave enabled</span></div><div ref={editorRef} className={`cw-rich-editor ${locked?'locked':''}`} contentEditable={!locked} suppressContentEditableWarning spellCheck onInput={onEditorInput} onClick={handleEditorClick} data-placeholder="Start writing your content here…&#10;&#10;Tip: Include factual claims, product messaging and approved terminology to test the scanner."/><div className="cw-editor-footer"><span>{words} words · {chars} characters</span><span>Rich text · Local draft</span></div></div>
    {imageData&&<div className="cw-image-check"><div className="cw-image-preview"><img src={imageData.url} alt={imageAlt||'Uploaded image preview'}/></div><div className="cw-image-info"><div className="cw-image-title"><b>Image compliance check</b><button onClick={()=>{URL.revokeObjectURL(imageData.url);setImageData(null);setImageCheck(null);}}><X size={14}/></button></div><small>{imageData.name} · {imageData.width} × {imageData.height} · {(imageData.size/1024).toFixed(0)} KB</small><label>Alternative text<input value={imageAlt} onChange={e=>setImageAlt(e.target.value)} placeholder="Describe the information conveyed by this image"/></label><div className="cw-image-result"><span className={imageAlt.trim()?'pass':'fail'}>{imageAlt.trim()?'Alt text provided':'Missing alt text'}</span><span>Sampled colour {imageCheck?.dominant}</span>{imageCheck?.nearest&&<span>{imageCheck.colorMatch?'Approximate palette proximity':'Low palette proximity'} · nearest: {imageCheck.nearest.name} ({imageCheck.nearest.hex})</span>}<span>Logo match: Not verified automatically</span></div><small className="cw-muted">{imageCheck?.method}</small><button className="cw-btn secondary" onClick={addImageToDocument}><Plus size={13}/> Insert image placeholder</button></div></div>}
    <div className="cw-editor-bottom"><div><span><Clock3 size={13}/> Draft is stored in this browser</span><span><Lock size={13}/> Private demo workspace</span></div><div><button onClick={duplicate}><Copy size={14}/> Duplicate</button><button onClick={deleteCurrent}><Trash2 size={14}/> Delete</button></div></div>
   </section>
   <aside className={`cw-issues-column ${rightOpen?'':'collapsed'}`}>
    <div className="cw-panel-header"><div><span className="cw-panel-kicker">BRANDGUARD SCANNER</span><h3>Compliance review</h3><p>Rule-based checks against your approved brand knowledge.</p></div><button title={rightOpen?'Collapse panel':'Expand panel'} onClick={()=>setRightOpen(!rightOpen)}>{rightOpen?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button></div>
    {rightOpen&&<>
      {scanning?<div className="cw-scanning-card"><ScanVisual stage={stages[stageIndex]} progress={progress}/><div className="cw-stage-list">{stages.map((stage,i)=><div key={stage} className={i<stageIndex?'done':i===stageIndex?'current':''}>{i<stageIndex?<CheckCircle2 size={14}/>:i===stageIndex?<LoaderCircle size={14} className="spin"/>:<span/>}{stage}</div>)}</div><div className="cw-simulation-note"><Zap size={13}/> Server-side AI analysis</div></div>:scan?<><div className="cw-score-card"><div><span>COMPLIANCE SCORE</span><h2>{scoreFor(scan.issues)}<small>/100</small></h2><p>{unresolved.length?`${unresolved.length} open issues need attention`:'No unresolved issues detected'}</p></div><ScoreRing score={scoreFor(scan.issues)}/></div><div className="cw-severity-grid">{severityCounts.map(item=><div key={item.severity}><span className={`cw-sev-dot ${item.severity.toLowerCase()}`}/><b>{item.count}</b><small>{item.severity}</small></div>)}</div><div className="cw-panel-toolbar"><b>Detected issues <span>{scan.issues.length}</span></b><select value={issueFilter} onChange={e=>setIssueFilter(e.target.value)}><option>All</option><option>Critical</option><option>Major</option><option>Minor</option><option>Informational</option><option>Resolved</option><option>Dismissed</option><option>Open</option><option>Unresolved</option></select></div><div className="cw-category-breakdown">{(scan.categoryBreakdown||[]).filter(item=>item.count>0).map(item=><div key={item.category}><span>{item.category}</span><b>{item.count}</b><i style={{width:`${Math.max(6,item.count/Math.max(1,scan.issues.length)*100)}%`}}/></div>)}</div><div className="cw-evidence-breakdown">{(scan.evidenceBreakdown||[]).map(item=><span key={item.classification}><b>{item.count}</b>{item.classification}</span>)}</div><div className="cw-issue-search"><Search size={14}/><input value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} placeholder="Search issues…"/></div><div className="cw-issue-list">{visibleIssues.map(issue=><IssueCard key={issue.id} issue={issue} active={activeIssue===issue.id} onSelect={selectIssue} onAccept={acceptSuggestion} onEdit={editSuggestion} onDismiss={dismissIssue} onRestore={restoreOriginal}/>)}{!visibleIssues.length&&<div className="cw-empty"><CheckCircle2 size={22}/><b>No matching issues</b><span>Change the filter or search term.</span></div>}</div><div className="cw-scan-foot"><span>Last scan {fmt(scan.scannedAt)}</span><button onClick={runScan}><RotateCcw size={13}/> Re-scan</button></div></>:<div className="cw-no-scan"><div className="cw-no-scan-icon"><ScanLine size={25}/></div><h4>Ready to review your content</h4><p>Run a scan to compare this document with the active brand rules configured in your workspace.</p><button className="cw-btn primary" onClick={runScan}><ScanLine size={15}/> Scan document</button><div className="cw-checklist"><span><Check size={13}/> Approved terminology</span><span><Check size={13}/> Verified facts</span><span><Check size={13}/> Claims and accessibility</span></div><small>Server-side AI analysis · Human review recommended</small></div>}
    </>}
   </aside>
  </div>
  <div className="cw-bottom-bar"><div><span><FileText size={14}/> {doc.title}</span><span>{words} words</span><span>{scan?`${unresolved.length} unresolved issues`:'Not scanned yet'}</span></div><button onClick={()=>setModal({type:'history'})}><FileClock size={14}/> Version history</button><button className="cw-bottom-submit" onClick={submitOpen}><Send size={14}/> Review summary <ArrowRight size={14}/></button></div>

  <AnimatePresence>{modal?.type==='edit-suggestion'&&<Modal title="Edit suggested correction" onClose={()=>setModal(null)}><div className="cw-modal-copy"><small>ORIGINAL TEXT</small><blockquote>{modal.issue.snippet}</blockquote><label>Suggested replacement<textarea rows="4" value={suggestionText} onChange={e=>setSuggestionText(e.target.value)}/></label><div className="cw-modal-actions"><button className="cw-btn secondary" onClick={()=>setModal(null)}>Cancel</button><button className="cw-btn primary" onClick={()=>{acceptSuggestion(modal.issue,suggestionText);setModal(null);}}>Apply edited correction</button></div></div></Modal>}</AnimatePresence>
  <AnimatePresence>{modal?.type==='dismiss'&&<Modal title="Dismiss issue" onClose={()=>setModal(null)}><div className="cw-modal-copy"><Pill tone={modal.issue.severity==='Critical'?'critical':'neutral'}>{modal.issue.severity}</Pill><p>Dismiss “{modal.issue.title}” without changing the document text.</p><label>Reason {modal.issue.severity==='Critical'&&<b className="required">Required for Critical issues</b>}<textarea rows="3" value={dismissReason} onChange={e=>setDismissReason(e.target.value)} placeholder="Explain why this issue does not require a change…"/></label><div className="cw-modal-actions"><button className="cw-btn secondary" onClick={()=>setModal(null)}>Cancel</button><button className="cw-btn primary" onClick={confirmDismiss}>Record dismissal</button></div></div></Modal>}</AnimatePresence>
  <AnimatePresence>{modal?.type==='submit'&&<Modal title="Pre-submission review" onClose={()=>setModal(null)} wide><div className="cw-modal-copy"><div className="cw-submission-title"><div><small>DOCUMENT</small><h4>{doc.title}</h4><span>Version {doc.version} · {doc.status}</span></div><Pill tone="blue">Server-backed submission</Pill></div><Summary scan={scan}/>{!extractPlainText(doc.content||'').trim()&&<div className="cw-submit-warning"><AlertTriangle size={16}/> Add document content before submitting.</div>}{!scan&&<div className="cw-submit-warning"><AlertTriangle size={16}/> Run a document scan before submitting.</div>}{critical.length>0&&<div className="cw-submit-warning"><ShieldAlert size={17}/><span><b>Submission blocked</b><small>{critical.length} unresolved Critical issue(s) must be resolved. Reviewer/legal override is not implemented in this part.</small></span></div>}{scan&&critical.length===0&&<div className="cw-submit-success"><CheckCircle2 size={16}/> No unresolved Critical issues. This document can be submitted for review.</div>}<div className="cw-ai-disclosure"><CircleHelp size={15}/><span>AI-use disclosure: this scan is generated by the configured server-side AI model using active brand rules stored in the workspace database. AI findings require human review.</span></div><div className="cw-modal-actions"><button className="cw-btn secondary" onClick={()=>setModal(null)}>Back to editor</button><button className="cw-btn secondary" onClick={()=>{saveNow();setModal(null);}}>Save draft</button><button className="cw-btn primary" disabled={!scan||critical.length>0||!extractPlainText(doc.content||'').trim()} onClick={submitForReview}><Send size={14}/> Submit for review</button></div></div></Modal>}</AnimatePresence>
  <AnimatePresence>{modal?.type==='history'&&<Modal title="Document version history" onClose={()=>setModal(null)} wide><div className="cw-history-list"><div className="cw-history-row"><span className="current">V{doc.version||1}</span><div><b>Current version</b><small>{fmt(doc.updatedAt)} · {doc.status}</small><p>{doc.title}</p></div><Pill tone="blue">Current</Pill></div>{(doc.versions||[]).slice().reverse().map(v=><div className="cw-history-row" key={`${v.version}-${v.savedAt}`}><span>V{v.version}</span><div><b>Saved snapshot</b><small>{fmt(v.savedAt)} · {v.status}</small><p>{v.title}</p><button onClick={()=>{if(!window.confirm(`Restore version ${v.version}? Current content will be saved as a new version.`))return;const restored=persist({...doc,title:v.title,content:v.content,status:v.status,scanResults:v.scanResults,lastCheckpointContent:v.content,lastCheckpointTitle:v.title,lastCheckpointAt:new Date().toISOString(),lastCheckpointScanResults:v.scanResults},{newVersion:true});if(editorRef.current)editorRef.current.innerHTML=restored.content;setScan(restored.scanResults);setModal(null);notify(`Version ${v.version} restored.`);}}>Restore this version</button></div></div>)}</div></Modal>}</AnimatePresence>
  <AnimatePresence>{modal?.type==='activity'&&<Modal title="Document activity" onClose={()=>setModal(null)}><div className="cw-activity-list">{(doc.activity||[]).map(item=><div key={item.id}><span><Activity size={13}/></span><div><b>{item.label}</b><small>{fmt(item.at)} · {item.type}</small></div></div>)}</div></Modal>}</AnimatePresence>
  <AnimatePresence>{modal?.type==='actions'&&<Modal title="Document actions" onClose={()=>setModal(null)}><div className="cw-action-menu"><button onClick={()=>{setModal(null);duplicate();}}><Copy size={16}/> Duplicate document</button><button onClick={()=>{setModal(null);setModal({type:'history'});}}><FileClock size={16}/> View version history</button><button onClick={()=>setModal({type:'activity'})}><Activity size={16}/> View document activity</button><button onClick={()=>{setModal(null);saveNow();}}><Save size={16}/> Save draft</button><button onClick={()=>{setModal(null);downloadDocument();}}><Download size={16}/> Download Markdown</button><button className="danger" onClick={()=>{setModal(null);deleteCurrent();}}><Trash2 size={16}/> Delete document</button></div></Modal>}</AnimatePresence>
  <AnimatePresence>{preview&&<Modal title="Document preview" onClose={()=>setPreview(false)} wide><div className="cw-preview"><div><small>BRANDGUARD AI · {doc.status.toUpperCase()}</small><h1>{doc.title}</h1><p>{user?.name} · Version {doc.version}</p></div><article dangerouslySetInnerHTML={{__html:cleanHtml(editorRef.current?.innerHTML||doc.content)}}/></div></Modal>}</AnimatePresence>
  {toast&&<motion.div className="cw-toast" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}><CheckCircle2 size={15}/>{toast}</motion.div>}
 </div>;
}

export function CreatorDocumentsPage(){
 const {user}=useAuth();const navigate=useNavigate();const [docs,setDocs]=useState(()=>readCreatorDocuments());const [query,setQuery]=useState('');const [filter,setFilter]=useState('All');
 const refresh=()=>setDocs(readCreatorDocuments());
 const ownedDocs=docs.filter(d=>d.creatorId===user?.email||d.creatorId===user?.name);
 const filtered=ownedDocs.filter(d=>(filter==='All'||d.status===filter)&&`${d.title} ${d.status}`.toLowerCase().includes(query.toLowerCase()));
 function create(){const doc=createCreatorDocument(user);saveCreatorDocument(doc);refresh();navigate(`/app/create/${doc.id}`);}
 function duplicate(doc){const copy=duplicateCreatorDocument(doc,user);refresh();navigate(`/app/create/${copy.id}`);}
 function remove(doc){if(!window.confirm(`Delete “${doc.title}”?`))return;deleteCreatorDocument(doc.id);refresh();}
 if(user?.role!=='Creator')return <div className="cw-access-denied"><ShieldAlert size={25}/><b>Creator access required</b><span>This document library is available to Creator accounts only.</span></div>;
 return <div className="cw-documents-page"><div className="cw-documents-heading"><div><span className="cw-eyebrow"><FileText size={13}/> CREATOR LIBRARY</span><h1>My Documents</h1><p>Create, manage and track your brand-governed content.</p></div><button className="cw-btn primary" onClick={create}><Plus size={15}/> Create document</button></div><div className="cw-documents-toolbar"><div className="cw-issue-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your documents…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Draft</option><option>In Review</option><option>Approved</option><option>Changes Requested</option></select><span>{filtered.length} documents</span></div><div className="cw-document-grid">{filtered.map(doc=><article key={doc.id} className="cw-document-card"><div className="cw-document-icon"><FileText size={20}/></div><div className="cw-document-card-top"><Pill tone={doc.status==='In Review'?'blue':doc.status==='Changes Requested'?'critical':doc.status==='Approved'?'green':'neutral'}>{doc.status}</Pill><button onClick={()=>navigate(`/app/create/${doc.id}`)}><ChevronRight size={16}/></button></div><h3>{doc.title}</h3>{doc.status==='Changes Requested'&&<div className="cw-review-feedback"><b>Reviewer feedback</b><span>{doc.changesRequestedReason||'Open the document to review requested changes.'}</span><small>Reviewer: {doc.reviewerName||'Reviewer'} · {fmt(doc.changesRequestedAt)}</small></div>}<p>{wordCount(extractPlainText(doc.content||''))} words · Version {doc.version||1}</p><small>Updated {fmt(doc.updatedAt)}</small><div className="cw-document-card-actions"><button onClick={()=>navigate(`/app/create/${doc.id}`)}><Pencil size={13}/> Open</button><button onClick={()=>duplicate(doc)}><Copy size={13}/> Duplicate</button><button onClick={()=>remove(doc)}><Trash2 size={13}/> Delete</button></div></article>)}{!filtered.length&&<div className="cw-documents-empty"><FilePlus2 size={28}/><b>No documents found</b><span>Create a new document or change your search filter.</span></div>}</div></div>;
}
