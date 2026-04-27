import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MdPersonAdd } from 'react-icons/md';

export default function AdminUsers() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', role: 'agent' });
  const [errors, setErrors] = useState({});

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
      setShowModal(false);
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

  function validate() {
    const e = {};
    if (!form.full_name) e.full_name = 'Required';
    if (!form.phone) e.phone = 'Required';
    if (form.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <Layout title="User Management">
      <div className="max-w-5xl space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
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
                      <span className="bg-brand-navy text-white text-xs px-2 py-0.5 rounded-full capitalize">
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
                          onClick={() => {
                            if (confirm(`Deactivate ${u.full_name}?`)) deactivateMutation.mutate(u.id);
                          }}
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

      {/* Create user modal */}
      {showModal && (
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
                  <option value="agent">Agent</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
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
    </Layout>
  );
}
