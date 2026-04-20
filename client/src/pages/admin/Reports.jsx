import { useQuery } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { MdDownload } from 'react-icons/md';

function exportFile(type, format) {
  const url = `/api/v1/reports/export?type=${type}&format=${format}`;
  const token = localStorage.getItem('token');
  const a = document.createElement('a');
  a.href = url;
  a.click();
}

export default function AdminReports() {
  const { data: growth } = useQuery({
    queryKey: ['growth-12'],
    queryFn: async () => {
      const { data } = await api.get('/reports/growth?months=12');
      return data.data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ['agents-all'],
    queryFn: async () => {
      const { data } = await api.get('/reports/agents');
      return data.data;
    },
  });

  const { data: claimsReport } = useQuery({
    queryKey: ['claims-report'],
    queryFn: async () => {
      const { data } = await api.get('/reports/claims');
      return data.data;
    },
  });

  return (
    <Layout title="Reports & Analytics">
      <div className="max-w-7xl space-y-6">
        {/* Export buttons */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Export Data</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'members', label: 'Members CSV' },
              { type: 'claims', label: 'Claims CSV' },
              { type: 'agents', label: 'Agents CSV' },
              { type: 'members', label: 'Members PDF', format: 'pdf' },
              { type: 'claims', label: 'Claims PDF', format: 'pdf' },
            ].map(({ type, label, format: fmt }) => (
              <button
                key={label}
                onClick={() => {
                  const url = `/api/v1/reports/export?type=${type}&format=${fmt || 'csv'}`;
                  const a = document.createElement('a');
                  a.href = url;
                  // Set auth header via fetch instead
                  fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                    .then((r) => r.blob())
                    .then((blob) => {
                      const burl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = burl;
                      link.download = `${type}-export.${fmt || 'csv'}`;
                      link.click();
                      URL.revokeObjectURL(burl);
                    });
                }}
                className="btn-outline flex items-center gap-2 text-sm py-2"
              >
                <MdDownload size={16} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Membership growth */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Membership Growth (12 months)</h3>
          {growth?.membership_growth?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={growth.membership_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="new_members" stroke="#F5A623" strokeWidth={2} name="New Members" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm py-8 text-center">No data available</p>
          )}
        </div>

        {/* Claims trend */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Claims Trend (12 months)</h3>
          {growth?.claims_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={growth.claims_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="claims_submitted" fill="#1A2B4A" name="Claims Submitted" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm py-8 text-center">No data available</p>
          )}
        </div>

        {/* Claims by type */}
        {claimsReport?.by_type?.length > 0 && (
          <div className="card">
            <h3 className="font-heading font-bold text-brand-navy mb-4">Claims by Type</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Claim Type', 'Count', 'Total Amount (KES)', 'Avg Amount (KES)'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claimsReport.by_type.map((row) => (
                    <tr key={row.claim_type} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{row.claim_type}</td>
                      <td className="py-2.5 pr-4">{row.count}</td>
                      <td className="py-2.5 pr-4">{parseFloat(row.total_amount).toLocaleString('en-KE')}</td>
                      <td className="py-2.5">{parseFloat(row.avg_amount).toLocaleString('en-KE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Agent leaderboard */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Agent Recruitment Leaderboard</h3>
          {!agents?.length ? (
            <p className="text-gray-400 text-sm">No agents registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['#', 'Agent Name', 'Phone', 'Total Recruits', 'Approved', 'Pending'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium">{a.agent_name}</td>
                      <td className="py-2.5 pr-4 text-gray-500">{a.phone}</td>
                      <td className="py-2.5 pr-4 font-bold text-brand-navy">{a.total_recruits}</td>
                      <td className="py-2.5 pr-4 text-green-600">{a.approved}</td>
                      <td className="py-2.5 text-yellow-600">{a.pending}</td>
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
