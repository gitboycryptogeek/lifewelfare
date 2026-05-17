import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MdPersonAdd, MdGroupAdd, MdAdd, MdDelete, MdCheckCircle, MdError, MdClose } from 'react-icons/md';

const ROLES = ['agent', 'team_leader', 'admin', 'super_admin'];
const ROLE_COLORS = {
  agent: 'bg-blue-100 text-blue-700',
  team_leader: 'bg-purple-100 text-purple-700',
  admin: 'bg-brand-navy text-white',
  super_admin: 'bg-brand-gold text-brand-navy',
};

function emptyRow() {
  return { full_name: '', phone: '', email: '', password: '', role: 'agent', _id: Math.random() };
}

export default function AdminUsers() {
  const qc = useQueryClient();

  // ── Single-add state ──────────────────────────────────────────────────────
  const [showSingle, setShowSingle] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', role: 'agent' });
  const [errors, setErrors] = useState({});

  // ── Bulk-add state ────────────────────────────────────────────────────────
  const [showBulk, setShowBulk] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);
  const [bulkResult, setBulkResult] = useState(null); // null | { created, failed, summary }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/users', form),
    onSuccess: () => {
      toast.success('User created successfully');
      qc.invalidateQueries(['admin-users']);
      setShowSingle(false);
      setForm({ full_name: '', phone: '', email: '', password: '', role: 'agent' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create user'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => {
      toast.success('User deactivated');
      qc.invalidateQueries(['admin-users']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const bulkMutation = useMutation({
    mutationFn: (users) => api.post('/admin/users/bulk', { users }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['admin-users']);
      setBulkResult(data.data);
      if (data.data.created_count > 0) {
        toast.success(`${data.data.created_count} user${data.data.created_count > 1 ? 's' : ''} created`);
      }
      if (data.data.failed_count > 0) {
        toast.error(`${data.data.failed_count} row${data.data.failed_count > 1 ? 's' : ''} failed`);
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Bulk creation failed'),
  });

  // ── Validation (single) ───────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.full_name) e.full_name = 'Required';
    if (!form.phone) e.phone = 'Required';
    if (form.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Bulk row helpers ──────────────────────────────────────────────────────
  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => r._id === id ? { ...r, [field]: value } : r));
  }
  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(id) { setRows((rs) => rs.length > 1 ? rs.filter((r) => r._id !== id) : rs); }

  function closeBulk() {
    setShowBulk(false);
    setRows([emptyRow()]);
    setBulkResult(null);
  }

  function submitBulk() {
    const users = rows.map(({ full_name, phone, email, password, role }) => ({
      full_name, phone, email, password, role,
    }));
    bulkMutation.mutate(users);
  }

  // ── Tally by role ─────────────────────────────────────────────────────────
  const tally = rows.reduce((acc, r) => {
    if (r.full_name && r.phone && r.password && r.role) {
      acc[r.role] = (acc[r.role] || 0) + 1;
    }
    return acc;
  }, {});
  const filledCount = Object.values(tally).reduce((s, n) => s + n, 0);

  return (
    <Layout title="User Management">
      <div className="max-w-5xl space-y-4">
        <div className="flex justify-end gap-3 flex-wrap">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-brand-navy text-brand-navy text-sm font-semibold hover:bg-brand-navy hover:text-white transition-colors"
          >
            <MdGroupAdd size={18} /> Bulk Add Users
          </button>
          <button onClick={() => setShowSingle(true)} className="btn-primary flex items-center gap-2">
            <MdPersonAdd size={18} /> Create User
          </button>
        </div>

        <div className="card overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data?.length ? (
            <p className="text-center text-gray-500 py-10">No users found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name', 'Phone', 'Email', 'Role', 'Status', 'Last Login', ''].map((h) => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium">{u.full_name}</td>
                    <td className="py-3 pr-4">{u.phone}</td>
                    <td className="py-3 pr-4 text-gray-500">{u.email || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                      {u.last_login ? format(new Date(u.last_login), 'dd MMM yyyy') : 'Never'}
                    </td>
                    <td className="py-3">
                      {u.is_active && (
                        <button
                          onClick={() => { if (confirm(`Deactivate ${u.full_name}?`)) deactivateMutation.mutate(u.id); }}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Single Create Modal ─────────────────────────────────────────────── */}
      {showSingle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-heading font-bold text-brand-navy text-lg mb-4">Create New User</h3>
            <div className="space-y-4">
              {[
                { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'e.g. Jane Mwangi' },
                { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+254700000000' },
                { key: 'email', label: 'Email (optional)', type: 'email', placeholder: 'jane@example.com' },
                { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="input"
                    placeholder={placeholder}
                  />
                  {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
                </div>
              ))}
              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSingle(false)} className="btn-outline flex-1">Cancel</button>
                <button
                  onClick={() => validate() && createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Add Modal ──────────────────────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 px-2 py-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <MdGroupAdd size={24} className="text-brand-gold" />
                <div>
                  <h3 className="font-heading font-bold text-brand-navy text-lg">Bulk Add Users</h3>
                  <p className="text-xs text-gray-400">Fill in each row then click Submit. Empty rows are ignored.</p>
                </div>
              </div>
              <button onClick={closeBulk} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <MdClose size={20} />
              </button>
            </div>

            {/* Results view — shown after submission */}
            {bulkResult ? (
              <div className="p-6 space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{bulkResult.created_count}</p>
                    <p className="text-sm text-green-700 font-medium">Created</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-red-500">{bulkResult.failed_count}</p>
                    <p className="text-sm text-red-600 font-medium">Failed</p>
                  </div>
                  <div className="bg-brand-navy/5 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-brand-navy">{bulkResult.total}</p>
                    <p className="text-sm text-gray-600 font-medium">Total Submitted</p>
                  </div>
                </div>

                {/* By-role breakdown */}
                {Object.keys(bulkResult.by_role).length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-brand-navy mb-3">Created by Role</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(bulkResult.by_role).map(([role, count]) => (
                        <div key={role} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${ROLE_COLORS[role] || 'bg-gray-200 text-gray-700'}`}>
                          <MdCheckCircle size={14} />
                          {count} {role.replace('_', ' ')}{count > 1 ? 's' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created list */}
                {bulkResult.created.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                      <MdCheckCircle size={16} /> Successfully Created
                    </p>
                    <div className="rounded-xl border border-green-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-green-700 font-medium">Name</th>
                            <th className="text-left px-3 py-2 text-green-700 font-medium">Phone</th>
                            <th className="text-left px-3 py-2 text-green-700 font-medium">Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-50">
                          {bulkResult.created.map((u) => (
                            <tr key={u.id}>
                              <td className="px-3 py-2 font-medium">{u.full_name}</td>
                              <td className="px-3 py-2 text-gray-500">{u.phone}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[u.role]}`}>
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Failed list */}
                {bulkResult.failed.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                      <MdError size={16} /> Failed Rows
                    </p>
                    <div className="rounded-xl border border-red-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-red-700 font-medium">Row</th>
                            <th className="text-left px-3 py-2 text-red-700 font-medium">Name</th>
                            <th className="text-left px-3 py-2 text-red-700 font-medium">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-50">
                          {bulkResult.failed.map((f) => (
                            <tr key={f.index}>
                              <td className="px-3 py-2 text-gray-400">#{f.index + 1}</td>
                              <td className="px-3 py-2 font-medium">{f.full_name}</td>
                              <td className="px-3 py-2 text-red-500">{f.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setBulkResult(null); setRows([emptyRow()]); }}
                    className="btn-outline"
                  >
                    Add More
                  </button>
                  <button onClick={closeBulk} className="btn-primary">Done</button>
                </div>
              </div>
            ) : (
              /* Entry grid */
              <div className="p-6 space-y-4">
                {/* Tally bar */}
                {filledCount > 0 && (
                  <div className="flex flex-wrap gap-2 items-center bg-brand-navy/5 rounded-xl px-4 py-3">
                    <span className="text-xs font-semibold text-brand-navy mr-2">
                      {filledCount} user{filledCount > 1 ? 's' : ''} ready:
                    </span>
                    {Object.entries(tally).map(([role, count]) => (
                      <span key={role} className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${ROLE_COLORS[role]}`}>
                        {count} {role.replace('_', ' ')}{count > 1 ? 's' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Scrollable table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-brand-navy text-white">
                        <th className="text-left px-3 py-2.5 font-medium rounded-tl-lg w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-medium">Full Name *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Phone *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Email</th>
                        <th className="text-left px-3 py-2.5 font-medium">Password *</th>
                        <th className="text-left px-3 py-2.5 font-medium">Role *</th>
                        <th className="px-3 py-2.5 rounded-tr-lg w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => (
                        <tr key={row._id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={row.full_name}
                              onChange={(e) => updateRow(row._id, 'full_name', e.target.value)}
                              placeholder="Jane Mwangi"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="tel"
                              value={row.phone}
                              onChange={(e) => updateRow(row._id, 'phone', e.target.value)}
                              placeholder="+254700000000"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="email"
                              value={row.email}
                              onChange={(e) => updateRow(row._id, 'email', e.target.value)}
                              placeholder="optional"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="password"
                              value={row.password}
                              onChange={(e) => updateRow(row._id, 'password', e.target.value)}
                              placeholder="Min 8 chars"
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.role}
                              onChange={(e) => updateRow(row._id, 'role', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white capitalize"
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeRow(row._id)}
                              disabled={rows.length === 1}
                              className="p-1 rounded hover:bg-red-50 text-red-400 disabled:opacity-20 transition-colors"
                            >
                              <MdDelete size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={addRow}
                  className="flex items-center gap-2 text-sm text-brand-navy hover:text-brand-gold font-medium transition-colors"
                >
                  <MdAdd size={18} /> Add Another Row
                </button>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button onClick={closeBulk} className="btn-outline">Cancel</button>
                  <button
                    onClick={submitBulk}
                    disabled={bulkMutation.isPending || filledCount === 0}
                    className="btn-primary flex items-center gap-2"
                  >
                    {bulkMutation.isPending
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                      : <><MdGroupAdd size={18} /> Create {filledCount > 0 ? `${filledCount} ` : ''}User{filledCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
