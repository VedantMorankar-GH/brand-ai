import assert from 'node:assert/strict';
import {
  getUsers, addUser, updateUser, getSettings, saveSettings, getNotifications,
  markNotificationRead, markAllNotificationsRead, getGlobalSearchResults, getGovernanceData
} from '../src/data/governanceStore.js';
import { createCreatorDocument, saveCreatorDocument, saveScanResult, submitCreatorDocument } from '../src/data/creatorStore.js';
import { addAuditEvent } from '../src/data/reviewStore.js';
import fs from 'node:fs';

const memory=new Map();
globalThis.localStorage={getItem(k){return memory.has(k)?memory.get(k):null},setItem(k,v){memory.set(k,String(v))},removeItem(k){memory.delete(k)}};
const users=getUsers();
assert.equal(users.length,4);
assert.deepEqual(users.map(x=>x.role).sort(),['Admin','Creator','Legal','Reviewer']);
const created=addUser({name:'Test Analyst',email:'analyst@brandguard.ai',password:'test123',role:'Reviewer',department:'Marketing'});
assert.equal(getUsers().length,5);
assert.throws(()=>addUser({name:'Duplicate',email:'analyst@brandguard.ai',password:'x',role:'Creator'}),/already exists/);
updateUser(created.id,{department:'Research'});
assert.equal(getUsers().find(x=>x.id===created.id).department,'Research');
updateUser(created.id,{status:'Inactive'});assert.equal(getUsers().find(x=>x.id===created.id).status,'Inactive');
updateUser(created.id,{status:'Active'});assert.equal(getUsers().find(x=>x.id===created.id).status,'Active');
assert.throws(()=>updateUser('USR-3',{status:'Inactive'}),/last active Admin/);
assert.throws(()=>updateUser('USR-3',{role:'Creator'}),/last active Admin/);
assert.throws(()=>updateUser(created.id,{email:'reviewer@brandguard.ai'}),/already exists/);
const settings=getSettings();settings.appearance.theme='dark';saveSettings(settings);assert.equal(getSettings().appearance.theme,'dark');
const creator={name:'Alex Morgan',email:'creator@brandguard.ai',role:'Creator'};
const doc=saveCreatorDocument(createCreatorDocument(creator,'Governance analytics fixture','A claim with no supporting source.'));
const issue={id:'ISS-P5-1',severity:'Critical',status:'Open',title:'Unsupported promotional claim',category:'Unsupported claims',snippet:'no supporting source',source:'No approved source found'};
const scan={score:72,issues:[issue]};saveScanResult(doc.id,scan,creator);
const submission=submitCreatorDocument(doc,creator,scan);
const data=getGovernanceData();assert.ok(data.docs.some(x=>x.id===doc.id));assert.ok(data.issues.some(x=>x.id===issue.id));
const notifications=getNotifications();assert.ok(notifications.some(n=>n.title==='Critical issue detected'));assert.ok(notifications.some(n=>n.title==='Review requested'));
markNotificationRead(notifications[0].id);assert.ok(getNotifications().some(n=>n.id===notifications[0].id&&n.read));
markAllNotificationsRead();assert.equal(getNotifications().filter(n=>!n.read).length,0);
assert.ok(getGlobalSearchResults('Governance analytics fixture').some(x=>x.type==='Document'));
assert.ok(getGlobalSearchResults('analyst@brandguard.ai').some(x=>x.type==='User'));
addAuditEvent(creator,'Brand guidelines updated',null,{documentTitle:'Brand Bible'});
assert.ok(getNotifications().some(n=>n.title==='Brand guidelines updated'));
const app=fs.readFileSync('src/App.jsx','utf8');
const layout=fs.readFileSync('src/components/layout/AppLayout.jsx','utf8');
const pages=fs.readFileSync('src/pages/Part5Pages.jsx','utf8');
for(const route of ['analytics','users','notifications','settings','creator-status']) assert.ok(app.includes(`path=\"${route}\"`),`Missing route ${route}`);
assert.ok(app.includes('RequireRole')&&app.includes("roles={['Admin']}")&&app.includes('AnalyticsPage'),'Missing Admin route guard');
assert.ok(pages.includes("user?.role==='Admin'?'/app/audit'")&&pages.includes("user?.role==='Admin')path='/app/documents'"),'Missing role-aware notification/search destinations');
for(const label of ['Analytics','Users','Notifications','Settings']) assert.ok(layout.includes(label),`Missing navigation item ${label}`);
for(const component of ['AnalyticsPage','UserManagementPage','NotificationCenterPage','SettingsPage','GlobalSearchPanel','CreatorStatusPage']) assert.ok(pages.includes(`export function ${component}`),`Missing Part 5 component ${component}`);
console.log('PASS: Part 5 user directory CRUD, role and last-Admin guard, settings persistence, shared analytics records, global search, event-derived notifications, read state and audit-linked guideline updates.');
