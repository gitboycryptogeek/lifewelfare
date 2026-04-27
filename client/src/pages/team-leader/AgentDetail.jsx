import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import {
  MdArrowBack, MdPrint, MdPeople, MdCheckCircle, MdHourglassEmpty, MdPhone,
} from 'react-icons/md';
import { printTable } from '../../utils/print';

const STATUS_LABELS = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
  deceased: 'Deceased',
  claim_pending: 'Claim Pending',
  claim_settled: 'Claim Settled',
};

export default function TeamLeaderAgentDetail() {
  const { agentId } = useParams();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tl-agent-detail', agentId, page],
    queryFn: async () => {
      const { data } = await api.get(`/team-leader/agents/${agentId}?page=${page}&limit=50`);
      return data.data;
    },
  });

  const agent = data?.agent;
  const members = data?.members || [];
  const meta = data?.meta;

  async function handlePrintAgent() {
    if (!agent) return;
    printTable({
      title: `Agent Report — ${agent.full_name}`,
      subtitle: `Phone: ${agent.phone} | Recruits: ${agent.total_recruits} | Approved: ${agent.approved} | Pending: ${agent.pending}`,
      headers: ['#', 'Full Name', 'Membership No.', 'Phone', 'ID / Passport', 'Cover', 'Status', 'Registration Date'],
      rows: members.map((m, i) => [
        i + 1,
        m.full_name,
        m.membership_number || '—',
        m.phone,
        m.id_passport_no,
        `Option ${m.cover_option}`,
        STATUS_LABELS[m.status] || m.status,
        m.registration_date ? format(new Date(m.registration_date), 'dd MMM yyyy') : '—',
      ]),
    });
  }

  async function handlePrintAll() {
    if (!agent) return;
    const { data: res } = await api.get(`/team-leader/agents/${agentId}?page=1&limit=1000`);
    const allMembers = res.data.members;
    printTable({
      title: `All Recruits — ${agent.full_name}`,
      subtitle: `Phone: ${agent.phone} | Total: ${agent.total_recruits} recruits`,
      headers: ['#', 'Full Name', 'Membership No.', 'Phone', 'ID / Passport', 'Cover', 'Status', 'Registration Date'],
      rows: allMembers.map((m, i) => [
        i + 1,
        m.full_name,
        m.membership_number || '—',
        m.phone,
        m.id_passport_no,
        `Option ${m.cover_option}`,
        STATUS_LABELS[m.status] || m.status,
        m.registration_date ? format(new Date(m.registration_date), 'dd MMM yyyy') : '—',
      ]),
    });
  }

  if (isLoading) {
    return (
      <Layout title="Agent Detail">
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isError || !agent) {
    return (
      <Layout title="Agent Detail">
        <div className="max-w-3xl">
          <Link to="/team-leader/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-navy mb-6">
            <MdArrowBack size={16} /> Back to Dashboard
          </Link>
          <p className="text-red-500">Agent not found or not in your team.</p>
        </div>
      </Layout>
    );
  }

  const stats = [
    { label: 'Total Recruits', value: agent.total_recruits || 0, icon: MdPeople, color: 'text-blue-600' },
    { label: 'Approved', value: agent.approved || 0, icon: MdCheckCircle, color: 'text-green-600' },
    { label: 'Pending', value: agent.pending || 0, icon: MdHourglassEmpty, color: 'text-yellow-600' },
  ];

  return (
    <Layout title="Agent Detail">
      <div className="space-y-6 max-w-5xl">
        {/* Back */}
        <Link to="/team-leader/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-navy">
          <MdArrowBack size={16} /> Back to Dashboard
        </Link>

        {/* Agent info card */}
        <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-brand-navy">{agent.full_name}</h2>
            <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
              <MdPhone size={14} /> {agent.phone}
            </div>
            <span className={`inline-block mt-2 text-xs font-medium ${agent.is_active ? 'text-green-600' : 'text-red-500'}`}>
              {agent.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button
            onClick={handlePrintAgent}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-navy transition-colors self-start sm:self-auto"
          >
            <MdPrint size={16} /> Print Agent Info
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card text-center">
              <stat.icon size={22} className={`${stat.color} mx-auto mb-1.5`} />
              <div className="text-2xl font-bold text-brand-navy">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recruits table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-brand-navy">
              Recruits {meta?.total ? `(${meta.total})` : ''}
            </h3>
            {members.length > 0 && (
              <button
                onClick={handlePrintAll}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-navy transition-colors"
              >
                <MdPrint size={16} /> Print All Recruits
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">This agent has not registered any members yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['#', 'Full Name', 'Membership No.', 'Phone', 'ID / Passport', 'Cover', 'Status', 'Registration Date'].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-gray-400">{(page - 1) * 50 + i + 1}</td>
                        <td className="py-2.5 pr-4 font-medium">{m.full_name}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{m.membership_number || '—'}</td>
                        <td className="py-2.5 pr-4">{m.phone}</td>
                        <td className="py-2.5 pr-4">{m.id_passport_no}</td>
                        <td className="py-2.5 pr-4">Option {m.cover_option}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={m.status} /></td>
                        <td className="py-2.5 text-gray-500 whitespace-nowrap">
                          {m.registration_date ? format(new Date(m.registration_date), 'dd MMM yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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
