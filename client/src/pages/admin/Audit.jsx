import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';

export default function AdminAudit() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: async () => {
      const { data } = await api.get(`/admin/audit-logs?page=${page}&limit=50`);
      return data;
    },
    keepPreviousData: true,
  });

  return (
    <Layout title="Audit Trail">
      <div className="max-w-7xl space-y-4">
        <div className="card overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data?.data?.length ? (
            <p className="text-center text-gray-500 py-10">No audit logs found.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Timestamp', 'User', 'Role', 'Action', 'Entity', 'IP Address'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap text-xs">
                        {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{log.user_name || 'System'}</td>
                      <td className="py-2.5 pr-4">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded capitalize">
                          {log.user_role?.replace('_', ' ') || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-brand-navy">{log.action}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">
                        {log.entity_type || '—'}{log.entity_id ? ` / ${log.entity_id.slice(0, 8)}` : ''}
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs">{log.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data?.meta?.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {data.meta.pages} ({data.meta.total} entries)
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline py-1.5 px-4 text-sm disabled:opacity-40">Prev</button>
                    <button onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))} disabled={page === data.meta.pages} className="btn-outline py-1.5 px-4 text-sm disabled:opacity-40">Next</button>
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
