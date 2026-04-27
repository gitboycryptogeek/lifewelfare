import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MdLock, MdClose, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });

  const mutation = useMutation({
    mutationFn: (values) => api.post('/auth/change-password', values),
    onSuccess: () => {
      toast.success('Password changed successfully');
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to change password');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    mutation.mutate({ old_password: form.old_password, new_password: form.new_password });
  }

  function field(key, label, showKey) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="relative">
          <input
            type={show[showKey] ? 'text' : 'password'}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            className="input pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show[showKey] ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <MdLock size={20} className="text-brand-gold" />
            <h2 className="font-heading font-bold text-brand-navy text-lg">Change Password</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <MdClose size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('old_password', 'Current Password', 'old')}
          {field('new_password', 'New Password', 'new')}
          {field('confirm_password', 'Confirm New Password', 'confirm')}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-outline py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 btn-primary py-2"
            >
              {mutation.isPending ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
