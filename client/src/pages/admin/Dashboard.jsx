import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['admin-summary'],
    queryFn: async () => {
      const { data } = await api.get('/reports/summary');
      return data.data;
    },
  });

  const { data: growth } = useQuery({
    queryKey: ['growth-trends'],
    queryFn: async () => {
      const { data } = await api.get('/reports/growth?months=12');
      return data.data;
    },
  });

  const { data: agentLeaderboard } = useQuery({
    queryKey: ['agent-leaderboard-admin'],
    queryFn: async () => {
      const { data } = await api.get('/reports/agents');
      return data.data?.slice(0, 5);
    },
  });

  if (isLoading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const m = summary?.members;
  const c = summary?.claims;

  const statCards = [
    { label: 'Total Members', value: m?.total || 0, color: 'bg-blue-50 text-blue-700' },
    { label: 'Active', value: m?.active || 0, color: 'bg-green-50 text-green-700' },
    { label: 'Pending', value: m?.pending || 0, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Deceased', value: m?.deceased || 0, color: 'bg-gray-50 text-gray-700' },
    { label: 'Active Agents', value: summary?.agents?.total || 0, color: 'bg-purple-50 text-purple-700' },
    { label: 'Open Claims', value: c?.pending || 0, color: 'bg-orange-50 text-orange-700' },
    { label: 'Claims Paid', value: c?.paid || 0, color: 'bg-teal-50 text-teal-700' },
    {
      label: 'Total Paid (KES)',
      value: parseFloat(c?.total_paid_amount || 0).toLocaleString('en-KE'),
      color: 'bg-rose-50 text-rose-700',
    },
  ];

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6 max-w-7xl">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className={`card text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Growth chart */}
          <div className="card">
            <h3 className="font-heading font-bold text-brand-navy mb-4">Membership Growth (12 months)</h3>
            {growth?.membership_growth?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growth.membership_growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="new_members" stroke="#F5A623" strokeWidth={2} dot={false} name="New Members" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Agent leaderboard */}
          <div className="card">
            <h3 className="font-heading font-bold text-brand-navy mb-4">Top Agents</h3>
            {!agentLeaderboard?.length ? (
              <p className="text-gray-500 text-sm">No agent data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-500 font-medium pb-2">Agent</th>
                    <th className="text-right text-gray-500 font-medium pb-2">Total</th>
                    <th className="text-right text-gray-500 font-medium pb-2">Approved</th>
                    <th className="text-right text-gray-500 font-medium pb-2">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {agentLeaderboard.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium">{a.agent_name}</td>
                      <td className="py-2 text-right">{a.total_recruits}</td>
                      <td className="py-2 text-right text-green-600">{a.approved}</td>
                      <td className="py-2 text-right text-yellow-600">{a.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent registrations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-brand-navy">Recent Registrations</h3>
            <Link to="/admin/members" className="text-brand-gold text-sm hover:underline">View all</Link>
          </div>
          {!summary?.recent_registrations?.length ? (
            <p className="text-gray-500 text-sm">No recent registrations.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-500 font-medium pb-2 pr-4">Name</th>
                    <th className="text-left text-gray-500 font-medium pb-2 pr-4">Membership No.</th>
                    <th className="text-left text-gray-500 font-medium pb-2 pr-4">Agent</th>
                    <th className="text-left text-gray-500 font-medium pb-2 pr-4">Status</th>
                    <th className="text-left text-gray-500 font-medium pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_registrations.map((m) => (
                    <tr key={m.full_name + m.registration_date} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{m.full_name}</td>
                      <td className="py-2.5 pr-4">{m.membership_number || '—'}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{m.agent_name || '—'}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={m.status} /></td>
                      <td className="py-2.5 text-gray-500 whitespace-nowrap">
                        {format(new Date(m.registration_date), 'dd MMM yyyy')}
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
