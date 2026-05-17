import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Verify from './pages/Verify';

import MemberDashboard from './pages/member/Dashboard';
import MemberProfile from './pages/member/Profile';
import MemberClaims from './pages/member/Claims';

import AgentDashboard from './pages/agent/Dashboard';
import AgentRegister from './pages/agent/Register';

import AdminDashboard from './pages/admin/Dashboard';
import AdminMembers from './pages/admin/Members';
import AdminMemberDetail from './pages/admin/MemberDetail';
import AdminEditMember from './pages/admin/EditMember';
import AdminClaims from './pages/admin/Claims';
import AdminCommunicate from './pages/admin/Communicate';
import AdminReports from './pages/admin/Reports';
import AdminUsers from './pages/admin/Users';
import AdminAudit from './pages/admin/Audit';
import AdminTeamLeaders from './pages/admin/TeamLeaders';
import AdminProspects from './pages/admin/Prospects';
import TeamLeaderDashboard from './pages/team-leader/Dashboard';
import TeamLeaderAgentDetail from './pages/team-leader/AgentDetail';
import TeamLeaderRegister from './pages/team-leader/Register';
import TeamLeaderMembers from './pages/team-leader/Members';
import AgentEarnings from './pages/agent/Earnings';
import AgentInvoice from './pages/agent/Invoice';
import AdminCommissions from './pages/admin/Commissions';
import AdminInvoices from './pages/admin/Invoices';
import TeamLeaderInvoice from './pages/team-leader/Invoice';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify/:membershipNumber" element={<Verify />} />

        {/* Member */}
        <Route path="/member/dashboard" element={
          <ProtectedRoute roles={['member']}><MemberDashboard /></ProtectedRoute>
        } />
        <Route path="/member/profile" element={
          <ProtectedRoute roles={['member']}><MemberProfile /></ProtectedRoute>
        } />
        <Route path="/member/claims" element={
          <ProtectedRoute roles={['member']}><MemberClaims /></ProtectedRoute>
        } />

        {/* Agent */}
        <Route path="/agent/dashboard" element={
          <ProtectedRoute roles={['agent']}><AgentDashboard /></ProtectedRoute>
        } />
        <Route path="/agent/register" element={
          <ProtectedRoute roles={['agent']}><AgentRegister /></ProtectedRoute>
        } />
        <Route path="/agent/earnings" element={
          <ProtectedRoute roles={['agent']}><AgentEarnings /></ProtectedRoute>
        } />
        <Route path="/agent/invoice" element={
          <ProtectedRoute roles={['agent']}><AgentInvoice /></ProtectedRoute>
        } />

        {/* Team Leader */}
        <Route path="/team-leader/dashboard" element={
          <ProtectedRoute roles={['team_leader']}><TeamLeaderDashboard /></ProtectedRoute>
        } />
        <Route path="/team-leader/agents/:agentId" element={
          <ProtectedRoute roles={['team_leader']}><TeamLeaderAgentDetail /></ProtectedRoute>
        } />
        <Route path="/team-leader/register" element={
          <ProtectedRoute roles={['team_leader']}><TeamLeaderRegister /></ProtectedRoute>
        } />
        <Route path="/team-leader/members" element={
          <ProtectedRoute roles={['team_leader']}><TeamLeaderMembers /></ProtectedRoute>
        } />
        <Route path="/team-leader/invoice" element={
          <ProtectedRoute roles={['team_leader']}><TeamLeaderInvoice /></ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/admin/members" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminMembers /></ProtectedRoute>
        } />
        <Route path="/admin/members/:id" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminMemberDetail /></ProtectedRoute>
        } />
        <Route path="/admin/members/:id/edit" element={
          <ProtectedRoute roles={['super_admin']}><AdminEditMember /></ProtectedRoute>
        } />
        <Route path="/admin/prospects" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminProspects /></ProtectedRoute>
        } />
        <Route path="/admin/claims" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminClaims /></ProtectedRoute>
        } />
        <Route path="/admin/communicate" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminCommunicate /></ProtectedRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminReports /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['super_admin']}><AdminUsers /></ProtectedRoute>
        } />
        <Route path="/admin/audit" element={
          <ProtectedRoute roles={['super_admin']}><AdminAudit /></ProtectedRoute>
        } />
        <Route path="/admin/team-leaders" element={
          <ProtectedRoute roles={['super_admin']}><AdminTeamLeaders /></ProtectedRoute>
        } />
        <Route path="/admin/commissions" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminCommissions /></ProtectedRoute>
        } />
        <Route path="/admin/invoices" element={
          <ProtectedRoute roles={['admin', 'super_admin']}><AdminInvoices /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
