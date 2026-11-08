import { demoUsers } from './mockData.js';
import { readCreatorDocuments, readCreatorSubmissions } from './creatorStore.js';
import { readAuditEvents, readComments, readOverrides, addAuditEvent } from './reviewStore.js';

export const USERS_KEY='bg_users_v1';
export const SETTINGS_KEY='bg_settings_v1';
export const NOTIFICATION_READ_KEY='bg_notification_reads_v1';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const stamp=()=>new Date().toISOString();
const uid=(prefix)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
export function getUsers(){
 const saved=read(USERS_KEY,null);
 if(saved)return saved;
 const seed=demoUsers.map((u,i)=>({id:`USR-${i+1}`,name:u.name,email:u.email,role:u.role,department:['Marketing','Content','Operations','Legal'][i],status:'Active',joinedAt:new Date(Date.now()-(i+2)*86400000*30).toISOString(),lastActivity:i===0?stamp():null,initials:u.initials,password:u.password}));
 write(USERS_KEY,seed); return seed;
}
export function saveUsers(users){write(USERS_KEY,users);}
export function addUser(data,actor=null){const users=getUsers();if(users.some(u=>u.email.toLowerCase()===data.email.toLowerCase()))throw new Error('An account with this email already exists.');const user={...data,id:uid('USR'),status:'Active',joinedAt:stamp(),lastActivity:null,initials:data.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()};saveUsers([user,...users]);return user;}
export function updateUser(id,patch,actor=null){
 const users=getUsers();const target=users.find(u=>u.id===id);if(!target)throw new Error('User not found.');
 const nextUser={...target,...patch};
 if(users.some(u=>u.id!==id&&u.email.toLowerCase()===String(nextUser.email||'').toLowerCase()))throw new Error('An account with this email already exists.');
 const activeAdmins=users.filter(u=>u.role==='Admin'&&u.status==='Active').length;
 if(target.role==='Admin'&&target.status==='Active'&&(nextUser.role!=='Admin'||nextUser.status!=='Active')&&activeAdmins<=1)throw new Error('The last active Admin cannot be demoted or deactivated.');
 const next=users.map(u=>u.id===id?nextUser:u);saveUsers(next);
 if(Object.keys(patch).some(key=>key!=='lastActivity'))addAuditEvent(actor||{name:'System',role:'System'},'User account updated',null,{userName:target.name,userEmail:target.email,changes:patch});
 return nextUser;
}
export function getSettings(){return read(SETTINGS_KEY,{organization:{name:'Northstar Studio',description:'A collaborative workspace for trusted, consistent brand communication.',website:'',logoName:''},appearance:{theme:'light',compact:false},notifications:{documents:true,reviews:true,approvals:true,legal:true}});}
export function saveSettings(value){write(SETTINGS_KEY,value);}
export function getNotifications(){
 const events=readAuditEvents();const readIds=new Set(read(NOTIFICATION_READ_KEY,[]));
 const rules=[
  [/Legal decision:/i,'Legal decision recorded','legal'],[/Legal review requested/i,'Legal review requested','legal'],[/overridden/i,'Critical issue overridden','legal'],[/Critical issue detected/i,'Critical issue detected','legal'],[/Document submitted|Document resubmitted/i,'Review requested','reviews'],[/changes requested/i,'Changes requested','reviews'],[/Document approved/i,'Document approved','approvals'],[/published/i,'Document published','approvals'],[/guideline|brand bible|terminology|approved fact|brand asset/i,'Brand guidelines updated','documents'],[/comment/i,'Review comment added','reviews']
 ];
 return events.map(e=>{const match=(e.action==='Document scanned'&&(e.details?.criticalIssueCount||0)>0)?rules.find(([re])=>re.test('Critical issue detected')):rules.find(([re])=>re.test(e.action||''));if(!match)return null;return{id:e.id,title:match[1],message:`${e.userName||'A workspace user'} ${String(e.action||'updated a record').toLowerCase()}${e.documentTitle&&e.documentTitle!=='Unknown document'?` · ${e.documentTitle}`:''}.`,type:match[2],at:e.at,read:readIds.has(e.id),path:e.role==='Creator'&&e.documentId?`/app/create/${e.documentId}`:e.role==='Legal'?'/app/legal-reviews':e.submissionId?`/app/review/${e.submissionId}`:/guideline|brand bible|terminology|approved fact|brand asset/i.test(e.action||'')?'/app/knowledge/overview':'/app/audit',documentId:e.documentId,submissionId:e.submissionId};}).filter(n=>n&&getSettings().notifications[n.type]!==false);
}
export function markNotificationRead(id){const ids=read(NOTIFICATION_READ_KEY,[]);if(!ids.includes(id))write(NOTIFICATION_READ_KEY,[id,...ids]);if(typeof window!=='undefined')window.dispatchEvent(new Event('bg_audit_updated'));}
export function markAllNotificationsRead(){write(NOTIFICATION_READ_KEY,getNotifications().map(n=>n.id));if(typeof window!=='undefined')window.dispatchEvent(new Event('bg_audit_updated'));}
export function getGlobalSearchResults(query){
 const q=query.trim().toLowerCase();if(!q)return [];
 const results=[];const add=(type,label,detail,path,documentId=null)=>{if(`${label} ${detail}`.toLowerCase().includes(q))results.push({type,label,detail,path,documentId});};
 readCreatorDocuments().forEach(d=>add('Document',d.title||'Untitled document',`${d.id} · ${d.status}`,`/app/create/${d.id}`));
 readCreatorSubmissions().forEach(s=>add('Submission',s.documentTitle||'Untitled submission',`${s.id} · ${s.status}`,`/app/review/${s.id}`,s.documentId));
 const kb=read('bg_knowledge_base_v1',{});
 (kb.documents||[]).forEach(x=>add('Brand Bible',x.name||'Brand document',x.description||x.version||'Brand guideline','/app/knowledge/brand-bible'));
 (kb.facts||[]).forEach(x=>add('Approved fact',x.title||x.statement||'Fact',x.statement||x.source||'','/app/knowledge/facts'));
 (kb.terminology||[]).forEach(x=>add('Terminology',x.term||'Term',`${x.type||''} ${x.replacement||''}`,'/app/knowledge/terminology'));
 (kb.assets||[]).forEach(x=>add('Brand asset',x.name||'Asset',x.category||'','/app/knowledge/assets'));
 getUsers().forEach(x=>add('User',x.name,x.email, '/app/users'));
 readComments().forEach(x=>add('Review comment',x.body||'Comment',`${x.authorName||''} ${x.anchorText||''}`,x.submissionId?`/app/review/${x.submissionId}`:'/app/audit',x.documentId));
 return results.slice(0,30);
}
export function getGovernanceData(){
 const docs=readCreatorDocuments(), submissions=readCreatorSubmissions(), comments=readComments(), overrides=readOverrides(), events=readAuditEvents(), users=getUsers();
 const issueMap=new Map();
 [...submissions.flatMap(s=>(s.issues||[]).map(i=>({...i,documentId:s.documentId,documentTitle:s.documentTitle,creatorName:s.creatorName,creatorId:s.creatorId,createdAt:i.createdAt||s.submittedAt,department:s.department||users.find(u=>u.email===s.creatorId)?.department||'Unassigned',docType:s.documentType||'Content'}))),...docs.flatMap(d=>(d.scanResults?.issues||[]).map(i=>({...i,documentId:d.id,documentTitle:d.title,creatorName:d.creatorName,creatorId:d.creatorId,createdAt:i.createdAt||d.scanResults?.scannedAt||d.updatedAt,department:d.department||users.find(u=>u.email===d.creatorId)?.department||'Unassigned',docType:d.type||'Content'})))].forEach(i=>{const key=`${i.documentId}:${i.id||i.title}`;issueMap.set(key,i);});
 return {docs,submissions,issues:[...issueMap.values()],comments,overrides,events,users};
}
