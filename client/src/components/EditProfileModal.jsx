import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MdClose } from 'react-icons/md';

// Self-service "edit my details" modal — lets the logged-in user update
// their own name, phone and email (agents, team leaders, admins, etc.).
export default function EditProfileModal({ onClose }) {
  const { user, refetch } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  const mutation = useMutation({
    mutationFn: () => api.patch('/auth/me', form),
    onSuccess: async () => {
      toast.success('Details updated');
      await refetch();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update details'),
  });

  function save() {
    if (!form.full_name.trim()) return toast.error('Full name is required');
    if (!form.phone.trim()) return toast.error('Phone is required');
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-brand-navy text-lg">Edit My Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <MdClose size={20} />
          </button>
        </div>
        <div className="space-y-4">
          {[
            { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'e.g. Jane Mwangi' },
            { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+254700000000' },
            { key: 'email', label: 'Email (optional)', type: 'email', placeholder: 'jane@example.com' },
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
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
            <button onClick={save} disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
