import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MdCheckCircle, MdEdit, MdDownload, MdInsertDriveFile } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';

export default function AdminMemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}`);
      return data.data;
    },
  });

  const { data: dependents } = useQuery({
    queryKey: ['dependents', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/dependents`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ['beneficiaries', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/beneficiaries`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: claims } = useQuery({
    queryKey: ['member-claims', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/claims`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ['member-documents', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/documents`);
      return data.data;
    },
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/members/${id}/approve`),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries(['member', id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Approval failed'),
  });

  const statusMutation = useMutation({
    mutationFn: () => api.patch(`/members/${id}/status`, { status: newStatus, notes: statusNotes }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries(['member', id]);
      setStatusModal(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Update failed'),
  });

  async function handleDownloadCard() {
    try {
      const response = await api.get(`/members/${id}/card`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `membership-card-${member?.membership_number}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Card not available yet');
    }
  }

  if (isLoading) {
    return (
      <Layout title="Member Details">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!member) {
    return <Layout title="Member Details"><p className="text-gray-500">Member not found.</p></Layout>;
  }

  return (
    <Layout title="Member Details">
      <div className="max-w-4xl space-y-6">
        {/* Action bar */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl font-bold text-brand-navy">{member.full_name}</h2>
            <StatusBadge status={member.status} />
          </div>
          <div className="flex gap-2">
            {user?.role === 'super_admin' && (
              <button
                onClick={() => navigate(`/admin/members/${id}/edit`)}
                className="btn-outline flex items-center gap-2"
              >
                <MdEdit size={16} /> Edit Member
              </button>
            )}
            {member.status === 'pending' && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <MdCheckCircle size={16} />
                {approveMutation.isPending ? 'Approving…' : 'Approve Member'}
              </button>
            )}
            {member.status !== 'pending' && (
              <button onClick={() => setStatusModal(true)} className="btn-outline flex items-center gap-2">
                <MdEdit size={16} /> Update Status
              </button>
            )}
            {member.status === 'active' && (
              <button onClick={handleDownloadCard} className="btn-secondary flex items-center gap-2">
                <MdDownload size={16} /> Download Card
              </button>
            )}
          </div>
        </div>

        {/* Personal info */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Membership No.', value: member.membership_number || 'Pending approval' },
              { label: 'ID / Passport', value: member.id_passport_no },
              { label: 'KRA PIN', value: member.kra_pin || '—' },
              { label: 'Date of Birth', value: member.dob ? format(new Date(member.dob), 'dd MMM yyyy') : '—' },
              { label: 'Gender', value: member.gender || '—' },
              { label: 'Phone', value: member.phone },
              { label: 'Email', value: member.email || '—' },
              { label: 'Address', value: member.physical_address || '—' },
              { label: 'Cover Option', value: `Option ${member.cover_option}` },
              { label: 'Registered By', value: member.agent_name || '—' },
              { label: 'Approved By', value: member.approved_by_name || '—' },
              { label: 'Registration Date', value: format(new Date(member.registration_date), 'dd MMM yyyy') },
              { label: 'Approval Date', value: member.approval_date ? format(new Date(member.approval_date), 'dd MMM yyyy') : '—' },
              { label: 'Medical Declaration', value: member.medical_declaration ? 'Yes' : 'No' },
              { label: 'Notes', value: member.notes || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium text-brand-navy break-words">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dependents */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Dependents ({dependents?.length || 0})</h3>
          {!dependents?.length ? (
            <p className="text-gray-500 text-sm">No dependents on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Relationship', 'DOB', 'ID/Birth Cert'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dependents.map((dep) => (
                    <tr key={dep.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">{dep.full_name}</td>
                      <td className="py-2.5 pr-4 capitalize">{dep.relationship}</td>
                      <td className="py-2.5 pr-4">{dep.dob ? format(new Date(dep.dob), 'dd MMM yyyy') : '—'}</td>
                      <td className="py-2.5">{dep.id_or_birth_cert_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Beneficiaries */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Beneficiaries ({beneficiaries?.length || 0})</h3>
          {!beneficiaries?.length ? (
            <p className="text-gray-500 text-sm">No beneficiaries on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Relationship', 'Phone', 'ID/Passport', 'Address'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((ben) => (
                    <tr key={ben.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">{ben.full_name}</td>
                      <td className="py-2.5 pr-4 capitalize">{ben.relationship}</td>
                      <td className="py-2.5 pr-4">{ben.phone || '—'}</td>
                      <td className="py-2.5 pr-4">{ben.id_passport_no || '—'}</td>
                      <td className="py-2.5">{ben.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Supporting Documents */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">
            Supporting Documents ({documents?.length || 0})
          </h3>
          {!documents?.length ? (
            <p className="text-gray-500 text-sm">No documents uploaded.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                  <MdInsertDriveFile size={20} className="text-brand-gold flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-navy truncate">{doc.original_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Uploaded by {doc.uploaded_by_name || 'Unknown'} · {format(new Date(doc.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <a
                    href={`/uploads/${doc.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1 flex-shrink-0"
                  >
                    <MdDownload size={14} /> View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Claims */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Claims History ({claims?.length || 0})</h3>
          {!claims?.length ? (
            <p className="text-gray-500 text-sm">No claims on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Type', 'Amount', 'Status', 'Submitted', 'Review Notes'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">{c.claim_type}</td>
                      <td className="py-2.5 pr-4">KES {parseFloat(c.claim_amount).toLocaleString('en-KE')}</td>
                      <td className="py-2.5 pr-4"><StatusBadge status={c.status} /></td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {format(new Date(c.submitted_at), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{c.review_notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-heading font-bold text-brand-navy text-lg mb-4">Update Member Status</h3>
            <div className="space-y-4">
              <div>
                <label className="label">New Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input">
                  <option value="">Select status</option>
                  {['active', 'suspended', 'deceased', 'claim_pending', 'claim_settled'].map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Reason for status change..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStatusModal(false)} className="btn-outline flex-1">Cancel</button>
                <button
                  onClick={() => statusMutation.mutate()}
                  disabled={!newStatus || statusMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {statusMutation.isPending ? 'Updating…' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
