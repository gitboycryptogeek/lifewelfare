import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import { MdSearch } from 'react-icons/md';

export default function TeamLeaderMembers() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: membersData, isLoading } = useQuery({
    queryKey: ['tl-members', search],
    queryFn: async () => {
      const { data } = await api.get(`/members/search?q=${encodeURIComponent(search)}`);
      return data.data;
    },
  });

  const filtered = (membersData || []).filter((m) =>
    statusFilter ? m.status === statusFilter : true
  );

  return (
    <Layout title="My Registered Members">
      <div className="space-y-4 max-w-5xl">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MdSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or ID…"
                className="input pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input sm:w-44"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deceased">Deceased</option>
              <option value="claim_pending">Claim Pending</option>
              <option value="claim_settled">Claim Settled</option>
            </select>
          </div>
        </div>

        {/* Members table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-brand-navy">Members You Registered</h3>
            {filtered.length > 0 && (
              <span className="text-sm text-gray-500">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {search || statusFilter ? 'No members match your filters.' : 'You have not registered any members yet.'}
            </p>
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
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{m.full_name}</td>
                      <td className="py-2.5 pr-4">{m.phone}</td>
                      <td className="py-2.5 pr-4">{m.id_passport_no}</td>
                      <td className="py-2.5 pr-4">Option {m.cover_option}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={m.status} /></td>
                      <td className="py-2.5 text-gray-500 whitespace-nowrap">
                        {format(new Date(m.registration_date || m.created_at), 'dd MMM yyyy')}
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
