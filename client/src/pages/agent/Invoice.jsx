import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  MdReceiptLong, MdDownload, MdSearch, MdExpandMore, MdExpandLess,
  MdGroupAdd, MdAdd, MdDelete, MdCheckCircle, MdPerson, MdChildCare, MdElderly,
} from 'react-icons/md';

const COVER_PLANS = [
  { option: 1, name: 'Option 1 — KES 1,500/yr', premium: 1500, cover: 'KES 50,000' },
  { option: 2, name: 'Option 2 — KES 3,000/yr', premium: 3000, cover: 'KES 100,000' },
  { option: 3, name: 'Option 3 — KES 6,000/yr', premium: 6000, cover: 'KES 200,000' },
  { option: 4, name: 'Option 4 — KES 9,000/yr', premium: 9000, cover: 'KES 300,000' },
  { option: 5, name: 'Option 5 — KES 12,000/yr', premium: 12000, cover: 'KES 400,000' },
  { option: 6, name: 'Option 6 — KES 15,000/yr', premium: 15000, cover: 'KES 500,000' },
];

// Extra child premium (per child beyond 4)
const EXTRA_CHILD_RATE = [0, 300, 500, 500, 500, 500, 500];
// Parent / parent-in-law above 80 premium
const PARENT_80_RATE = [0, 1000, 2000, 4000, 4000, 4000, 4000];

function extraChildRate(option) { return EXTRA_CHILD_RATE[option] || 0; }
function parent80Rate(option) { return PARENT_80_RATE[option] || 0; }

function fmtKES(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

function emptyRow() {
  return { _id: Math.random(), client_name: '', cover_option: '3', extra_children: 0, parents_above_80: 0 };
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

export default function AgentInvoice() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('single');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(null);

  // Single mode
  const [form, setForm] = useState({ client_name: '', cover_option: '', due_date: '', extra_children: 0, parents_above_80: 0 });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Batch mode
  const [rows, setRows] = useState([emptyRow()]);
  const [groupName, setGroupName] = useState('');
  const [batchDueDate, setBatchDueDate] = useState('');
  const [groupResult, setGroupResult] = useState(null);

  const selectedPlan = COVER_PLANS.find((p) => p.option === parseInt(form.cover_option));
  const planAmount = selectedPlan ? selectedPlan.premium : 0;
  const optNum = selectedPlan ? selectedPlan.option : 0;
  const extraChildPremium = extraChildRate(optNum) * (parseInt(form.extra_children) || 0);
  const parent80Premium = parent80Rate(optNum) * (parseInt(form.parents_above_80) || 0);
  const total = planAmount + 200 + extraChildPremium + parent80Premium;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['my-invoices-agent'],
    queryFn: async () => { const { data } = await api.get('/invoices?limit=50'); return data; },
    enabled: historyOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => { const { data } = await api.post('/invoices', payload); return data.data; },
    onSuccess: async (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} created`);
      queryClient.invalidateQueries({ queryKey: ['my-invoices-agent'] });
      setPdfLoading(invoice.id);
      try { await downloadPdf(invoice.id, invoice.invoice_number); }
      catch { toast.error('Invoice saved but PDF download failed.'); }
      finally { setPdfLoading(null); }
      setForm({ client_name: '', cover_option: '', due_date: '', extra_children: 0, parents_above_80: 0 });
      setSearch(''); setSearchResults([]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create invoice'),
  });

  const groupMutation = useMutation({
    mutationFn: async (payload) => { const { data } = await api.post('/invoices/group', payload); return data.data; },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['my-invoices-agent'] });
      setGroupResult(invoice);
      const n = invoice.group_members?.length || 1;
      toast.success(`Group invoice created for ${n} member${n > 1 ? 's' : ''}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Group invoice creation failed'),
  });

  async function handleMemberSearch(e) {
    const q = e.target.value;
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try { const { data } = await api.get(`/members?search=${encodeURIComponent(q)}&limit=5`); setSearchResults(data.data || []); }
    catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  function selectMember(member) {
    setForm((f) => ({ ...f, client_name: member.full_name }));
    setSearch(member.full_name); setSearchResults([]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_name.trim()) return toast.error('Client name is required');
    if (!form.cover_option) return toast.error('Please select a cover option');
    createMutation.mutate({
      client_name: form.client_name,
      cover_option: parseInt(form.cover_option),
      plan_amount: planAmount,
      membership_fee: 200,
      extra_children: parseInt(form.extra_children) || 0,
      parents_above_80: parseInt(form.parents_above_80) || 0,
      due_date: form.due_date || undefined,
    });
  }

  function updateRow(id, field, value) { setRows((rs) => rs.map((r) => r._id === id ? { ...r, [field]: value } : r)); }
  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(id) { setRows((rs) => rs.length > 1 ? rs.filter((r) => r._id !== id) : rs); }

  function rowTotal(row) {
    const plan = COVER_PLANS.find((p) => p.option === parseInt(row.cover_option));
    if (!plan) return 0;
    const opt = plan.option;
    return plan.premium + 200
      + extraChildRate(opt) * (parseInt(row.extra_children) || 0)
      + parent80Rate(opt) * (parseInt(row.parents_above_80) || 0);
  }

  function submitBatch() {
    const members = rows
      .filter((r) => r.client_name.trim() && r.cover_option)
      .map(({ client_name, cover_option, extra_children, parents_above_80 }) => ({
        client_name,
        cover_option: parseInt(cover_option),
        extra_children: parseInt(extra_children) || 0,
        parents_above_80: parseInt(parents_above_80) || 0,
      }));
    if (!members.length) return toast.error('Fill in at least one row');
    groupMutation.mutate({ group_name: groupName.trim() || undefined, members, due_date: batchDueDate || undefined });
  }

  const batchTally = rows.reduce((acc, r) => {
    if (r.client_name.trim() && r.cover_option) {
      acc.total = (acc.total || 0) + rowTotal(r);
      acc.count = (acc.count || 0) + 1;
    }
    return acc;
  }, {});

  const myInvoices = historyData?.data || [];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <MdReceiptLong size={28} className="text-brand-gold" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-brand-navy">Invoices</h1>
              <p className="text-sm text-gray-500">Generate invoices for clients</p>
            </div>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-medium">
            <button onClick={() => { setMode('single'); setGroupResult(null); }} className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${mode === 'single' ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <MdPerson size={15} /> Single
            </button>
            <button onClick={() => setMode('batch')} className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${mode === 'batch' ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <MdGroupAdd size={15} /> Batch
            </button>
          </div>
        </div>

        {/* ── Single mode ── */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Member search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Registered Member (optional)</label>
                  <div className="relative">
                    <MdSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={handleMemberSearch} placeholder="Type name or membership no." className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-3 h-3 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      {searchResults.map((m) => (
                        <button key={m.id} type="button" onClick={() => selectMember(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-gold/10 transition-colors border-b last:border-0">
                          <span className="font-medium">{m.full_name}</span>
                          {m.membership_number && <span className="ml-2 text-xs text-gray-400">{m.membership_number}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Full name of client" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover Option / Plan <span className="text-red-500">*</span></label>
                  <select value={form.cover_option} onChange={(e) => setForm((f) => ({ ...f, cover_option: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white">
                    <option value="">Select a plan</option>
                    {COVER_PLANS.map((p) => <option key={p.option} value={p.option}>{p.name} · Cover {p.cover}</option>)}
                  </select>
                </div>

                {/* Extra premium fields */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Additional Premiums</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                        <MdChildCare size={15} className="text-amber-600" /> Extra Children <span className="text-xs text-gray-400">(beyond 4)</span>
                      </label>
                      <input
                        type="number" min="0" max="20"
                        value={form.extra_children}
                        onChange={(e) => setForm((f) => ({ ...f, extra_children: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                      />
                      {selectedPlan && parseInt(form.extra_children) > 0 && (
                        <p className="text-xs text-amber-700 mt-1">{fmtKES(extraChildRate(optNum))} × {form.extra_children} = {fmtKES(extraChildPremium)}</p>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                        <MdElderly size={15} className="text-amber-600" /> Parents above 80
                      </label>
                      <input
                        type="number" min="0" max="4"
                        value={form.parents_above_80}
                        onChange={(e) => setForm((f) => ({ ...f, parents_above_80: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                      />
                      {selectedPlan && parseInt(form.parents_above_80) > 0 && (
                        <p className="text-xs text-amber-700 mt-1">{fmtKES(parent80Rate(optNum))} × {form.parents_above_80} = {fmtKES(parent80Premium)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joining Fee</label>
                    <input type="text" value="KES 200 (standard)" readOnly className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pay By Date</label>
                    <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                  </div>
                </div>

                {selectedPlan && (
                  <div className="bg-brand-navy/5 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-sm text-gray-600 font-medium">Total Due</span>
                    <span className="text-brand-navy font-bold text-lg">{fmtKES(total)}</span>
                  </div>
                )}

                <button type="submit" disabled={createMutation.isPending || !!pdfLoading} className="w-full bg-brand-navy text-white font-semibold py-3 rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
                  <MdDownload size={18} />{createMutation.isPending || pdfLoading ? 'Generating...' : 'Generate & Download Invoice'}
                </button>
              </form>
            </div>

            {/* Preview panel */}
            <div className="bg-brand-navy rounded-xl p-6 text-white flex flex-col justify-between">
              <div>
                <p className="text-brand-gold font-heading font-bold text-base mb-1">My Life Companion Welfare</p>
                <p className="text-xs text-gray-400 mb-5">Underwritten by Old Mutual</p>
                <div className="bg-white/10 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Billed To</p>
                  <p className="font-semibold">{form.client_name || '—'}</p>
                </div>
                {selectedPlan ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-300">Annual Premium</span><span>{fmtKES(planAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Cover</span><span className="text-green-400">{selectedPlan.cover}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Joining Fee</span><span>{fmtKES(200)}</span></div>
                    {extraChildPremium > 0 && (
                      <div className="flex justify-between"><span className="text-amber-300">Extra Children ({form.extra_children})</span><span>{fmtKES(extraChildPremium)}</span></div>
                    )}
                    {parent80Premium > 0 && (
                      <div className="flex justify-between"><span className="text-amber-300">Parents above 80 ({form.parents_above_80})</span><span>{fmtKES(parent80Premium)}</span></div>
                    )}
                  </div>
                ) : <p className="text-gray-500 text-sm">Select a plan to preview totals</p>}
              </div>
              <div>
                <div className="border-t border-white/20 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total Due</span>
                  <span className="text-brand-gold font-bold text-xl">{selectedPlan ? fmtKES(total) : '—'}</span>
                </div>
                <div className="mt-3 bg-brand-gold/20 rounded-lg p-3 text-xs text-gray-300">M-Pesa Paybill <span className="text-brand-gold font-semibold">625625</span> · Account <span className="text-brand-gold font-semibold">20190955</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── Batch mode ── */}
        {mode === 'batch' && (
          <div>
            {groupResult ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <MdCheckCircle size={24} className="text-green-600" />
                    <div>
                      <p className="font-semibold text-brand-navy text-lg">Group Invoice Created</p>
                      <p className="text-sm text-gray-500">{groupResult.group_members?.length || 1} member{(groupResult.group_members?.length || 1) > 1 ? 's' : ''} on one invoice</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-brand-navy/5 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Invoice #</p>
                      <p className="font-mono font-bold text-brand-navy text-sm">{groupResult.invoice_number}</p>
                    </div>
                    <div className="bg-brand-gold/10 rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Total Due</p>
                      <p className="font-bold text-brand-navy text-sm">{fmtKES(groupResult.total_amount)}</p>
                    </div>
                  </div>
                  {groupResult.group_members?.length > 0 && (
                    <div className="border border-gray-100 rounded-lg overflow-hidden mb-5">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium">Member</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium hidden sm:table-cell">Plan</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium hidden sm:table-cell">Extras</th>
                            <th className="text-right px-3 py-2 text-gray-500 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {groupResult.group_members.map((m, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{m.client_name}</td>
                              <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">Option {m.cover_option} — {m.cover}</td>
                              <td className="px-3 py-2 text-xs text-amber-600 hidden sm:table-cell">
                                {m.extra_children > 0 && <span className="mr-2">+{m.extra_children} child</span>}
                                {m.parents_above_80 > 0 && <span>+{m.parents_above_80} parent&gt;80</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-brand-navy">{fmtKES(m.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button
                    onClick={async () => { setPdfLoading(groupResult.id); try { await downloadPdf(groupResult.id, groupResult.invoice_number); } catch { toast.error('PDF download failed'); } finally { setPdfLoading(null); } }}
                    disabled={pdfLoading === groupResult.id}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {pdfLoading === groupResult.id ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Downloading...</> : <><MdDownload size={18} /> Download Group Invoice PDF</>}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setGroupResult(null); setRows([emptyRow()]); setGroupName(''); setBatchDueDate(''); }} className="btn-outline">New Group Invoice</button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group / Invoice Name (optional)" className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Pay By:</label>
                      <input type="date" value={batchDueDate} onChange={(e) => setBatchDueDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold" />
                    </div>
                  </div>
                  {batchTally.count > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium text-brand-navy">{batchTally.count} member{batchTally.count > 1 ? 's' : ''} ready</span>
                      <span className="font-bold text-brand-gold ml-auto">Total: {fmtKES(batchTally.total || 0)}</span>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-brand-navy text-white">
                        <th className="text-left px-3 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-medium">Member Name *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Cover Option *</th>
                        <th className="text-left px-3 py-2.5 font-medium w-24" title="Children beyond 4"><MdChildCare size={14} className="inline mr-1" />Extra Kids</th>
                        <th className="text-left px-3 py-2.5 font-medium w-24" title="Parents/In-laws above 80"><MdElderly size={14} className="inline mr-1" />Prnt&gt;80</th>
                        <th className="text-right px-3 py-2.5 font-medium">Total</th>
                        <th className="w-10 px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => {
                        const plan = COVER_PLANS.find((p) => p.option === parseInt(row.cover_option));
                        const rt = rowTotal(row);
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
                              <input type="number" min="0" max="20" value={row.extra_children} onChange={(e) => updateRow(row._id, 'extra_children', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold text-center" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" max="4" value={row.parents_above_80} onChange={(e) => updateRow(row._id, 'parents_above_80', e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold text-center" />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-brand-navy whitespace-nowrap text-xs">
                              {plan ? fmtKES(rt) : '—'}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removeRow(row._id)} disabled={rows.length === 1} className="p-1 rounded hover:bg-red-50 text-red-400 disabled:opacity-20">
                                <MdDelete size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <button onClick={addRow} className="flex items-center gap-2 text-sm text-brand-navy hover:text-brand-gold font-medium transition-colors">
                    <MdAdd size={18} /> Add Member
                  </button>
                  <button onClick={submitBatch} disabled={groupMutation.isPending || batchTally.count === 0} className="btn-primary flex items-center gap-2">
                    {groupMutation.isPending
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                      : <><MdGroupAdd size={18} /> Generate Group Invoice ({batchTally.count || 0} Member{batchTally.count !== 1 ? 's' : ''})</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button onClick={() => setHistoryOpen((o) => !o)} className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-brand-navy hover:bg-gray-50 transition-colors">
            <span className="flex items-center gap-2"><MdReceiptLong size={18} className="text-brand-gold" />My Invoice History</span>
            {historyOpen ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </button>
          {historyOpen && (
            <div className="border-t border-gray-100">
              {historyLoading ? <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>
                : myInvoices.length === 0 ? <p className="text-center text-gray-400 py-8 text-sm">No invoices yet</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                          <th className="text-left px-4 py-2.5 font-medium">Client</th>
                          <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Plan</th>
                          <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Extras</th>
                          <th className="text-right px-4 py-2.5 font-medium">Total</th>
                          <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                          <th className="text-center px-4 py-2.5 font-medium">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {myInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-brand-navy font-semibold">{inv.invoice_number}</td>
                            <td className="px-4 py-2.5 text-gray-700">{inv.client_name}</td>
                            <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{inv.group_members ? `Group (${inv.group_members.length})` : `Opt ${inv.cover_option}`}</td>
                            <td className="px-4 py-2.5 text-xs text-amber-600 hidden md:table-cell">
                              {!inv.group_members && (
                                <>
                                  {(inv.extra_children > 0) && <div>+{inv.extra_children} child</div>}
                                  {(inv.parents_above_80 > 0) && <div>+{inv.parents_above_80} prnt&gt;80</div>}
                                </>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold">{fmtKES(inv.total_amount)}</td>
                            <td className="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell">
                              <div>{format(new Date(inv.created_at), 'dd MMM yyyy')}</div>
                              {inv.due_date && <div className="text-red-400">Due: {format(new Date(inv.due_date), 'dd MMM yy')}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={async () => { setPdfLoading(inv.id); try { await downloadPdf(inv.id, inv.invoice_number); } catch { toast.error('PDF download failed'); } finally { setPdfLoading(null); } }} disabled={pdfLoading === inv.id} className="p-1.5 rounded-lg hover:bg-brand-gold/10 text-brand-navy transition-colors disabled:opacity-50">
                                {pdfLoading === inv.id ? <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /> : <MdDownload size={18} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
