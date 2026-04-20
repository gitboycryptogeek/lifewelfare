import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import { MdDownload, MdBadge, MdCalendarToday, MdPeople } from 'react-icons/md';
import toast from 'react-hot-toast';

export default function MemberDashboard() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['member-profile'],
    queryFn: async () => {
      // Get member record for this user
      const { data } = await api.get(`/members/search?q=${user.phone}`);
      return data.data?.[0] || null;
    },
  });

  const { data: claimsData } = useQuery({
    queryKey: ['member-claims', profile?.id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${profile.id}/claims`);
      return data.data;
    },
    enabled: !!profile?.id,
  });

  async function handleDownloadCard() {
    if (!profile?.id) return;
    try {
      const response = await api.get(`/members/${profile.id}/card`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `membership-card-${profile.membership_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Card not available yet. Contact support.');
    }
  }

  if (isLoading) {
    return (
      <Layout title="My Dashboard">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Dashboard">
      <div className="space-y-6 max-w-4xl">
        {/* Welcome card */}
        <div className="bg-brand-navy text-white rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-sm">Welcome back,</p>
              <h2 className="font-heading text-2xl font-bold">{user.full_name}</h2>
              {profile?.membership_number && (
                <div className="flex items-center gap-2 mt-2">
                  <MdBadge size={16} className="text-brand-gold" />
                  <span className="text-brand-gold font-semibold text-lg">{profile.membership_number}</span>
                </div>
              )}
            </div>
            {profile?.status === 'active' && (
              <button onClick={handleDownloadCard} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
                <MdDownload size={18} /> Download Card
              </button>
            )}
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Status', value: <StatusBadge status={profile?.status || 'pending'} /> },
            { label: 'Cover Option', value: profile?.cover_option ? `Option ${profile.cover_option}` : '—', icon: MdBadge },
            { label: 'Member Since', value: profile?.registration_date ? format(new Date(profile.registration_date), 'MMM yyyy') : '—', icon: MdCalendarToday },
            { label: 'Claims This Year', value: claimsData?.length || 0, icon: MdPeople },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <div className="font-bold text-brand-navy text-lg">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Recent claims */}
        {claimsData && claimsData.length > 0 && (
          <div className="card">
            <h3 className="font-heading font-bold text-brand-navy mb-4">Recent Claims</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-500 font-medium pb-2">Type</th>
                    <th className="text-left text-gray-500 font-medium pb-2">Amount</th>
                    <th className="text-left text-gray-500 font-medium pb-2">Status</th>
                    <th className="text-left text-gray-500 font-medium pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {claimsData.slice(0, 5).map((claim) => (
                    <tr key={claim.id} className="border-b border-gray-50">
                      <td className="py-2.5">{claim.claim_type}</td>
                      <td className="py-2.5">KES {parseFloat(claim.claim_amount).toLocaleString('en-KE')}</td>
                      <td className="py-2.5"><StatusBadge status={claim.status} /></td>
                      <td className="py-2.5 text-gray-500">{format(new Date(claim.created_at), 'dd MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!profile && (
          <div className="card text-center py-10 text-gray-500">
            <p>No member record found. Contact your agent or call +254-118-043-715.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
