import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import api from '../../services/api';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { MdPersonAdd, MdPeople, MdCheckCircle, MdHourglassEmpty, MdTrendingUp, MdLock, MdPersonSearch } from 'react-icons/md';

export default function AgentDashboard() {
  const { user } = useAuth();
  const [showChangePw, setShowChangePw] = useState(false);

  const { data: leaderboard } = useQuery({
    queryKey: ['agent-leaderboard'],
    queryFn: async () => {
      const { data } = await api.get('/reports/agents');
      return data.data;
    },
  });

  const { data: prospectsData } = useQuery({
    queryKey: ['agent-prospects'],
    queryFn: async () => {
      const { data } = await api.get('/prospects/my');
      return data.data;
    },
  });

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['agent-members'],
    queryFn: async () => {
      const { data } = await api.get('/members/search?q=');
      return data.data;
    },
  });

  const myStats = leaderboard?.find((a) => a.id === user.id);

  const stats = [
    { label: 'Total Recruits', value: myStats?.total_recruits || 0, icon: MdPeople, color: 'text-blue-600' },
    { label: 'Approved', value: myStats?.approved || 0, icon: MdCheckCircle, color: 'text-green-600' },
    { label: 'Pending', value: myStats?.pending || 0, icon: MdHourglassEmpty, color: 'text-yellow-600' },
    {
      label: 'Approval Rate',
      value: myStats?.total_recruits > 0
        ? `${Math.round((myStats.approved / myStats.total_recruits) * 100)}%`
        : '0%',
      icon: MdTrendingUp,
      color: 'text-purple-600',
    },
    { label: 'Prospects', value: prospectsData?.length || 0, icon: MdPersonSearch, color: 'text-indigo-600' },
  ];

  return (
    <Layout title="Agent Dashboard">
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      <div className="space-y-6 max-w-5xl">
        {/* Quick action */}
        <div className="bg-brand-navy text-white rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Welcome, {user.full_name.split(' ')[0]}</h2>
            <p className="text-gray-400 text-sm mt-1">Register new members and track your recruitment performance.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChangePw(true)}
              className="btn-outline flex items-center gap-2 whitespace-nowrap text-sm py-2 px-4"
            >
              <MdLock size={16} /> Change Password
            </button>
            <Link to="/agent/register" className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <MdPersonAdd size={18} /> Register Member
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card text-center">
              <stat.icon size={24} className={`${stat.color} mx-auto mb-2`} />
              <div className="text-2xl font-bold text-brand-navy">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Members list */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Your Registered Members</h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !membersData?.length ? (
            <p className="text-gray-500 text-sm text-center py-6">No members registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Phone', 'ID/Passport', 'Cover', 'Status', 'Registered'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {membersData.map((m) => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{m.full_name}</td>
                      <td className="py-2.5 pr-4">{m.phone}</td>
                      <td className="py-2.5 pr-4">{m.id_passport_no}</td>
                      <td className="py-2.5 pr-4">Option {m.cover_option}</td>
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
