import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MdGroups, MdPersonRemove, MdPersonAdd, MdExpandMore, MdExpandLess } from 'react-icons/md';

export default function AdminTeamLeaders() {
  const qc = useQueryClient();
  const [expandedLeader, setExpandedLeader] = useState(null);
  const [assigningTo, setAssigningTo] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');

  const { data: leadersData, isLoading: loadingLeaders } = useQuery({
    queryKey: ['team-leaders'],
    queryFn: async () => {
      const { data } = await api.get('/admin/team-leaders?limit=100');
      return data.data;
    },
  });

  const { data: agentsData } = useQuery({
    queryKey: ['admin-users-agents'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users?role=agent&limit=200');
      return data.data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ agentId, teamLeaderId }) =>
      api.patch(`/admin/agents/${agentId}/assign-team-leader`, { teamLeaderId }),
    onSuccess: () => {
      toast.success('Agent assigned successfully');
      qc.invalidateQueries(['team-leaders']);
      qc.invalidateQueries(['admin-users-agents']);
      setAssigningTo(null);
      setSelectedAgent('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to assign agent'),
  });

  const unassignMutation = useMutation({
    mutationFn: (agentId) => api.delete(`/admin/agents/${agentId}/team-leader`),
    onSuccess: () => {
      toast.success('Agent unassigned');
      qc.invalidateQueries(['team-leaders']);
      qc.invalidateQueries(['admin-users-agents']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to unassign agent'),
  });

  function getLeaderAgents(leaderId) {
    return agentsData?.filter((a) => a.team_leader_id === leaderId) || [];
  }

  function getUnassignedAgents() {
    return agentsData?.filter((a) => !a.team_leader_id) || [];
  }

  function getTransferableAgents(excludeLeaderId) {
    return agentsData?.filter((a) => a.team_leader_id !== excludeLeaderId) || [];
  }

  return (
    <Layout title="Team Leaders">
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Manage team leaders and their agents. Each team leader can oversee up to 10 agents.
          </p>
        </div>

        <div className="card">
          {loadingLeaders ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !leadersData?.length ? (
            <div className="text-center py-10">
              <MdGroups size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No team leaders yet. Create one via the Users page.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {leadersData.map((leader) => {
                const isExpanded = expandedLeader === leader.id;
                const leaderAgents = getLeaderAgents(leader.id);
                const agentCount = parseInt(leader.agent_count);
                const atCapacity = agentCount >= 10;

                return (
                  <div key={leader.id} className="border-b border-gray-100 last:border-0">
                    {/* Leader row */}
                    <div className="flex items-center gap-4 py-3 px-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-brand-navy truncate">{leader.full_name}</p>
                        <p className="text-xs text-gray-500">{leader.phone}</p>
                      </div>
                      <div className="text-sm">
                        <span className={`font-semibold ${atCapacity ? 'text-red-500' : 'text-brand-navy'}`}>
                          {agentCount}
                        </span>
                        <span className="text-gray-400"> / 10 agents</span>
                      </div>
                      <span className={`text-xs font-medium ${leader.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {leader.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => setExpandedLeader(isExpanded ? null : leader.id)}
                        className="flex items-center gap-1 text-sm text-brand-navy hover:text-brand-gold transition-colors"
                      >
                        Manage {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
                      </button>
                    </div>

                    {/* Expanded agent management */}
                    {isExpanded && (
                      <div className="bg-gray-50 rounded-lg mx-1 mb-3 p-4 space-y-3">
                        {/* Agents sub-table */}
                        {leaderAgents.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-2">No agents assigned yet.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left text-gray-500 font-medium pb-2 pr-4">Agent</th>
                                <th className="text-left text-gray-500 font-medium pb-2 pr-4">Phone</th>
                                <th className="text-left text-gray-500 font-medium pb-2 pr-4">Status</th>
                                <th className="pb-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {leaderAgents.map((agent) => (
                                <tr key={agent.id} className="border-b border-gray-100 last:border-0">
                                  <td className="py-2 pr-4 font-medium">{agent.full_name}</td>
                                  <td className="py-2 pr-4 text-gray-500">{agent.phone}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`text-xs font-medium ${agent.is_active ? 'text-green-600' : 'text-red-500'}`}>
                                      {agent.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    <button
                                      onClick={() => {
                                        if (confirm(`Remove ${agent.full_name} from this team?`)) {
                                          unassignMutation.mutate(agent.id);
                                        }
                                      }}
                                      className="flex items-center gap-1 text-red-500 hover:underline text-xs"
                                    >
                                      <MdPersonRemove size={14} /> Unassign
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {/* Assign agent section */}
                        {assigningTo === leader.id ? (
                          <div className="flex gap-2 items-end pt-1">
                            <div className="flex-1">
                              <label className="label text-xs">Select agent to assign</label>
                              <select
                                value={selectedAgent}
                                onChange={(e) => setSelectedAgent(e.target.value)}
                                className="input text-sm"
                              >
                                <option value="">— choose agent —</option>
                                {getTransferableAgents(leader.id).map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.full_name} ({a.phone}){a.team_leader_id ? ' — transfer' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => {
                                if (!selectedAgent) return toast.error('Please select an agent');
                                assignMutation.mutate({ agentId: selectedAgent, teamLeaderId: leader.id });
                              }}
                              disabled={assignMutation.isPending}
                              className="btn-primary text-sm py-2"
                            >
                              {assignMutation.isPending ? 'Assigning…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => { setAssigningTo(null); setSelectedAgent(''); }}
                              className="btn-outline text-sm py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningTo(leader.id)}
                            disabled={atCapacity}
                            title={atCapacity ? 'Maximum 10 agents reached' : 'Assign an agent to this team leader'}
                            className="flex items-center gap-1 text-sm text-brand-navy hover:text-brand-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <MdPersonAdd size={16} />
                            {atCapacity ? 'Team full (10/10)' : 'Assign Agent'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          To create a new team leader, go to <a href="/admin/users" className="underline hover:text-brand-navy">Users</a> and create a user with the Team Leader role.
        </p>
      </div>
    </Layout>
  );
}
