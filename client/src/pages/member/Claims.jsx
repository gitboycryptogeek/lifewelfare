import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';

export default function MemberClaims() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['member-profile-claims'],
    queryFn: async () => {
      const { data } = await api.get(`/members/search?q=${user.phone}`);
      return data.data?.[0] || null;
    },
  });

  const { data: claims, isLoading } = useQuery({
    queryKey: ['my-claims', profile?.id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${profile.id}/claims`);
      return data.data;
    },
    enabled: !!profile?.id,
  });

  return (
    <Layout title="My Claims">
      <div className="max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {claims?.length || 0} of 6 claims used this year
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !claims?.length ? (
          <div className="card text-center py-10 text-gray-500">
            You have no claims on record.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Ref', 'Type', 'Amount (KES)', 'Status', 'Submitted', 'Notes'].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                      {claim.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 pr-4">{claim.claim_type}</td>
                    <td className="py-3 pr-4 font-semibold">
                      {parseFloat(claim.claim_amount).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={claim.status} /></td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                      {format(new Date(claim.submitted_at), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 text-gray-500 text-xs max-w-xs">
                      {claim.review_notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card bg-blue-50 border border-blue-100">
          <p className="text-sm text-blue-700">
            To submit a new claim, contact your agent or call{' '}
            <a href="tel:+254118043715" className="font-semibold">+254-118-043-715</a>.
          </p>
        </div>
      </div>
    </Layout>
  );
}
