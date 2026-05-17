import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdReceiptLong, MdDownload, MdSearch, MdExpandMore, MdExpandLess } from 'react-icons/md';

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

export default function TeamLeaderInvoice() {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(null);

  const [form, setForm] = useState({
    client_name: '',
    cover_option: '',
  });
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const selectedPlan = COVER_PLANS.find((p) => p.option === parseInt(form.cover_option));
  const planAmount = selectedPlan ? selectedPlan.premium : 0;
  const total = planAmount + 200;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['my-invoices-tl'],
    queryFn: async () => {
      const { data } = await api.get('/invoices?limit=50');
      return data;
    },
    enabled: historyOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/invoices', payload);
      return data.data;
    },
    onSuccess: async (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} created`);
      queryClient.invalidateQueries({ queryKey: ['my-invoices-tl'] });
      setPdfLoading(invoice.id);
      try {
        await downloadPdf(invoice.id, invoice.invoice_number);
      } catch {
        toast.error('Invoice saved but PDF download failed.');
      } finally {
        setPdfLoading(null);
      }
      setForm({ client_name: '', cover_option: '' });
      setSearch('');
      setSearchResults([]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create invoice');
    },
  });

  async function handleMemberSearch(e) {
    const q = e.target.value;
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/members?search=${encodeURIComponent(q)}&limit=5`);
      setSearchResults(data.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectMember(member) {
    setForm((f) => ({ ...f, client_name: member.full_name }));
    setSearch(member.full_name);
    setSearchResults([]);
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
    });
  }

  const myInvoices = historyData?.data || [];

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <MdReceiptLong size={28} className="text-brand-gold" />
          <div>
            <h1 className="font-heading text-2xl font-bold text-brand-navy">Generate Invoice</h1>
            <p className="text-sm text-gray-500">Create an invoice for a registered or new client</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Member search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Registered Member (optional)
                </label>
                <div className="relative">
                  <MdSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={handleMemberSearch}
                    placeholder="Type name or membership no."
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember(m)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-brand-gold/10 transition-colors border-b last:border-0"
                      >
                        <span className="font-medium">{m.full_name}</span>
                        {m.membership_number && (
                          <span className="ml-2 text-xs text-gray-400">{m.membership_number}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  placeholder="Full name of client"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cover Option / Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.cover_option}
                  onChange={(e) => setForm((f) => ({ ...f, cover_option: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
                >
                  <option value="">Select a plan</option>
                  {COVER_PLANS.map((p) => (
                    <option key={p.option} value={p.option}>
                      {p.name} · Cover {p.cover}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Joining Fee</label>
                <input
                  type="text"
                  value="KES 200 (standard)"
                  readOnly
                  className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                />
              </div>

              {selectedPlan && (
                <div className="bg-brand-navy/5 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-medium">Total Due</span>
                  <span className="text-brand-navy font-bold text-lg">{fmtKES(total)}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={createMutation.isPending || !!pdfLoading}
                className="w-full bg-brand-navy text-white font-semibold py-2.5 rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <MdDownload size={18} />
                {createMutation.isPending || pdfLoading ? 'Generating...' : 'Generate & Download Invoice'}
              </button>
            </form>
          </div>

          {/* Preview card */}
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
                  <div className="flex justify-between">
                    <span className="text-gray-300">Annual Premium</span>
                    <span>{fmtKES(planAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Cover</span>
                    <span className="text-green-400">{selectedPlan.cover}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Joining Fee</span>
                    <span>{fmtKES(200)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Select a plan to preview totals</p>
              )}
            </div>

            <div>
              <div className="border-t border-white/20 pt-4 mt-4 flex justify-between items-center">
                <span className="text-gray-300 text-sm">Total Due</span>
                <span className="text-brand-gold font-bold text-xl">{selectedPlan ? fmtKES(total) : '—'}</span>
              </div>
              <div className="mt-3 bg-brand-gold/20 rounded-lg p-3 text-xs text-gray-300">
                M-Pesa Paybill <span className="text-brand-gold font-semibold">625625</span>
                {' · '}Account <span className="text-brand-gold font-semibold">20190955</span>
              </div>
            </div>
          </div>
        </div>

        {/* My Invoice History (collapsible) */}
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-brand-navy hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MdReceiptLong size={18} className="text-brand-gold" />
              My Invoice History
            </span>
            {historyOpen ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </button>

          {historyOpen && (
            <div className="border-t border-gray-100">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-7 h-7 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : myInvoices.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No invoices yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                        <th className="text-left px-4 py-2.5 font-medium">Client</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Plan</th>
                        <th className="text-right px-4 py-2.5 font-medium">Total</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                        <th className="text-center px-4 py-2.5 font-medium">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-brand-navy font-semibold">
                            {inv.invoice_number}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">{inv.client_name}</td>
                          <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">Opt {inv.cover_option}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{fmtKES(inv.total_amount)}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell">
                            {format(new Date(inv.created_at), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={async () => {
                                setPdfLoading(inv.id);
                                try { await downloadPdf(inv.id, inv.invoice_number); }
                                catch { toast.error('PDF download failed'); }
                                finally { setPdfLoading(null); }
                              }}
                              disabled={pdfLoading === inv.id}
                              className="p-1.5 rounded-lg hover:bg-brand-gold/10 text-brand-navy transition-colors disabled:opacity-50"
                            >
                              {pdfLoading === inv.id
                                ? <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                                : <MdDownload size={18} />}
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
