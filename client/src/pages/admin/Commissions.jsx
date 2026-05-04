import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdAttachMoney, MdCheckCircle, MdHourglassEmpty, MdClose } from 'react-icons/md';

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

export default function AdminCommissions() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [disburseAgent, setDisburseAgent] = useState(null);
  const [disburseNotes, setDisburseNotes] = useState('');

  const { data: summaryData } = useQuery({
    queryKey: ['commissions-summary'],
    queryFn: async () => {
      const { data } = await api.get('/commissions/summary');
      return data.data;
    },
  });

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['commissions-agents', page],
    queryFn: async () => {
      const { data } = await api.get(`/commissions?page=${page}&limit=20`);
      return data;
    },
  });

  const { data: agentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['commissions-agent-detail', selectedAgent?.agent_id],
    queryFn: async () => {
      const { data } = await api.get(`/commissions/agent/${selectedAgent.agent_id}`);
      return data.data;
    },
    enabled: !!selectedAgent,
  });

  const disburseMutation = useMutation({
    mutationFn: async ({ agent_id, notes }) => {
      const { data } = await api.patch('/commissions/disburse', { agent_id, notes });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['commissions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['commissions-agents'] });
      setDisburseAgent(null);
      setDisburseNotes('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Disbursement failed');
    },
  });

  const summary = summaryData || {};
  const agents = agentsData?.data || [];
  const meta = agentsData?.meta || {};

  const summaryCards = [
    { label: 'Total Earned by All Agents', value: fmt(summary.total_earned), icon: MdAttachMoney, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Total Disbursed', value: fmt(summary.total_disbursed), icon: MdCheckCircle, bg: 'bg-green-50', color: 'text-green-600' },
    { label: 'Pending Disbursement', value: fmt(summary.pending_disbursement), icon: MdHourglassEmpty, bg: 'bg-yellow-50', color: 'text-yellow-600' },
  ];

  return (
    <Layout title="Agent Commissions">
      <div className="space-y-6 max-w-6xl">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={`card flex items-center gap-4 ${card.bg}`}>
              <div className={`p-3 rounded-full bg-white ${card.color}`}>
                <card.icon size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-lg font-bold text-brand-navy mt-0.5">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Per-agent table */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Agent Earnings</h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No commission records found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Agent', 'Phone', 'Members', 'Total Earned', 'Pending', 'Disbursed', 'Last Payout', 'Actions'].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.agent_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium">{a.agent_name}</td>
                        <td className="py-3 pr-4 text-gray-500">{a.agent_phone}</td>
                        <td className="py-3 pr-4 text-center">{a.total_commissions}</td>
                        <td className="py-3 pr-4 font-semibold">{fmt(a.total_earned)}</td>
                        <td className="py-3 pr-4">
                          <span className={`font-semibold ${Number(a.pending_amount) > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {fmt(a.pending_amount)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-green-700">{fmt(a.disbursed_amount)}</td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {a.last_disbursement ? format(new Date(a.last_disbursement), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAgent(a)}
                              className="text-xs px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDisburseAgent(a); setDisburseNotes(''); }}
                              disabled={Number(a.pending_amount) === 0}
                              className="text-xs px-3 py-1 rounded-lg bg-brand-gold text-white font-medium hover:bg-yellow-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Disburse
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-outline text-sm py-1.5 px-4 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">Page {page} of {meta.pages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                    disabled={page === meta.pages}
                    className="btn-outline text-sm py-1.5 px-4 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-heading font-bold text-brand-navy">{selectedAgent.agent_name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Commission detail</p>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-gray-600">
                <MdClose size={22} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Total Earned</p>
                    <p className="font-bold text-brand-navy">{fmt(agentDetail?.summary?.total_earned)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Disbursed</p>
                    <p className="font-bold text-green-700">{fmt(agentDetail?.summary?.disbursed)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="font-bold text-yellow-600">{fmt(agentDetail?.summary?.pending)}</p>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 px-6 pb-6">
                  <table className="w-full text-sm mt-4">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Member', 'Membership No.', 'Cover', 'Amount', 'Status', 'Date'].map((h) => (
                          <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(agentDetail?.commissions || []).map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium">{c.member_name}</td>
                          <td className="py-2 pr-3 text-gray-500">{c.membership_number || '—'}</td>
                          <td className="py-2 pr-3">Option {c.cover_option}</td>
                          <td className="py-2 pr-3 font-semibold">
                            {Number(c.commission_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              c.status === 'disbursed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {c.status === 'disbursed' ? 'Disbursed' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500 whitespace-nowrap">
                            {format(new Date(c.created_at), 'dd MMM yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Disburse Confirmation Modal */}
      {disburseAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-heading font-bold text-brand-navy">Disburse Commissions</h3>
              <button onClick={() => setDisburseAgent(null)} className="text-gray-400 hover:text-gray-600">
                <MdClose size={22} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700">
                Mark all pending commissions as disbursed for{' '}
                <span className="font-semibold">{disburseAgent.agent_name}</span>?
              </p>
              <div className="bg-yellow-50 rounded-lg px-4 py-3 text-sm">
                <span className="text-gray-500">Pending amount: </span>
                <span className="font-bold text-yellow-700">{fmt(disburseAgent.pending_amount)}</span>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="e.g. End of month payout — May 2026"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setDisburseAgent(null)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => disburseMutation.mutate({ agent_id: disburseAgent.agent_id, notes: disburseNotes })}
                disabled={disburseMutation.isPending}
                className="btn-primary"
              >
                {disburseMutation.isPending ? 'Processing…' : 'Confirm Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
