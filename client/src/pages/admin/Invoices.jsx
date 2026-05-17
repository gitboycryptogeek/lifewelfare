import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  MdReceiptLong, MdDownload, MdCheckCircle, MdHistory, MdAdd,
  MdGroupAdd, MdDelete, MdClose, MdError,
} from 'react-icons/md';

const COVER_PLANS = [
  { option: 1, name: 'Option 1 — KES 1,500/yr', premium: 1500, cover: 'KES 50,000' },
  { option: 2, name: 'Option 2 — KES 3,000/yr', premium: 3000, cover: 'KES 100,000' },
  { option: 3, name: 'Option 3 — KES 6,000/yr', premium: 6000, cover: 'KES 200,000' },
  { option: 4, name: 'Option 4 — KES 9,000/yr', premium: 9000, cover: 'KES 300,000' },
  { option: 5, name: 'Option 5 — KES 12,000/yr', premium: 12000, cover: 'KES 400,000' },
  { option: 6, name: 'Option 6 — KES 15,000/yr', premium: 15000, cover: 'KES 500,000' },
];

function fmtKES(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

function emptyRow() {
  return { _id: Math.random(), client_name: '', cover_option: '3', membership_fee: '200', notes: '' };
}

async function downloadPdf(id, invoiceNumber) {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/v1/invoices/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to download PDF');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminInvoices() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('generate');
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [pdfLoading, setPdfLoading] = useState(null);

  // Single generate
  const [form, setForm] = useState({ client_name: '', cover_option: '', membership_fee: '200', notes: '' });

  // Batch generate
  const [rows, setRows] = useState([emptyRow()]);
  const [batchResult, setBatchResult] = useState(null);

  const selectedPlan = COVER_PLANS.find((p) => p.option === parseInt(form.cover_option));
  const planAmount = selectedPlan ? selectedPlan.premium : 0;
  const memberFee = parseFloat(form.membership_fee) || 0;
  const total = planAmount + memberFee;

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['admin-invoices', page, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 15 });
      if (filterStatus) params.set('status', filterStatus);
      const { data } = await api.get(`/invoices?${params}`);
      return data;
    },
    enabled: tab === 'history',
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => { const { data } = await api.post('/invoices', payload); return data.data; },
    onSuccess: async (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} created`);
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setPdfLoading(invoice.id);
      try { await downloadPdf(invoice.id, invoice.invoice_number); }
      catch { toast.error('Invoice saved but PDF download failed. Check History.'); }
      finally { setPdfLoading(null); }
      setForm({ client_name: '', cover_option: '', membership_fee: '200', notes: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create invoice'),
  });

  const bulkMutation = useMutation({
    mutationFn: async (invoices) => { const { data } = await api.post('/invoices/bulk', { invoices }); return data.data; },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setBatchResult(result);
      if (result.created_count > 0) toast.success(`${result.created_count} invoice${result.created_count > 1 ? 's' : ''} created`);
      if (result.failed_count > 0) toast.error(`${result.failed_count} row${result.failed_count > 1 ? 's' : ''} failed`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Batch creation failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => { await api.patch(`/invoices/${id}/status`, { status }); },
    onSuccess: () => { toast.success('Invoice marked as paid'); queryClient.invalidateQueries({ queryKey: ['admin-invoices'] }); },
    onError: () => toast.error('Failed to update status'),
  });

  // Batch row helpers
  function updateRow(id, field, value) { setRows((rs) => rs.map((r) => r._id === id ? { ...r, [field]: value } : r)); }
  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(id) { setRows((rs) => rs.length > 1 ? rs.filter((r) => r._id !== id) : rs); }

  function submitBatch() {
    const invoices = rows
      .filter((r) => r.client_name.trim() && r.cover_option)
      .map(({ client_name, cover_option, membership_fee, notes }) => ({
        client_name, cover_option: parseInt(cover_option),
        membership_fee: parseFloat(membership_fee) || 200,
        notes: notes || undefined,
      }));
    if (!invoices.length) return toast.error('Fill in at least one row');
    bulkMutation.mutate(invoices);
  }

  // Batch tally
  const batchTally = rows.reduce((acc, r) => {
    if (r.client_name.trim() && r.cover_option) {
      const plan = COVER_PLANS.find((p) => p.option === parseInt(r.cover_option));
      if (plan) acc.total = (acc.total || 0) + plan.premium + (parseFloat(r.membership_fee) || 200);
      acc.count = (acc.count || 0) + 1;
    }
    return acc;
  }, {});

  const invoices = invoicesData?.data || [];
  const pagination = invoicesData?.pagination;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <MdReceiptLong size={28} className="text-brand-gold" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-brand-navy">Invoices</h1>
            <p className="text-sm text-gray-500">Generate and manage client invoices</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { key: 'generate', label: 'Generate Invoice', icon: MdAdd },
            { key: 'batch', label: 'Batch Generate', icon: MdGroupAdd },
            { key: 'history', label: 'History', icon: MdHistory },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key !== 'batch') setBatchResult(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key ? 'border-brand-gold text-brand-gold' : 'border-transparent text-gray-500 hover:text-brand-navy'
              }`}
            >
              <Icon size={16} />{label}
            </button>
          ))}
        </div>

        {/* ── Single Generate ── */}
        {tab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-heading text-lg font-semibold text-brand-navy mb-5">Invoice Details</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.client_name.trim()) return toast.error('Client name is required'); if (!form.cover_option) return toast.error('Select a plan'); createMutation.mutate({ client_name: form.client_name, cover_option: parseInt(form.cover_option), plan_amount: planAmount, membership_fee: memberFee, notes: form.notes || undefined }); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
                  <input type="text" name="client_name" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Full name of client" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover Option / Plan <span className="text-red-500">*</span></label>
                  <select name="cover_option" value={form.cover_option} onChange={(e) => setForm((f) => ({ ...f, cover_option: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white">
                    <option value="">Select a plan</option>
                    {COVER_PLANS.map((p) => <option key={p.option} value={p.option}>{p.name} · Cover {p.cover}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Membership / Joining Fee (KES)</label>
                  <input type="number" name="membership_fee" value={form.membership_fee} onChange={(e) => setForm((f) => ({ ...f, membership_fee: e.target.value }))} min="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                  <p className="text-xs text-gray-400 mt-1">Standard joining fee is KES 200</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea name="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold resize-none" />
                </div>
                <button type="submit" disabled={createMutation.isPending || !!pdfLoading} className="w-full bg-brand-navy text-white font-semibold py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <MdDownload size={18} />{createMutation.isPending || pdfLoading ? 'Generating...' : 'Generate & Download Invoice'}
                </button>
              </form>
            </div>

            {/* Preview */}
            <div className="bg-brand-navy rounded-xl p-6 text-white flex flex-col justify-between min-h-[300px]">
              <div>
                <p className="text-brand-gold font-heading font-bold text-lg mb-1">My Life Companion Welfare</p>
                <p className="text-xs text-gray-400 mb-5">Underwritten by Old Mutual</p>
                <div className="bg-white/10 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-300 uppercase tracking-wide mb-1">Billed To</p>
                  <p className="font-semibold text-lg">{form.client_name || '—'}</p>
                </div>
                {selectedPlan && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-300">Annual Premium (Opt {selectedPlan.option})</span><span>{fmtKES(planAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Cover</span><span className="text-green-400">{selectedPlan.cover}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Joining Fee</span><span>{fmtKES(memberFee)}</span></div>
                  </div>
                )}
              </div>
              <div>
                <div className="border-t border-white/20 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total Due</span>
                  <span className="text-brand-gold font-bold text-xl">{fmtKES(total)}</span>
                </div>
                <div className="mt-3 bg-brand-gold/20 rounded-lg p-3 text-xs text-gray-300">
                  M-Pesa Paybill <span className="text-brand-gold font-semibold">625625</span> · Account <span className="text-brand-gold font-semibold">20190955</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Batch Generate ── */}
        {tab === 'batch' && (
          <div>
            {batchResult ? (
              /* Results */
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-green-600">{batchResult.created_count}</p><p className="text-sm text-green-700 font-medium">Created</p></div>
                  <div className="bg-red-50 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-red-500">{batchResult.failed_count}</p><p className="text-sm text-red-600 font-medium">Failed</p></div>
                  <div className="bg-brand-navy/5 rounded-xl p-4 text-center"><p className="text-3xl font-bold text-brand-navy">{batchResult.summary?.total ?? batchResult.created_count + batchResult.failed_count}</p><p className="text-sm text-gray-600 font-medium">Submitted</p></div>
                </div>

                {batchResult.created.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                      <MdCheckCircle size={16} className="text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Created Invoices</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-green-700 font-medium">Invoice #</th>
                            <th className="text-left px-4 py-2.5 text-green-700 font-medium">Client</th>
                            <th className="text-left px-4 py-2.5 text-green-700 font-medium hidden sm:table-cell">Plan</th>
                            <th className="text-right px-4 py-2.5 text-green-700 font-medium">Total</th>
                            <th className="text-center px-4 py-2.5 text-green-700 font-medium">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {batchResult.created.map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-mono text-xs text-brand-navy font-semibold">{inv.invoice_number}</td>
                              <td className="px-4 py-2.5 font-medium">{inv.client_name}</td>
                              <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">Option {inv.cover_option}</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{fmtKES(inv.total_amount)}</td>
                              <td className="px-4 py-2.5 text-center">
                                <button onClick={async () => { setPdfLoading(inv.id); try { await downloadPdf(inv.id, inv.invoice_number); } catch { toast.error('Download failed'); } finally { setPdfLoading(null); } }} disabled={pdfLoading === inv.id} className="p-1.5 rounded-lg hover:bg-brand-gold/10 text-brand-navy disabled:opacity-50">
                                  {pdfLoading === inv.id ? <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /> : <MdDownload size={18} />}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {batchResult.failed.length > 0 && (
                  <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
                      <MdError size={16} className="text-red-500" />
                      <span className="text-sm font-semibold text-red-600">Failed Rows</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-red-50">
                        {batchResult.failed.map((f) => (
                          <tr key={f.index} className="bg-red-50/30">
                            <td className="px-4 py-2.5 text-gray-400 text-xs w-12">#{f.index + 1}</td>
                            <td className="px-4 py-2.5 font-medium">{f.client_name}</td>
                            <td className="px-4 py-2.5 text-red-500 text-xs">{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={() => { setBatchResult(null); setRows([emptyRow()]); }} className="btn-outline">Add More</button>
                  <button onClick={() => { setBatchResult(null); setTab('history'); }} className="btn-primary">View History</button>
                </div>
              </div>
            ) : (
              /* Batch entry table */
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Tally bar */}
                {batchTally.count > 0 && (
                  <div className="px-4 py-3 bg-brand-navy/5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-brand-navy">
                      {batchTally.count} client{batchTally.count > 1 ? 's' : ''} ready
                    </span>
                    <span className="text-sm font-bold text-brand-gold">
                      Total: {fmtKES(batchTally.total || 0)}
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-brand-navy text-white">
                        <th className="text-left px-3 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-medium">Client Name *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Cover Option *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Joining Fee</th>
                        <th className="text-right px-3 py-2.5 font-medium">Total</th>
                        <th className="text-left px-3 py-2.5 font-medium">Notes</th>
                        <th className="w-10 px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => {
                        const plan = COVER_PLANS.find((p) => p.option === parseInt(row.cover_option));
                        const rowTotal = plan ? plan.premium + (parseFloat(row.membership_fee) || 200) : 0;
                        return (
                          <tr key={row._id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={row.client_name} onChange={(e) => updateRow(row._id, 'client_name', e.target.value)} placeholder="Full name" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={row.cover_option} onChange={(e) => updateRow(row._id, 'cover_option', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white">
                                {COVER_PLANS.map((p) => <option key={p.option} value={p.option}>Opt {p.option} — {fmtKES(p.premium)}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" value={row.membership_fee} onChange={(e) => updateRow(row._id, 'membership_fee', e.target.value)} min="0" className="w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-brand-navy whitespace-nowrap">
                              {rowTotal ? fmtKES(rowTotal) : '—'}
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={row.notes} onChange={(e) => updateRow(row._id, 'notes', e.target.value)} placeholder="Optional" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removeRow(row._id)} disabled={rows.length === 1} className="p-1 rounded hover:bg-red-50 text-red-400 disabled:opacity-20 transition-colors">
                                <MdDelete size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <button onClick={addRow} className="flex items-center gap-2 text-sm text-brand-navy hover:text-brand-gold font-medium transition-colors">
                    <MdAdd size={18} /> Add Row
                  </button>
                  <button
                    onClick={submitBatch}
                    disabled={bulkMutation.isPending || batchTally.count === 0}
                    className="btn-primary flex items-center gap-2"
                  >
                    {bulkMutation.isPending
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                      : <><MdGroupAdd size={18} /> Generate {batchTally.count > 0 ? `${batchTally.count} ` : ''}Invoice{batchTally.count !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white">
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-16 text-gray-400"><MdReceiptLong size={48} className="mx-auto mb-3 opacity-30" /><p>No invoices found</p></div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-brand-navy text-white">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                          <th className="text-left px-4 py-3 font-medium">Client</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Plan</th>
                          <th className="text-right px-4 py-3 font-medium">Total</th>
                          <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Created By</th>
                          <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-center px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-brand-navy font-semibold">{inv.invoice_number}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{inv.client_name}</td>
                            <td className="px-4 py-3 text-gray-500 hidden md:table-cell">Option {inv.cover_option}</td>
                            <td className="px-4 py-3 text-right font-semibold text-brand-navy">{fmtKES(inv.total_amount)}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{inv.created_by_name}<br /><span className="capitalize">{inv.created_by_role?.replace('_', ' ')}</span></td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{format(new Date(inv.created_at), 'dd MMM yyyy')}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {inv.status === 'paid' && <MdCheckCircle size={12} />}
                                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={async () => { setPdfLoading(inv.id); try { await downloadPdf(inv.id, inv.invoice_number); } catch { toast.error('PDF download failed'); } finally { setPdfLoading(null); } }} disabled={pdfLoading === inv.id} className="p-1.5 rounded-lg hover:bg-brand-gold/10 text-brand-navy transition-colors disabled:opacity-50">
                                  {pdfLoading === inv.id ? <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /> : <MdDownload size={18} />}
                                </button>
                                {inv.status === 'draft' && (
                                  <button onClick={() => statusMutation.mutate({ id: inv.id, status: 'paid' })} disabled={statusMutation.isPending} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50">
                                    <MdCheckCircle size={18} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {pagination && pagination.pages > 1 && (
                  <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                    <span>{pagination.total} total invoices</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Prev</button>
                      <span className="px-3 py-1.5">{page} / {pagination.pages}</span>
                      <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
