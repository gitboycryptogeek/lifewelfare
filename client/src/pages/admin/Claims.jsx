import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminClaims() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-claims', status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.append('status', status);
      const { data } = await api.get(`/claims?${params}`);
      return data;
    },
    keepPreviousData: true,
  });

  const reviewMutation = useMutation({
    mutationFn: () => api.patch(`/claims/${reviewModal.id}/status`, {
      status: reviewStatus,
      review_notes: reviewNotes,
    }),
    onSuccess: () => {
      toast.success(`Claim ${reviewStatus} successfully`);
      qc.invalidateQueries(['admin-claims']);
      setReviewModal(null);
      setReviewStatus('');
      setReviewNotes('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Action failed'),
  });

  return (
    <Layout title="Claims Management">
      <div className="max-w-7xl space-y-4">
        {/* Filter */}
        <div className="flex gap-3">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input w-48"
          >
            <option value="">All statuses</option>
            {['pending', 'approved', 'rejected', 'paid'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="card overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data?.data?.length ? (
            <p className="text-center text-gray-500 py-10">No claims found.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Member', 'Membership No.', 'Type', 'Amount (KES)', 'Status', 'Submitted', ''].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((claim) => (
                    <tr key={claim.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium">{claim.member_name}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{claim.membership_number}</td>
                      <td className="py-3 pr-4">{claim.claim_type}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {parseFloat(claim.claim_amount).toLocaleString('en-KE')}
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={claim.status} /></td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {format(new Date(claim.submitted_at), 'dd MMM yyyy')}
                      </td>
                      <td className="py-3">
                        {claim.status === 'pending' && (
                          <button
                            onClick={() => { setReviewModal(claim); setReviewStatus(''); setReviewNotes(''); }}
                            className="text-brand-gold hover:underline text-xs font-semibold"
                          >
                            Review
                          </button>
                        )}
                        {claim.status === 'approved' && (
                          <button
                            onClick={() => { setReviewModal(claim); setReviewStatus('paid'); setReviewNotes(''); }}
                            className="text-green-600 hover:underline text-xs font-semibold"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data?.meta?.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Page {page} of {data.meta.pages}</p>
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

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-heading font-bold text-brand-navy text-lg mb-1">Review Claim</h3>
            <p className="text-gray-500 text-sm mb-4">
              {reviewModal.member_name} — KES {parseFloat(reviewModal.claim_amount).toLocaleString('en-KE')} — {reviewModal.claim_type}
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Action</label>
                <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="input">
                  <option value="">Select action</option>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="paid">Mark as Paid</option>
                </select>
              </div>
              <div>
                <label className="label">Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReviewModal(null)} className="btn-outline flex-1">Cancel</button>
                <button
                  onClick={() => reviewMutation.mutate()}
                  disabled={!reviewStatus || reviewMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {reviewMutation.isPending ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
