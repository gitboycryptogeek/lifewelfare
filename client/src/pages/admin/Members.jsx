import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import { MdSearch } from 'react-icons/md';

export default function AdminMembers() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-members', search, status, page],
    queryFn: async () => {
      if (search) {
        const { data } = await api.get(`/members/search?q=${encodeURIComponent(search)}`);
        return { data: data.data, meta: { total: data.data.length, pages: 1 } };
      }
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.append('status', status);
      const { data } = await api.get(`/members?${params}`);
      return data;
    },
    keepPreviousData: true,
  });

  return (
    <Layout title="Members">
      <div className="space-y-4 max-w-7xl">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, phone, ID, or membership no."
              className="input pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input w-full sm:w-48"
          >
            <option value="">All statuses</option>
            {['pending', 'active', 'suspended', 'deceased', 'claim_pending', 'claim_settled'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="card overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data?.data?.length ? (
            <p className="text-center text-gray-500 py-10">No members found.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Membership No.', 'Phone', 'Cover', 'Agent', 'Status', 'Registered', ''].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((m) => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium">{m.full_name}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{m.membership_number || '—'}</td>
                      <td className="py-3 pr-4">{m.phone}</td>
                      <td className="py-3 pr-4">Option {m.cover_option}</td>
                      <td className="py-3 pr-4 text-gray-500">{m.agent_name || '—'}</td>
                      <td className="py-3 pr-4"><StatusBadge status={m.status} /></td>
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-500">
                        {format(new Date(m.registration_date), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/admin/members/${m.id}`}
                          className="text-brand-gold hover:underline text-xs font-semibold whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {data?.meta?.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {data.meta.pages} ({data.meta.total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-outline py-1.5 px-4 text-sm disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))}
                      disabled={page === data.meta.pages}
                      className="btn-outline py-1.5 px-4 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
