import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, BookOpen, ChevronDown, FileCheck2, FileText, Gavel, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Users, X, BarChart3, ClipboardList, History } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { readSubmissions } from '../../data/reviewStore';
import { getNotifications,getSettings } from '../../data/governanceStore';
import Brand from '../common/Brand';
import { GlobalSearchPanel } from '../../pages/Part5Pages';

const nav={
 Creator:[['Overview','/app','LayoutDashboard'],['Brand Knowledge Base','/app/knowledge/overview','BookOpen'],['My Documents','/app/my-documents','FileText'],['Create Document','/app/create','FileCheck2'],['Review Status','/app/creator-status','ClipboardList']],
 Reviewer:[['Overview','/app','LayoutDashboard'],['Brand Knowledge Base','/app/knowledge/overview','BookOpen'],['Review Queue','/app/queue','ClipboardList'],['Document Review','/app/review','FileCheck2'],['Approved Documents','/app/approved','FileCheck2'],['Changes Requested','/app/changes-requested','FileText'],['Revision History','/app/revisions','History'],['Audit Trail','/app/audit','Activity']],
 Admin:[['Overview','/app','LayoutDashboard'],['Brand Knowledge Base','/app/knowledge','BookOpen'],['Documents','/app/documents','FileText'],['Users','/app/users','Users'],['Analytics','/app/analytics','BarChart3'],['Audit Trail','/app/audit','Activity']],
 Legal:[['Overview','/app','LayoutDashboard'],['Brand Knowledge Base','/app/knowledge/overview','BookOpen'],['Legal Reviews','/app/legal-reviews','Gavel'],['Claims Requiring Attention','/app/claims','ShieldCheck'],['Audit Trail','/app/audit','Activity']]
};
const icons={LayoutDashboard,FileText,FileCheck2,ClipboardList,Activity,BookOpen,Users,BarChart3,Gavel,ShieldCheck,History};
export default function AppLayout(){
 const {user,logout}=useAuth();const [mobile,setMobile]=useState(false),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const navTo=useNavigate(),loc=useLocation();const pendingReviewCount=readSubmissions().filter(item=>['In Review','Submitted'].includes(item.status)).length;
 const [unread,setUnread]=useState(()=>getNotifications().filter(n=>!n.read).length);const settings=getSettings();
 useEffect(()=>{const refresh=()=>setUnread(getNotifications().filter(n=>!n.read).length);window.addEventListener('bg_audit_updated',refresh);refresh();return()=>window.removeEventListener('bg_audit_updated',refresh);},[loc.pathname]);
 const current=(nav[user?.role]||nav.Creator).find(x=>x[1]===loc.pathname || (x[1]==='/app/knowledge/overview'&&loc.pathname.startsWith('/app/knowledge')) || (x[1]==='/app/review'&&loc.pathname.startsWith('/app/review/')))?.[0]||'Workspace';
 return <div className={`app-shell ${settings.appearance.theme==='dark'?'p5-dark':''} ${settings.appearance.compact?'p5-compact':''}`}>
  <aside className={`sidebar ${mobile?'sidebar-open':''}`}><div className="sidebar-brand"><Brand/><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
   <div className="workspace-switch"><div className="workspace-avatar">N</div><div><b>{settings.organization.name||'Northstar Studio'}</b><small>Free demo workspace</small></div><ChevronDown size={15}/></div>
   <div className="side-label">WORKSPACE</div><nav className="side-nav">{(nav[user?.role]||nav.Creator).map(([label,path,ic])=>{const Icon=icons[ic];return <NavLink end to={path} key={path} onClick={()=>setMobile(false)}><Icon size={17}/>{label}{label==='Review Queue'&&pendingReviewCount>0&&<span className="nav-count">{pendingReviewCount}</span>}</NavLink>})}</nav>
   <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><ShieldCheck size={17}/></div><b>Brand protection</b><p>Your workspace is connected to BrandGuard services.</p><span>LIVE WORKSPACE</span></div><NavLink to="/app/settings"><Settings size={17}/> Settings</NavLink><NavLink to="/app/notifications"><Bell size={17}/> Notifications {unread>0&&<span className="nav-count">{unread}</span>}</NavLink><button onClick={()=>{logout();navTo('/login')}}><LogOut size={17}/> Sign out</button></div>
  </aside>
  <div className="app-main"><header className="topbar"><button className="mobile-menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="breadcrumbs"><span>Workspace</span><b>/</b>{current}</div><div className="topbar-right"><div className="top-search" onClick={()=>setSearchOpen(true)}><Search size={16}/><input placeholder="Search workspace..." value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true)}}/><kbd>⌘ K</kbd></div><button className="icon-button" title="Notifications" onClick={()=>navTo('/app/notifications')}><Bell size={18}/>{unread>0&&<i/>}</button><div className="profile-chip"><div className="profile-avatar">{user?.initials||'BG'}</div><div><b>{user?.name||'Demo user'}</b><small>{user?.role}</small></div><ChevronDown size={14}/></div></div></header>
   <main className="dashboard-content"><Outlet context={{query}}/></main><footer className="app-footer"><span>BrandGuard AI · Demo workspace</span><span>Frontend simulation · Data stored locally</span></footer>
  </div>{mobile&&<button className="sidebar-scrim" onClick={()=>setMobile(false)} aria-label="Close navigation"/>}{searchOpen&&<GlobalSearchPanel query={query} onClose={()=>{setSearchOpen(false);setQuery('')}}/>}
 </div>;
}
