import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';
import { MdGroups, MdPeople, MdCheckCircle, MdHourglassEmpty } from 'react-icons/md';

export default function TeamLeaderDashboard() {
  const { user } = useAuth();

  const { data: dashStats } = useQuery({
    queryKey: ['tl-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/team-leader/dashboard');
      return data.data;
    },
  });

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['tl-agents'],
    queryFn: async () => {
      const { data } = await api.get('/team-leader/agents');
      return data.data;
    },
  });

  const stats = [
    { label: 'Total Agents', value: dashStats?.total_agents || 0, icon: MdGroups, color: 'text-indigo-600' },
    { label: 'Total Recruits', value: dashStats?.total_recruits || 0, icon: MdPeople, color: 'text-blue-600' },
    { label: 'Approved', value: dashStats?.approved || 0, icon: MdCheckCircle, color: 'text-green-600' },
    { label: 'Pending', value: dashStats?.pending || 0, icon: MdHourglassEmpty, color: 'text-yellow-600' },
  ];

  return (
    <Layout title="Team Leader Dashboard">
      <div className="space-y-6 max-w-5xl">
        {/* Welcome banner */}
        <div className="bg-brand-navy text-white rounded-xl p-6">
          <h2 className="font-heading text-xl font-bold">Welcome, {user.full_name.split(' ')[0]}</h2>
          <p className="text-gray-400 text-sm mt-1">Monitor your team's recruitment performance.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card text-center">
              <stat.icon size={24} className={`${stat.color} mx-auto mb-2`} />
              <div className="text-2xl font-bold text-brand-navy">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Agents table */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Your Agents</h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !agentsData?.length ? (
            <p className="text-gray-500 text-sm text-center py-6">No agents assigned to your team yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['#', 'Agent Name', 'Phone', 'Total Recruits', 'Approved', 'Pending', 'Last Registration'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentsData.map((agent, i) => (
                    <tr key={agent.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium">{agent.agent_name}</td>
                      <td className="py-2.5 pr-4">{agent.phone}</td>
                      <td className="py-2.5 pr-4 text-center font-semibold text-brand-navy">{agent.total_recruits}</td>
                      <td className="py-2.5 pr-4 text-center text-green-600 font-medium">{agent.approved}</td>
                      <td className="py-2.5 pr-4 text-center text-yellow-600 font-medium">{agent.pending}</td>
                      <td className="py-2.5 text-gray-500 whitespace-nowrap">
                        {agent.last_registration
                          ? format(new Date(agent.last_registration), 'dd MMM yyyy')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
