import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';
import { MdAttachMoney, MdCheckCircle, MdHourglassEmpty } from 'react-icons/md';

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

export default function AgentEarnings() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-commissions'],
    queryFn: async () => {
      const { data } = await api.get('/commissions/my');
      return data.data;
    },
  });

  const summary = data?.summary || { total_earned: 0, disbursed: 0, pending: 0 };
  const commissions = data?.commissions || [];

  const summaryCards = [
    { label: 'Total Earned', value: fmt(summary.total_earned), icon: MdAttachMoney, bg: 'bg-blue-50', color: 'text-blue-600' },
    { label: 'Disbursed', value: fmt(summary.disbursed), icon: MdCheckCircle, bg: 'bg-green-50', color: 'text-green-600' },
    { label: 'Pending Payout', value: fmt(summary.pending), icon: MdHourglassEmpty, bg: 'bg-yellow-50', color: 'text-yellow-600' },
  ];

  return (
    <Layout title="My Earnings">
      <div className="space-y-6 max-w-4xl">
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

        {/* Commission breakdown */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Commission Breakdown</h3>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : commissions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No commissions yet. Your commissions appear here when your registered members are approved.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Member Name', 'Membership No.', 'Cover', 'Amount (KES)', 'Status', 'Date Earned'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{c.member_name}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{c.membership_number || '—'}</td>
                      <td className="py-2.5 pr-4">Option {c.cover_option}</td>
                      <td className="py-2.5 pr-4 font-semibold text-brand-navy">
                        {Number(c.commission_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          c.status === 'disbursed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {c.status === 'disbursed' ? 'Disbursed' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 whitespace-nowrap">
                        {format(new Date(c.created_at), 'dd MMM yyyy')}
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
