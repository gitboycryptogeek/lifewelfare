import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdPersonSearch, MdCheckCircle } from 'react-icons/md';

function StatusPill({ status }) {
  return status === 'approved' ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <MdCheckCircle size={12} /> Approved
    </span>
  ) : (
    <span className="inline-block text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      Prospect
    </span>
  );
}

export default function AdminProspects() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-prospects', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/prospects?${params}`);
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`/prospects/${id}/approve`),
    onSuccess: () => {
      toast.success('Prospect approved');
      qc.invalidateQueries(['admin-prospects']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to approve'),
  });

  const prospects = data?.data || [];
  const meta = data?.meta;

  return (
    <Layout title="Prospects">
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Leads captured by agents. Approve a prospect to signal readiness for full member registration.
          </p>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input w-40 text-sm"
          >
            <option value="">All statuses</option>
            <option value="prospect">Prospect</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-10">
              <MdPersonSearch size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No prospects found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Name', 'Phone', 'Email', 'Agent', 'Status', 'Date', ''].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium">{p.full_name}</td>
                        <td className="py-2.5 pr-4">{p.phone}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{p.email || '—'}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{p.agent_name || '—'}</td>
                        <td className="py-2.5 pr-4"><StatusPill status={p.status} /></td>
                        <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">
                          {format(new Date(p.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="py-2.5">
                          {p.status === 'prospect' && (
                            <button
                              onClick={() => approveMutation.mutate(p.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs font-semibold text-brand-navy hover:text-brand-gold transition-colors disabled:opacity-40"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && meta.pages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Page {page} of {meta.pages} ({meta.total} total)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                      disabled={page === meta.pages}
                      className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
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
