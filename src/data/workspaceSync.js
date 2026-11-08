import { api, getToken } from './api.js';

const KEYS = [
  'bg_creator_documents_v1','bg_creator_scans_v1','bg_creator_submissions_v1',
  'bg_review_comments_v1','bg_review_decisions_v1','bg_legal_decisions_v1',
  'bg_critical_overrides_v1','bg_audit_events_v1','bg_knowledge_base_v1',
  'bg_knowledge_versions_v1','bg_notification_reads_v1','bg_settings_v1'
];
let installed = false;
let timer;
let applyingRemote = false;
let lastError = null;
let workspaceVersion = 0;

function snapshot(){
  const data={};
  for(const key of KEYS){const value=localStorage.getItem(key);if(value!==null)data[key]=JSON.parse(value);}
  return data;
}
async function push(){
  if(!getToken()||applyingRemote)return;
  try{const saved=await api('/workspace',{method:'PUT',body:{data:snapshot(),version:workspaceVersion}});workspaceVersion=saved.version??workspaceVersion+1;lastError=null;window.dispatchEvent(new CustomEvent('bg_sync_status',{detail:{status:'saved'}}));}
  catch(error){lastError=error;window.dispatchEvent(new CustomEvent('bg_sync_status',{detail:{status:'error',message:error.message}}));}
}
function schedulePush(){if(applyingRemote||!getToken())return;clearTimeout(timer);timer=setTimeout(push,350);}
export async function initializeWorkspaceSync(){
  if(!getToken())return;
  try{
    const user=JSON.parse(localStorage.getItem('bg_user')||'{}');
    const organization=String(user.organization||'BrandGuard').toLowerCase();
    if(localStorage.getItem('bg_workspace_org')!==organization){for(const key of KEYS)localStorage.removeItem(key);localStorage.setItem('bg_workspace_org',organization);}
    const remote=await api('/workspace');
    workspaceVersion=remote.version??0;
    applyingRemote=true;
    for(const [key,value] of Object.entries(remote.data||{}))if(KEYS.includes(key))localStorage.setItem(key,JSON.stringify(value));
    applyingRemote=false;
    if(!installed){
      const original=localStorage.setItem.bind(localStorage);
      localStorage.setItem=(key,value)=>{original(key,value);if(KEYS.includes(key))schedulePush();};
      installed=true;
    }
    // A first-time organization seeds the shared workspace from this account's current data.
    if(!remote.updatedAt)await push();
    window.dispatchEvent(new CustomEvent('bg_workspace_ready'));
  }catch(error){applyingRemote=false;console.error('Workspace synchronization failed:',error);window.dispatchEvent(new CustomEvent('bg_sync_status',{detail:{status:'error',message:error.message}}));}
}
export function getWorkspaceSyncError(){return lastError;}
