import { uploadPdf, uploadAssetFile, api } from '../data/api.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KNOWLEDGE_BASE_KEY, KNOWLEDGE_BASE_VERSION_KEY } from '../data/knowledgeBaseStore';
import { addAuditEvent } from '../data/reviewStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, FileText, BadgeCheck, Tags, Image, History, Plus, Search, Upload,
  Download, Eye, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Clock,
  AlertTriangle, ShieldCheck, FileUp, RefreshCw, Filter, CalendarDays, Palette,
  Type, Link2, MoreHorizontal, ArrowUpRight, Lock, FileCheck2, Layers,
  Activity, RotateCcw, GitCompare, CircleHelp, CheckCircle2, XCircle
} from 'lucide-react';

const KEY = KNOWLEDGE_BASE_KEY;
const VERSION_KEY = KNOWLEDGE_BASE_VERSION_KEY;
const SECTIONS = [
  ['overview', 'Overview', BookOpen],
  ['brand-bible', 'Brand Bible', FileText],
  ['facts', 'Approved Facts', BadgeCheck],
  ['terminology', 'Terminology', Tags],
  ['assets', 'Brand Assets', Image],
  ['versions', 'Version History', History]
];
const initial = {
  documents: [
    { id:'DOC-001', name:'Brand Standards 2026.pdf', version:'v2.1', uploadedBy:'Taylor Smith', uploadedAt:'2026-10-28', size:'2.4 MB', processing:'Indexed', approval:'Approved', description:'Core identity, voice, messaging and visual standards.', fileName:null },
    { id:'DOC-002', name:'Product Messaging Framework.pdf', version:'v1.4', uploadedBy:'Morgan Chen', uploadedAt:'2026-10-21', size:'1.8 MB', processing:'Indexed', approval:'Approved', description:'Approved product descriptions and positioning.', fileName:null },
    { id:'DOC-003', name:'Legal Claims Reference.pdf', version:'v1.0', uploadedBy:'Taylor Smith', uploadedAt:'2026-10-16', size:'980 KB', processing:'Indexed', approval:'Pending', description:'Claims requiring evidence and legal review.', fileName:null }
  ],
  facts: [
    {id:'FACT-001',title:'Founded year',statement:'Northstar was founded in 2018.',category:'Company',source:'Corporate profile.pdf',reference:'Page 2',from:'2026-01-01',until:'',status:'Active',updated:'2026-10-28'},
    {id:'FACT-002',title:'Platform availability',statement:'The platform is available in 14 markets.',category:'Product',source:'Product facts Q4.pdf',reference:'Page 5',from:'2026-10-01',until:'2027-03-31',status:'Active',updated:'2026-10-25'},
    {id:'FACT-003',title:'Customer outcome claim',statement:'Customers may reduce manual review time by up to 30% in qualifying workflows.',category:'Performance',source:'Approved claims register.pdf',reference:'Page 8',from:'2026-01-01',until:'2026-10-01',status:'Outdated',updated:'2026-10-20'},
    {id:'FACT-004',title:'Security certification',statement:'Security certification is currently under review.',category:'Security',source:'Compliance tracker',reference:'Row 14',from:'2026-09-01',until:'',status:'Pending verification',updated:'2026-10-18'}
  ],
  terminology: [
    {id:'TERM-001',term:'Customer',type:'Preferred',replacement:'Client',explanation:'Use the approved audience term in enterprise-facing copy.',category:'Audience',updated:'2026-10-28'},
    {id:'TERM-002',term:'Artificial Intelligence',type:'Preferred',replacement:'AI-powered technology',explanation:'Use this approved phrase in product descriptions.',category:'Product',updated:'2026-10-27'},
    {id:'TERM-003',term:'Guaranteed results',type:'Banned',replacement:'',explanation:'Avoid absolute outcome promises without substantiation and legal approval.',category:'Claims',updated:'2026-10-25'},
    {id:'TERM-004',term:'100% risk-free',type:'Banned',replacement:'',explanation:'Unqualified risk-free claims are not permitted.',category:'Claims',updated:'2026-10-25'},
    {id:'TERM-005',term:'Best in the world',type:'Banned',replacement:'',explanation:'Avoid unsupported superlative claims.',category:'Claims',updated:'2026-10-22'},
    {id:'TERM-006',term:'BG AI',type:'Alias',replacement:'BrandGuard AI',explanation:'Use the full product name on first reference.',category:'Brand',updated:'2026-10-20'},
    {id:'TERM-007',term:'Brand guidelines',type:'Alias',replacement:'Brand standards',explanation:'Preferred label for the approved governance document.',category:'Brand',updated:'2026-10-18'}
  ],
  assets: [
    {id:'AST-001',name:'Primary brand logo',category:'Logos',kind:'SVG',size:'42 KB',status:'Approved',updated:'2026-10-28',color:'#3978e8'},
    {id:'AST-002',name:'Northstar icon set',category:'Icons',kind:'SVG',size:'128 KB',status:'Approved',updated:'2026-10-24',color:'#7868dc'},
    {id:'AST-003',name:'Product campaign visual',category:'Marketing graphics',kind:'PNG',size:'1.2 MB',status:'Approved',updated:'2026-10-19',color:'#2a9d8f'},
    {id:'AST-004',name:'Team photography',category:'Brand photography',kind:'JPG',size:'3.8 MB',status:'Archived',updated:'2026-10-12',color:'#d58a55'}
  ],
  colors: [
    {id:'COL-1',name:'Primary blue',hex:'#3978E8'},
    {id:'COL-2',name:'Deep navy',hex:'#172033'},
    {id:'COL-3',name:'Violet accent',hex:'#7868DC'},
    {id:'COL-4',name:'Soft background',hex:'#F6F8FB'},
    {id:'COL-5',name:'Body text',hex:'#526078'}
  ],
  typography: {primary:'Inter',secondary:'Inter',heading:'Semibold · 600',body:'Regular · 400'},
  logoGuidelines: {clearSpace:'Maintain clear space equal to the height of the brand mark.',background:'Use the primary logo on white or approved light backgrounds. Use the reversed logo on deep navy.'},
  activity: [
    {id:'ACT-1',action:'Brand Standards 2026 indexed',user:'Taylor Smith',date:'2026-10-28',time:'10:42 AM',resource:'Brand Bible'},
    {id:'ACT-2',action:'Founded year fact updated',user:'Morgan Chen',date:'2026-10-28',time:'09:18 AM',resource:'Approved Facts'},
    {id:'ACT-3',action:'Banned term added',user:'Taylor Smith',date:'2026-10-25',time:'04:06 PM',resource:'Terminology'},
    {id:'ACT-4',action:'Primary logo approved',user:'Taylor Smith',date:'2026-10-19',time:'11:30 AM',resource:'Brand Assets'}
  ]
};
const read = (key, fallback) => { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const today = () => new Date().toISOString().slice(0,10);
const prettyDate = value => value ? new Date(value+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const makeId = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const isAdmin = role => role === 'Admin';
const canEdit = role => role === 'Admin';
const blankFact = {title:'',statement:'',category:'Company',source:'',reference:'',from:today(),until:'',status:'Active'};
const blankTerm = {term:'',type:'Preferred',replacement:'',explanation:'',category:'Brand'};
const blankAsset = {name:'',category:'Logos',status:'Approved'};
const blankColor = {name:'',hex:'#3978E8'};

function Modal({title,children,onClose,wide=false}) {
  return <div className="kb-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><motion.section className={`kb-modal ${wide?'kb-modal-wide':''}`} initial={{opacity:0,y:14,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}}><header><h3>{title}</h3><button className="kb-icon-btn" onClick={onClose} aria-label="Close"><X size={17}/></button></header>{children}</motion.section></div>;
}
function Field({label,children,required}) { return <label className="kb-field"><span>{label}{required&&<i> *</i>}</span>{children}</label>; }
function Button({children,onClick,kind='primary',disabled=false,type='button'}) { return <button type={type} disabled={disabled} onClick={onClick} className={`kb-btn kb-btn-${kind}`}>{children}</button>; }
function Status({value}) { const tone = /approved|active|indexed/i.test(value)?'good':/pending|processing|uploaded/i.test(value)?'warn':/outdated|failed|banned|archived/i.test(value)?'bad':'neutral'; return <span className={`kb-status ${tone}`}><i/>{value}</span>; }
function Empty({title,detail}) { return <div className="kb-empty"><Layers size={25}/><b>{title}</b><span>{detail}</span></div>; }

export default function KnowledgeBasePage() {
  const {section='overview'}=useParams();
  const navigate=useNavigate();
  const user=read('bg_session',null);
  const role=user?.role||'Creator';
  const admin=isAdmin(role);
  const [data,setData]=useState(()=>read(KEY,initial));
  const [versions,setVersions]=useState(()=>read(VERSION_KEY,[]));
  const [modal,setModal]=useState(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All');
  const [sort,setSort]=useState('newest');
  const [toast,setToast]=useState('');
  const [selected,setSelected]=useState([]);
  const [upload,setUpload]=useState(null);
  const [versionTarget,setVersionTarget]=useState(null);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [preview,setPreview]=useState(null);
  const [compare,setCompare]=useState(null);
  const [form,setForm]=useState({});
  const [fileUrl,setFileUrl]=useState('');
  const fileInput=useRef(null);
  const assetInput=useRef(null);

  const allowedSections = role==='Admin' ? SECTIONS.map(x=>x[0]) : role==='Reviewer' ? ['overview','brand-bible','facts','terminology','assets'] : role==='Legal' ? ['overview','brand-bible','facts'] : ['overview','brand-bible','facts','terminology'];
  const activeSection=allowedSections.includes(section)?section:'overview';
  useEffect(()=>{if(activeSection!==section)navigate('/app/knowledge/overview',{replace:true});},[activeSection,section,navigate]);
  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(data));},[data]);
  useEffect(()=>{localStorage.setItem(VERSION_KEY,JSON.stringify(versions));},[versions]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>()=>{if(fileUrl)URL.revokeObjectURL(fileUrl);},[fileUrl]);

  const update=(key,items)=>setData(old=>({...old,[key]:items}));
  const log=(action,resource)=>{setData(old=>({...old,activity:[{id:makeId('ACT'),action,user:user?.name||'Demo user',date:today(),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),resource},...old.activity].slice(0,50)}));addAuditEvent(user,action,null,{documentTitle:resource||'Brand Knowledge Base',resource});};
  const snapshot=(resource,label,oldValue,newValue)=>{let added=[],modified=[],removed=[];if(Array.isArray(oldValue)||Array.isArray(newValue)){const before=Array.isArray(oldValue)?oldValue:[],after=Array.isArray(newValue)?newValue:[];const oldMap=new Map(before.filter(x=>x?.id).map(x=>[x.id,x])),newMap=new Map(after.filter(x=>x?.id).map(x=>[x.id,x]));added=after.filter(x=>!oldMap.has(x.id));removed=before.filter(x=>!newMap.has(x.id));modified=after.filter(x=>oldMap.has(x.id)&&JSON.stringify(oldMap.get(x.id))!==JSON.stringify(x));}else if(oldValue&&newValue&&typeof oldValue==='object'&&typeof newValue==='object'){if(!oldValue.id&&newValue.id)added=[newValue];else if(oldValue.id&&!newValue.id)removed=[oldValue];else if(oldValue.id&&newValue.id)modified=Object.keys(newValue).filter(k=>JSON.stringify(oldValue[k])!==JSON.stringify(newValue[k]));}setVersions(old=>[{id:makeId('VER'),resource,label,version:`v${(old.filter(v=>v.resource===resource).length+1).toFixed(1)}`,user:user?.name||'Demo user',date:today(),description:label,previous:oldValue,current:newValue,added,modified,removed},...old]);};
  const setField=(key,value)=>setForm(old=>({...old,[key]:value}));
  const go=key=>{setSearch('');setFilter('All');navigate(`/app/knowledge/${key}`);};

  const documents=data.documents||[];
  const facts=(data.facts||[]).map(f=>f.until&&f.until<today()&&f.status==='Active'?{...f,status:'Outdated'}:f);
  const terms=data.terminology||[];
  const assets=data.assets||[];
  const recent=[...(data.activity||[])].slice(0,6);
  const stats=[
    ['Guideline documents',documents.length,FileText],
    ['Approved facts',facts.filter(f=>f.status==='Active').length,BadgeCheck],
    ['Preferred terms',terms.filter(t=>t.type==='Preferred').length,Tags],
    ['Banned terms',terms.filter(t=>t.type==='Banned').length,AlertTriangle],
    ['Approved assets',assets.filter(a=>a.status==='Approved').length,Image]
  ];
  const health=[['Guideline coverage',documents.length?92:0],['Facts verification',facts.length?Math.round(facts.filter(f=>f.status==='Active').length/facts.length*100):0],['Terminology completeness',terms.length?88:0],['Asset availability',assets.length?Math.round(assets.filter(a=>a.status==='Approved').length/assets.length*100):0]];

  function startFact(item){setForm(item?{...item}:{...blankFact});setModal({type:'fact',item:item||null});}
  function saveFact(e){e.preventDefault();if(!form.title?.trim()||!form.statement?.trim()||!form.source?.trim()){setToast('Complete the required fact fields.');return;}const old=facts.find(x=>x.id===form.id);const next={...form,id:form.id||makeId('FACT'),updated:today(),status:form.until&&form.until<today()?'Outdated':form.status};const nextFacts=old?facts.map(x=>x.id===old.id?next:x):[next,...facts];update('facts',nextFacts);snapshot('Approved Facts',`${old?'Updated':'Added'}: ${next.title}`,old||null,next);log(`${old?'Updated':'Added'} approved fact`,next.title);setModal(null);setToast('Approved fact saved.');}
  function removeFact(item){if(!confirm(`Delete “${item.title}”? This cannot be undone.`))return;update('facts',facts.filter(x=>x.id!==item.id));snapshot('Approved Facts',`Deleted: ${item.title}`,item,null);log('Deleted approved fact',item.title);setToast('Fact deleted.');}
  function startTerm(item){setForm(item?{...item}:{...blankTerm});setModal({type:'term',item:item||null});}
  function saveTerm(e){e.preventDefault();if(!form.term?.trim()){setToast('Enter a term.');return;}if(form.type==='Preferred'&&!form.replacement?.trim()){setToast('Add the preferred replacement.');return;}const old=terms.find(x=>x.id===form.id);const next={...form,id:form.id||makeId('TERM'),updated:today()};const nextTerms=old?terms.map(x=>x.id===old.id?next:x):[next,...terms];update('terminology',nextTerms);snapshot('Terminology',`${old?'Updated':'Added'}: ${next.term}`,old||null,next);log(`${old?'Updated':'Added'} terminology`,next.term);setModal(null);setToast('Terminology saved.');}
  function removeTerm(item){if(!confirm(`Delete “${item.term}”?`))return;update('terminology',terms.filter(x=>x.id!==item.id));snapshot('Terminology',`Deleted: ${item.term}`,item,null);log('Deleted terminology',item.term);setToast('Term deleted.');}
  async function saveDocument(file){
    if(!file)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setVersionTarget(null);setToast('Only PDF files are accepted for the Brand Bible.');return;}
    if(file.size>20*1024*1024){setVersionTarget(null);setToast('PDF must be 20 MB or smaller.');return;}
    setUpload({name:file.name,size:(file.size/1024/1024).toFixed(2)+' MB',file});setUploadProgress(20);
    try{
      const result=await uploadPdf(file);if(versionTarget?.ruleId)await api(`/knowledge/${versionTarget.ruleId}`,{method:'PATCH',body:{status:'Archived'}});setUploadProgress(100);
      const base={name:file.name,uploadedBy:user?.name||'Workspace user',uploadedAt:today(),size:(file.size/1024/1024).toFixed(2)+' MB',processing:'Indexed',approval:'Approved',description:`${result.pages} pages extracted and indexed (${result.characters.toLocaleString()} characters).`,fileName:file.name,fileUrl:result.fileUrl,ruleId:result.id};
      if(versionTarget){const old=versionTarget;const next={...old,...base,version:`v${((Number(String(old.version).replace(/^v/,''))||1)+0.1).toFixed(1)}`};update('documents',documents.map(d=>d.id===old.id?next:d));snapshot('Brand Bible',`New version uploaded: ${next.name}`,old,next);log('Uploaded and indexed new Brand Bible version',next.name);setVersionTarget(null);}
      else{const doc={id:makeId('DOC'),...base,version:'v1.0'};update('documents',[doc,...documents]);snapshot('Brand Bible',`Uploaded and indexed: ${file.name}`,null,doc);log('Uploaded and indexed Brand Bible PDF',file.name);}
      setToast(`PDF processed successfully. ${result.pages} pages indexed.`);
    }catch(error){setToast(error.message||'PDF upload failed.');}
    finally{setUpload(null);setUploadProgress(0);}
  }
  function startDocEdit(doc){setForm({...doc});setModal({type:'document',item:doc});}
  async function saveDoc(e){e.preventDefault();const next={...form};try{if(next.ruleId)await api(`/knowledge/${next.ruleId}`,{method:'PATCH',body:{title:next.name}});update('documents',documents.map(d=>d.id===next.id?next:d));snapshot('Brand Bible',`Renamed: ${next.name}`,modal.item,next);log('Renamed Brand Bible document',next.name);setModal(null);setToast('Document updated.');}catch(error){setToast(error.message||'Document update failed.');}}
  async function deleteDoc(doc){if(!confirm(`Delete ${doc.name}?`))return;try{if(doc.ruleId)await api(`/knowledge/${doc.ruleId}`,{method:'DELETE'});update('documents',documents.filter(d=>d.id!==doc.id));snapshot('Brand Bible',`Deleted: ${doc.name}`,doc,null);log('Deleted Brand Bible document',doc.name);setToast('Document deleted.');}catch(error){setToast(error.message||'Document deletion failed.');}}
  function previewDoc(doc){setPreview({type:'document',item:doc});}
  async function uploadAsset(file){
    if(!file)return;
    if(file.size>8*1024*1024){setToast('Asset must be 8 MB or smaller.');return;}
    try{const result=await uploadAssetFile(file);const item={id:result.id,name:result.name,category:'Other assets',kind:result.format?.toUpperCase()||'FILE',size:(result.bytes/1024).toFixed(0)+' KB',status:'Approved',updated:today(),color:'#3978e8',previewUrl:result.url,assetUrl:result.url,publicId:result.publicId};update('assets',[item,...assets]);snapshot('Brand Assets',`Uploaded: ${file.name}`,null,item);log('Uploaded brand asset',file.name);setToast('Asset uploaded and stored securely.');}catch(error){setToast(error.message||'Asset upload failed.');}
  }
  async function toggleAssetStatus(item){const next={...item,status:item.status==='Approved'?'Archived':'Approved'};try{if(item.publicId)await api(`/knowledge/${item.id}`,{method:'PATCH',body:{status:next.status==='Approved'?'Active':'Archived'}});update('assets',assets.map(a=>a.id===item.id?next:a));snapshot('Brand Assets',`Changed status: ${item.name}`,item,next);log(`Marked asset ${next.status.toLowerCase()}`,item.name);}catch(error){setToast(error.message||'Asset status update failed.');}}
  async function deleteAsset(item){if(!confirm(`Delete ${item.name}?`))return;try{if(item.publicId)await api(`/assets/${item.id}`,{method:'DELETE'});update('assets',assets.filter(a=>a.id!==item.id));snapshot('Brand Assets',`Deleted: ${item.name}`,item,null);log('Deleted brand asset',item.name);setToast('Asset deleted.');}catch(error){setToast(error.message||'Asset deletion failed.');}}
  function saveColor(e){e.preventDefault();if(!form.name?.trim()||!/^#[0-9A-Fa-f]{6}$/.test(form.hex||'')){setToast('Enter a name and valid six-digit HEX colour.');return;}const old=(data.colors||[]).find(c=>c.id===form.id);const next={...form,id:form.id||makeId('COL'),hex:form.hex.toUpperCase()};const colors=old?data.colors.map(c=>c.id===old.id?next:c):[...data.colors,next];const before=data.colors;update('colors',colors);snapshot('Brand identity',`${old?'Updated':'Added'} colour: ${next.name}`,before,colors);log(`${old?'Updated':'Added'} brand colour`,next.name);setModal(null);setToast('Brand colour saved.');}
  function deleteColor(item){if(!confirm(`Delete ${item.name}?`))return;const before=data.colors;const after=before.filter(c=>c.id!==item.id);update('colors',after);snapshot('Brand identity',`Deleted colour: ${item.name}`,before,after);log('Deleted brand colour',item.name);}
  function saveTypography(e){e.preventDefault();const before=data.typography;const next={...form};setData(old=>({...old,typography:next}));snapshot('Brand identity','Updated typography',before,next);log('Updated typography settings','Brand identity');setModal(null);setToast('Typography updated.');}
  function restoreVersion(v){if(!confirm(`Restore this saved state for ${v.resource}? Current data will be replaced.`))return;const map={'Approved Facts':'facts','Terminology':'terminology','Brand Bible':'documents','Brand Assets':'assets'};const key=map[v.resource];if(key){const current=data[key]||[];if(Array.isArray(v.previous))update(key,v.previous);else if(v.previous===null&&v.current?.id)update(key,current.filter(x=>x.id!==v.current.id));else if(v.current===null&&v.previous?.id)update(key,[v.previous,...current]);else if(v.previous?.id)update(key,current.map(x=>x.id===v.previous.id?v.previous:x));}else if(v.resource==='Brand identity'&&Array.isArray(v.previous))setData(old=>({...old,colors:v.previous}));else if(v.resource==='Brand identity'&&v.previous&&!Array.isArray(v.previous))setData(old=>({...old,typography:v.previous}));const entry={...v,id:makeId('VER'),description:`Restored ${v.version} · ${v.label}`,date:today(),user:user?.name||'Demo user'};setVersions(old=>[entry,...old]);log('Restored previous version',v.label);setToast('Restore action recorded.');}
  function viewDocFile(doc){if(doc.fileUrl){window.open(doc.fileUrl,'_blank','noopener,noreferrer');return;}setToast('The guideline text is indexed, but the original PDF is not stored. Configure Cloudinary to retain downloadable originals.');}
  const visibleFacts=(role==='Creator'||role==='Legal')?facts.filter(f=>f.status==='Active'):facts;
  const filteredFacts=visibleFacts.filter(f=>(filter==='All'||f.category===filter||f.status===filter)&&`${f.title} ${f.statement} ${f.source}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='newest'?b.updated.localeCompare(a.updated):a.title.localeCompare(b.title));
  const filteredTerms=terms.filter(t=>(filter==='All'||t.type===filter||t.category===filter)&&`${t.term} ${t.replacement} ${t.explanation}`.toLowerCase().includes(search.toLowerCase()));
  const filteredAssets=assets.filter(a=>(filter==='All'||a.category===filter||a.status===filter)&&`${a.name} ${a.category}`.toLowerCase().includes(search.toLowerCase()));
  const visibleDocs=admin||role==='Reviewer'?documents:documents.filter(d=>d.approval==='Approved');
  const filteredDocs=visibleDocs.filter(d=>(filter==='All'||d.processing===filter||d.approval===filter)&&d.name.toLowerCase().includes(search.toLowerCase()));
  const visibleVersions=versions.filter(v=>`${v.resource} ${v.label} ${v.user}`.toLowerCase().includes(search.toLowerCase()));
  const title=SECTIONS.find(x=>x[0]===activeSection)?.[1]||'Knowledge Base';
  const headerActions=admin&&<div className="kb-header-actions">{activeSection==='brand-bible'&&<Button onClick={()=>fileInput.current?.click()}><Upload size={15}/> Upload PDF</Button>}{activeSection==='facts'&&<Button onClick={()=>startFact()}><Plus size={15}/> Add fact</Button>}{activeSection==='terminology'&&<Button onClick={()=>startTerm()}><Plus size={15}/> Add term</Button>}{activeSection==='assets'&&<Button onClick={()=>assetInput.current?.click()}><Upload size={15}/> Upload asset</Button>}</div>;

  return <div className="kb-page">
    <div className="kb-heading"><div><div className="kb-eyebrow"><ShieldCheck size={13}/> BRAND GOVERNANCE</div><h1>Brand Knowledge Base</h1><p>Your organisation’s approved source of truth for guidelines, claims, terminology and brand assets.</p></div><div className="kb-heading-right"><span className="kb-readonly"><Lock size={12}/>{admin?'Admin access':'Read-only access'}</span></div></div>
    <div className="kb-layout">
      <aside className="kb-subnav"><div className="kb-subnav-label">KNOWLEDGE BASE</div>{SECTIONS.filter(x=>allowedSections.includes(x[0])).map(([key,label,Icon])=><button key={key} onClick={()=>go(key)} className={activeSection===key?'active':''}><Icon size={16}/>{label}{activeSection===key&&<ChevronRight size={14}/>}</button>)}<div className="kb-subnav-note"><ShieldCheck size={16}/><span><b>Single source of truth</b><small>Approved information is shared with future content review workflows.</small></span></div></aside>
      <section className="kb-main">
        {activeSection!=='overview'&&<div className="kb-section-title"><div><h2>{title}</h2><p>{activeSection==='brand-bible'?'Manage approved brand standards and supporting reference documents.':activeSection==='facts'?'Maintain verified statements and their supporting sources.':activeSection==='terminology'?'Define preferred language, prohibited terms and approved aliases.':activeSection==='assets'?'Organise approved visual identity files and brand specifications.':'Review and restore tracked changes across the knowledge base.'}</p></div>{headerActions}</div>}
        {activeSection==='overview'&&<Overview data={data} stats={stats} health={health} recent={recent} admin={admin} go={go} startFact={startFact} startTerm={startTerm} uploadClick={()=>fileInput.current?.click()} assetClick={()=>assetInput.current?.click()}/>}
        {activeSection==='brand-bible'&&<div className="kb-stack">
          <div className="kb-upload-card" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();saveDocument(e.dataTransfer.files[0]);}}><div className="kb-upload-icon"><FileUp size={23}/></div><div><h3>Upload a brand guideline PDF</h3><p>Drag and drop your PDF here, or browse files. Maximum file size 20 MB.</p><small>PDF only · Text extraction and AI indexing</small></div><Button kind="secondary" onClick={()=>fileInput.current?.click()}>Browse files</Button></div>
          {upload&&<div className="kb-progress"><div><FileText size={17}/><span><b>{upload.name}</b><small>{upload.size} · Uploading and indexing simulation</small></span><b>{uploadProgress}%</b></div><div className="kb-progress-track"><i style={{width:`${uploadProgress}%`}}/></div></div>}
          <div className="kb-toolbar"><div className="kb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Indexed</option><option>Processing</option><option>Failed</option><option>Approved</option><option>Pending</option></select><span className="kb-count">{filteredDocs.length} documents</span></div>
          <div className="kb-table-wrap"><table className="kb-table"><thead><tr><th>DOCUMENT</th><th>VERSION</th><th>UPLOADED BY</th><th>UPLOAD DATE</th><th>SIZE</th><th>PROCESSING</th><th>APPROVAL</th><th/></tr></thead><tbody>{filteredDocs.map(d=><tr key={d.id}><td><div className="kb-doc-cell"><span className="kb-file-icon"><FileText size={16}/></span><span><b>{d.name}</b><small>{d.id}</small></span></div></td><td>{d.version}</td><td>{d.uploadedBy}</td><td>{prettyDate(d.uploadedAt)}</td><td>{d.size}</td><td><Status value={d.processing}/></td><td><Status value={d.approval}/></td><td><div className="kb-row-actions"><button title="Preview details" onClick={()=>previewDoc(d)}><Eye size={15}/></button>{admin&&<><button title="Upload new version" onClick={()=>{setVersionTarget(d);fileInput.current?.click();}}><Upload size={15}/></button><button title="Rename" onClick={()=>startDocEdit(d)}><Pencil size={15}/></button><button title="Delete" onClick={()=>deleteDoc(d)}><Trash2 size={15}/></button></>}</div></td></tr>)}</tbody></table>{!filteredDocs.length&&<Empty title="No documents found" detail="Try changing your search or filters."/ >}</div>
          <div className="kb-note"><CircleHelp size={15}/><span>PDF text is extracted on the server and indexed as an active brand guideline for AI scans. Scanned-image PDFs require OCR before upload.</span></div>
        </div>}
        {activeSection==='facts'&&<div className="kb-stack"><div className="kb-toolbar"><div className="kb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search facts, statements or sources..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{['Company','Product','Performance','Security','Active','Pending verification','Outdated','Archived'].map(x=><option key={x}>{x}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="title">Title A–Z</option></select><span className="kb-count">{filteredFacts.length} facts</span></div>
          <div className="kb-table-wrap"><table className="kb-table"><thead><tr><th>FACT / CLAIM</th><th>APPROVED STATEMENT</th><th>CATEGORY</th><th>SOURCE</th><th>VALIDITY</th><th>STATUS</th><th>UPDATED</th><th/></tr></thead><tbody>{filteredFacts.map(f=><tr key={f.id}><td><b>{f.title}</b><small className="kb-cell-sub">{f.id}</small></td><td className="kb-statement">{f.statement}</td><td>{f.category}</td><td><button className="kb-inline-link" onClick={()=>setPreview({type:'fact',item:f})}><Link2 size={13}/>{f.source}</button><small className="kb-cell-sub">{f.reference}</small></td><td>{prettyDate(f.from)}<small className="kb-cell-sub">to {prettyDate(f.until)}</small></td><td><Status value={f.status}/></td><td>{prettyDate(f.updated)}</td><td><div className="kb-row-actions"><button title="View source details" onClick={()=>setPreview({type:'fact',item:f})}><Eye size={15}/></button>{admin&&<><button title="Edit" onClick={()=>startFact(f)}><Pencil size={15}/></button><button title="Delete" onClick={()=>removeFact(f)}><Trash2 size={15}/></button></>}</div></td></tr>)}</tbody></table>{!filteredFacts.length&&<Empty title="No facts found" detail="No approved facts match these filters."/ >}</div><div className="kb-note"><AlertTriangle size={15}/>Expired facts are automatically shown as Outdated based on their valid-until date.</div></div>}
        {activeSection==='terminology'&&<div className="kb-stack"><div className="kb-term-summary">{[['Preferred',terms.filter(t=>t.type==='Preferred').length,'Use this language'],['Banned',terms.filter(t=>t.type==='Banned').length,'Avoid these terms'],['Alias',terms.filter(t=>t.type==='Alias').length,'Map to approved terms']].map(([name,count,desc])=><div key={name} className={`kb-term-stat ${name.toLowerCase()}`}><b>{count}</b><strong>{name}</strong><small>{desc}</small></div>)}</div><div className="kb-toolbar"><div className="kb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search terminology..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{['Preferred','Banned','Alias','Audience','Product','Claims','Brand'].map(x=><option key={x}>{x}</option>)}</select><span className="kb-count">{filteredTerms.length} terms</span></div><div className="kb-table-wrap"><table className="kb-table"><thead><tr><th>TERM</th><th>TYPE</th><th>PREFERRED REPLACEMENT</th><th>EXPLANATION</th><th>CATEGORY</th><th>UPDATED</th><th/></tr></thead><tbody>{filteredTerms.map(t=><tr key={t.id}><td><b>{t.term}</b></td><td><span className={`kb-term-type ${t.type.toLowerCase()}`}>{t.type}</span></td><td>{t.replacement||'—'}</td><td className="kb-statement">{t.explanation}</td><td>{t.category}</td><td>{prettyDate(t.updated)}</td><td><div className="kb-row-actions">{admin&&<><button title="Edit" onClick={()=>startTerm(t)}><Pencil size={15}/></button><button title="Delete" onClick={()=>removeTerm(t)}><Trash2 size={15}/></button></>}</div></td></tr>)}</tbody></table>{!filteredTerms.length&&<Empty title="No terminology found" detail="Try another search or filter."/ >}</div><div className="kb-note"><CircleHelp size={15}/>These are illustrative demo rules. Part 3 can consume this shared terminology collection.</div></div>}
        {activeSection==='assets'&&<div className="kb-stack"><div className="kb-toolbar"><div className="kb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets..."/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{['Logos','Icons','Brand photography','Illustrations','Marketing graphics','Other assets','Approved','Archived'].map(x=><option key={x}>{x}</option>)}</select><span className="kb-count">{filteredAssets.length} assets</span></div><div className="kb-asset-grid">{filteredAssets.map(a=><article className="kb-asset-card" key={a.id}><div className="kb-asset-preview" style={{'--asset-color':a.color}}>{a.previewUrl&&a.kind!=='PDF'?<img src={a.previewUrl} alt={a.name}/>:<div className="kb-asset-glyph">{a.category==='Logos'?<ShieldCheck size={42}/>:a.category==='Icons'?<Layers size={42}/>:<Image size={42}/>}<small>{a.kind}</small></div>}<Status value={a.status}/></div><div className="kb-asset-info"><div><b>{a.name}</b><small>{a.category} · {a.kind} · {a.size}</small></div><div className="kb-row-actions"><button title="Details" onClick={()=>setPreview({type:'asset',item:a})}><Eye size={15}/></button>{admin&&<><button title={a.status==='Approved'?'Archive':'Approve'} onClick={()=>toggleAssetStatus(a)}><Check size={15}/></button><button title="Delete" onClick={()=>deleteAsset(a)}><Trash2 size={15}/></button></>}</div></div></article>)}</div>{!filteredAssets.length&&<Empty title="No assets found" detail="Upload an asset or adjust your filters."/ >}
          <section className="kb-settings-card"><div className="kb-settings-head"><div><h3><Palette size={17}/> Brand colour palette</h3><p>Approved colour values used across brand materials.</p></div>{admin&&<Button kind="secondary" onClick={()=>{setForm({...blankColor});setModal({type:'color'});}}><Plus size={14}/> Add colour</Button>}</div><div className="kb-colors">{(data.colors||[]).map(c=><div className="kb-color" key={c.id}><button className="kb-swatch" style={{background:c.hex}} title={c.hex} onClick={()=>{navigator.clipboard?.writeText(c.hex);setToast(`${c.hex} copied.`);}}/><span><b>{c.name}</b><small>{c.hex}</small></span>{admin&&<div className="kb-row-actions"><button title="Edit colour" onClick={()=>{setForm({...c});setModal({type:'color'});}}><Pencil size={13}/></button><button title="Delete colour" onClick={()=>deleteColor(c)}><Trash2 size={13}/></button></div>}</div>)}</div></section>
          <section className="kb-settings-card"><div className="kb-settings-head"><div><h3><Type size={17}/> Typography system</h3><p>Document the approved font family and text hierarchy.</p></div>{admin&&<Button kind="secondary" onClick={()=>{setForm({...data.typography});setModal({type:'typography'});}}><Pencil size={14}/> Edit typography</Button>}</div><div className="kb-type-preview"><div><small>PRIMARY FONT</small><b>{data.typography?.primary||'Inter'}</b></div><div><small>SECONDARY FONT</small><b>{data.typography?.secondary||'Inter'}</b></div><div><small>HEADING STYLE</small><b>{data.typography?.heading||'Semibold · 600'}</b></div><div><small>BODY STYLE</small><b>{data.typography?.body||'Regular · 400'}</b></div></div></section>
          <section className="kb-settings-card"><div className="kb-settings-head"><div><h3><ShieldCheck size={17}/> Logo usage guidelines</h3><p>Clear-space and background rules for logo application.</p></div></div><div className="kb-guidelines"><div><small>CLEAR SPACE</small><p>{data.logoGuidelines?.clearSpace}</p></div><div><small>BACKGROUND USAGE</small><p>{data.logoGuidelines?.background}</p></div></div></section>
        </div>}
        {activeSection==='versions'&&<div className="kb-stack"><div className="kb-toolbar"><div className="kb-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search version history..."/></div><span className="kb-count">{visibleVersions.length} recorded changes</span></div><div className="kb-version-list">{visibleVersions.map((v,i)=><article className="kb-version" key={v.id}><div className="kb-version-marker">{i===0?<RefreshCw size={15}/>:<History size={15}/>}</div><div className="kb-version-body"><div className="kb-version-top"><div><b>{v.label}</b><small>{v.resource} · {v.version}</small></div><span>{prettyDate(v.date)} · {v.user}</span></div><p>{v.description}</p><div className="kb-version-diff">{v.added?.length>0&&<span className="added">+ {v.added.length} added</span>}{v.modified?.length>0&&<span className="modified">~ {v.modified.length} modified</span>}{v.removed?.length>0&&<span className="removed">− {v.removed.length} removed</span>}</div><div className="kb-version-actions"><button onClick={()=>setPreview({type:'version',item:v})}><Eye size={14}/> View details</button><button onClick={()=>setCompare(v)}><GitCompare size={14}/> Compare</button>{admin&&<button onClick={()=>restoreVersion(v)}><RotateCcw size={14}/> Restore</button>}</div></div></article>)}</div>{!visibleVersions.length&&<Empty title="No version history yet" detail="Changes made in the knowledge base will appear here."/ >}</div>}
      </section>
    </div>

    <input ref={fileInput} hidden type="file" accept="application/pdf,.pdf" onChange={e=>{saveDocument(e.target.files[0]);if(!e.target.files[0])setVersionTarget(null);e.target.value='';}}/>
    <input ref={assetInput} hidden type="file" accept="image/*,.svg,.pdf" onChange={e=>{uploadAsset(e.target.files[0]);e.target.value='';}}/>
    <AnimatePresence>{modal&&<Modal title={modal.type==='fact'?(modal.item?'Edit approved fact':'Add approved fact'):modal.type==='term'?(modal.item?'Edit terminology':'Add terminology'):modal.type==='document'?'Rename document':modal.type==='color'?'Brand colour': 'Typography settings'} onClose={()=>setModal(null)}>
      {modal.type==='fact'&&<form className="kb-form" onSubmit={saveFact}><Field label="Fact title" required><input value={form.title||''} onChange={e=>setField('title',e.target.value)} required/></Field><Field label="Approved statement" required><textarea rows="3" value={form.statement||''} onChange={e=>setField('statement',e.target.value)} required/></Field><div className="kb-form-grid"><Field label="Category"><select value={form.category||'Company'} onChange={e=>setField('category',e.target.value)}>{['Company','Product','Performance','Security','Legal','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Status"><select value={form.status||'Active'} onChange={e=>setField('status',e.target.value)}>{['Active','Pending verification','Outdated','Archived'].map(x=><option key={x}>{x}</option>)}</select></Field></div><Field label="Source document or reference" required><input value={form.source||''} onChange={e=>setField('source',e.target.value)} required/></Field><Field label="Source page or URL"><input value={form.reference||''} onChange={e=>setField('reference',e.target.value)}/></Field><div className="kb-form-grid"><Field label="Valid from"><input type="date" value={form.from||''} onChange={e=>setField('from',e.target.value)}/></Field><Field label="Valid until"><input type="date" value={form.until||''} onChange={e=>setField('until',e.target.value)}/></Field></div><div className="kb-modal-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">{modal.item?'Save changes':'Add fact'}</Button></div></form>}
      {modal.type==='term'&&<form className="kb-form" onSubmit={saveTerm}><Field label="Term" required><input value={form.term||''} onChange={e=>setField('term',e.target.value)} required/></Field><div className="kb-form-grid"><Field label="Type"><select value={form.type||'Preferred'} onChange={e=>setField('type',e.target.value)}>{['Preferred','Banned','Alias'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Category"><select value={form.category||'Brand'} onChange={e=>setField('category',e.target.value)}>{['Brand','Audience','Product','Claims','Legal','Other'].map(x=><option key={x}>{x}</option>)}</select></Field></div>{form.type!=='Banned'&&<Field label="Preferred replacement" required={form.type==='Preferred'}><input value={form.replacement||''} onChange={e=>setField('replacement',e.target.value)} required={form.type==='Preferred'}/></Field>}<Field label="Explanation"><textarea rows="3" value={form.explanation||''} onChange={e=>setField('explanation',e.target.value)}/></Field><div className="kb-modal-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">{modal.item?'Save changes':'Add term'}</Button></div></form>}
      {modal.type==='document'&&<form className="kb-form" onSubmit={saveDoc}><Field label="Document name" required><input value={form.name||''} onChange={e=>setField('name',e.target.value)} required/></Field><Field label="Description"><textarea rows="3" value={form.description||''} onChange={e=>setField('description',e.target.value)}/></Field><div className="kb-modal-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Save changes</Button></div></form>}
      {modal.type==='color'&&<form className="kb-form" onSubmit={saveColor}><Field label="Colour name" required><input value={form.name||''} onChange={e=>setField('name',e.target.value)} required/></Field><Field label="HEX value" required><div className="kb-color-input"><input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(form.hex||'')?form.hex:'#3978E8'} onChange={e=>setField('hex',e.target.value)}/><input value={form.hex||''} onChange={e=>setField('hex',e.target.value)} pattern="^#[0-9A-Fa-f]{6}$" required/></div></Field><div className="kb-modal-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Save colour</Button></div></form>}
      {modal.type==='typography'&&<form className="kb-form" onSubmit={saveTypography}>{[['primary','Primary font'],['secondary','Secondary font'],['heading','Heading style'],['body','Body style']].map(([key,label])=><Field key={key} label={label}><input value={form[key]||''} onChange={e=>setField(key,e.target.value)} required/></Field>)}<div className="kb-modal-actions"><Button kind="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Save settings</Button></div></form>}
    </Modal>}</AnimatePresence>
    <AnimatePresence>{preview&&<Modal title={preview.type==='document'?'Document details':preview.type==='fact'?'Approved fact source':preview.type==='asset'?'Asset details':'Version details'} onClose={()=>setPreview(null)}><div className="kb-detail">{Object.entries(preview.item).filter(([k,v])=>!['previewUrl','fileName'].includes(k)&&typeof v!=='object').map(([k,v])=><div key={k}><small>{k.replace(/([A-Z])/g,' $1')}</small><b>{String(v||'—')}</b></div>)}</div>{preview.type==='document'&&<p className="kb-note"><AlertTriangle size={14}/>Original file bytes are not persisted. This entry stores metadata only.</p>}</Modal>}</AnimatePresence>
    <AnimatePresence>{compare&&<Modal title="Version comparison" onClose={()=>setCompare(null)} wide><div className="kb-compare"><div><small>SELECTED VERSION · {compare.version}</small><h4>{compare.label}</h4><pre>{JSON.stringify(compare.previous,null,2)||'No previous value'}</pre></div><div><small>RECORDED CURRENT VALUE</small><h4>{compare.resource}</h4><pre>{JSON.stringify(compare.current,null,2)||'No current value'}</pre></div></div><div className="kb-compare-summary"><b>Change summary</b><span>{compare.added?.length||0} added</span><span>{compare.modified?.length||0} modified</span><span>{compare.removed?.length||0} removed</span></div></Modal>}</AnimatePresence>
    {toast&&<motion.div className="kb-toast" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><CheckCircle2 size={16}/>{toast}</motion.div>}
  </div>;
}

function Overview({data,stats,health,recent,admin,go,startFact,startTerm,uploadClick,assetClick}) {
 return <div className="kb-stack">
  <div className="kb-overview-banner"><div><span>KNOWLEDGE BASE HEALTH</span><h2>One trusted foundation for every brand decision.</h2><p>Approved facts, language and visual assets are ready to guide content governance.</p></div><div className="kb-health-ring" style={{'--health':`${Math.round(health.reduce((a,x)=>a+x[1],0)/health.length)}%`}}><div><b>{Math.round(health.reduce((a,x)=>a+x[1],0)/health.length)}%</b><small>Overall health</small></div></div></div>
  <div className="kb-stats">{stats.map(([label,value,Icon])=><article key={label}><span className="kb-stat-icon"><Icon size={17}/></span><div><b>{value}</b><small>{label}</small></div><ArrowUpRight size={14}/></article>)}</div>
  <div className="kb-overview-grid"><section className="kb-panel"><div className="kb-panel-head"><div><h3>Knowledge base completeness</h3><p>Coverage across the core governance resources.</p></div><span className="kb-live"><i/> DEMO DATA</span></div><div className="kb-health-list">{health.map(([label,value])=><div key={label}><div><b>{label}</b><span>{value}%</span></div><div className="kb-health-track"><i style={{width:`${value}%`}}/></div></div>)}</div></section>
   <section className="kb-panel"><div className="kb-panel-head"><div><h3>Quick actions</h3><p>Keep approved brand knowledge up to date.</p></div></div>{admin&&<div className="kb-quick-actions"><button onClick={uploadClick}><span><Upload size={17}/></span><b>Upload Brand Bible</b><small>Add an approved PDF guideline</small><ChevronRight size={15}/></button><button onClick={startFact}><span><BadgeCheck size={17}/></span><b>Add approved fact</b><small>Record a verified statement</small><ChevronRight size={15}/></button><button onClick={startTerm}><span><Tags size={17}/></span><b>Add terminology</b><small>Define a preferred or banned term</small><ChevronRight size={15}/></button><button onClick={assetClick}><span><Image size={17}/></span><b>Upload brand asset</b><small>Add a logo or approved visual</small><ChevronRight size={15}/></button></div>}{!admin&&<small className="kb-permission-note">Your role has read-only access. Ask an administrator to make changes.</small>}</section></div>
  <section className="kb-panel"><div className="kb-panel-head"><div><h3>Recent knowledge activity</h3><p>Latest updates across your brand source of truth.</p></div>{admin&&<button className="kb-inline-link" onClick={()=>go('versions')}>View version history <ArrowUpRight size={14}/></button>}</div><div className="kb-activity">{recent.map((a,i)=><div key={a.id}><span className="kb-activity-icon">{i===0?<FileCheck2 size={15}/>:i===1?<BadgeCheck size={15}/>:i===2?<Tags size={15}/>:<Activity size={15}/>}</span><div><b>{a.action}</b><small>{a.user} · {a.resource}</small></div><time>{prettyDate(a.date)}<small>{a.time}</small></time></div>)}</div></section>
  <div className="kb-overview-foot"><ShieldCheck size={16}/> Shared knowledge base · Local demo persistence · No external AI or indexing service connected</div>
 </div>;
}
