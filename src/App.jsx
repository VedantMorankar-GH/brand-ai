import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './components/landing/LandingPage';
import AppLayout from './components/layout/AppLayout';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/AuthPages';
import { DashboardHome, DocumentsPage } from './pages/DashboardPages';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import CreatorWorkspacePage, { CreatorDocumentsPage } from './pages/CreatorWorkspacePage';
import { ReviewQueuePage, DocumentReviewPage, DocumentReviewIndexPage, ApprovedDocumentsPage, ChangesRequestedPage, RevisionHistoryPage, AuditTrailPage, LegalWorkspacePage } from './pages/ReviewerWorkspacePage';
import { AnalyticsPage, UserManagementPage, NotificationCenterPage, SettingsPage, CreatorStatusPage } from './pages/Part5Pages';
import './styles/variables.css';
import './styles/global.css';

function Protected(){const {user}=useAuth();return user?<AppLayout/>:<Navigate to="/login" replace/>;}
function Guest({children}){const {user}=useAuth();return user?<Navigate to="/app" replace/>:children;}
function RequireRole({roles,children}){const {user}=useAuth();return roles.includes(user?.role)?children:<Navigate to="/app" replace/>;}
export default function App(){return <BrowserRouter><AuthProvider><Routes>
 <Route path="/" element={<LandingPage/>}/><Route path="/login" element={<Guest><LoginPage/></Guest>}/><Route path="/register" element={<Guest><RegisterPage/></Guest>}/><Route path="/forgot-password" element={<Guest><ForgotPasswordPage/></Guest>}/>
 <Route path="/app" element={<Protected/>}>
  <Route index element={<DashboardHome/>}/><Route path="documents" element={<RequireRole roles={['Admin','Reviewer','Legal']}><DocumentsPage/></RequireRole>}/>
  <Route path="my-documents" element={<RequireRole roles={['Creator']}><CreatorDocumentsPage/></RequireRole>}/><Route path="creator-status" element={<RequireRole roles={['Creator']}><CreatorStatusPage/></RequireRole>}/><Route path="create/:documentId?" element={<RequireRole roles={['Creator']}><CreatorWorkspacePage/></RequireRole>}/>
  <Route path="knowledge/:section?" element={<KnowledgeBasePage/>}/><Route path="queue" element={<RequireRole roles={['Reviewer']}><ReviewQueuePage/></RequireRole>}/><Route path="review" element={<RequireRole roles={['Reviewer','Legal']}><DocumentReviewIndexPage/></RequireRole>}/><Route path="review/:submissionId" element={<RequireRole roles={['Reviewer','Legal']}><DocumentReviewPage/></RequireRole>}/>
  <Route path="approved" element={<RequireRole roles={['Reviewer']}><ApprovedDocumentsPage/></RequireRole>}/><Route path="changes-requested" element={<RequireRole roles={['Reviewer']}><ChangesRequestedPage/></RequireRole>}/><Route path="revisions" element={<RequireRole roles={['Reviewer']}><RevisionHistoryPage/></RequireRole>}/><Route path="audit" element={<RequireRole roles={['Reviewer','Legal','Admin']}><AuditTrailPage/></RequireRole>}/>
  <Route path="legal-reviews" element={<RequireRole roles={['Legal']}><LegalWorkspacePage/></RequireRole>}/><Route path="claims" element={<RequireRole roles={['Legal']}><LegalWorkspacePage/></RequireRole>}/>
  <Route path="analytics" element={<RequireRole roles={['Admin']}><AnalyticsPage/></RequireRole>}/><Route path="users" element={<RequireRole roles={['Admin']}><UserManagementPage/></RequireRole>}/><Route path="notifications" element={<NotificationCenterPage/>}/><Route path="settings" element={<SettingsPage/>}/>
  <Route path="*" element={<Navigate to="/app" replace/>}/>
 </Route><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></AuthProvider></BrowserRouter>;}
