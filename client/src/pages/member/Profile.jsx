import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';

export default function MemberProfile() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['member-profile-full'],
    queryFn: async () => {
      const { data } = await api.get(`/members/search?q=${user.phone}`);
      return data.data?.[0] || null;
    },
  });

  const { data: dependents } = useQuery({
    queryKey: ['dependents', profile?.id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${profile.id}/dependents`);
      return data.data;
    },
    enabled: !!profile?.id,
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ['beneficiaries', profile?.id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${profile.id}/beneficiaries`);
      return data.data;
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <Layout title="My Profile">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title="My Profile">
        <div className="card text-center py-10 text-gray-500">
          No member record found. Contact your agent or call +254-118-043-715.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="My Profile">
      <div className="space-y-6 max-w-3xl">
        {/* Personal details */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-brand-navy">Personal Details</h3>
            <StatusBadge status={profile.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Full Name', value: profile.full_name },
              { label: 'Membership No.', value: profile.membership_number || 'Pending approval' },
              { label: 'ID / Passport', value: profile.id_passport_no },
              { label: 'KRA PIN', value: profile.kra_pin || '—' },
              { label: 'Date of Birth', value: profile.dob ? format(new Date(profile.dob), 'dd MMM yyyy') : '—' },
              { label: 'Gender', value: profile.gender || '—' },
              { label: 'Phone', value: profile.phone },
              { label: 'Email', value: profile.email || '—' },
              { label: 'Address', value: profile.physical_address || '—' },
              { label: 'Cover Option', value: profile.cover_option ? `Option ${profile.cover_option}` : '—' },
              { label: 'Registration Date', value: format(new Date(profile.registration_date), 'dd MMM yyyy') },
              { label: 'Approval Date', value: profile.approval_date ? format(new Date(profile.approval_date), 'dd MMM yyyy') : 'Pending' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-gray-500 text-xs">{label}</p>
                <p className="font-medium text-brand-navy">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dependents */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Dependents</h3>
          {!dependents?.length ? (
            <p className="text-gray-500 text-sm">No dependents on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Relationship', 'DOB', 'ID/Birth Cert'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dependents.map((dep) => (
                    <tr key={dep.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">{dep.full_name}</td>
                      <td className="py-2.5 pr-4 capitalize">{dep.relationship}</td>
                      <td className="py-2.5 pr-4">{dep.dob ? format(new Date(dep.dob), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-2.5">{dep.id_or_birth_cert_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Beneficiaries */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Beneficiaries</h3>
          {!beneficiaries?.length ? (
            <p className="text-gray-500 text-sm">No beneficiaries on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Relationship', 'Phone', 'ID/Passport'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((ben) => (
                    <tr key={ben.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">{ben.full_name}</td>
                      <td className="py-2.5 pr-4 capitalize">{ben.relationship}</td>
                      <td className="py-2.5 pr-4">{ben.phone || '—'}</td>
                      <td className="py-2.5">{ben.id_passport_no || '—'}</td>
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
