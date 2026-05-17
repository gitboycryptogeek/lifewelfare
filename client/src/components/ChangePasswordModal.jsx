import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MdLock, MdClose, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ onClose }) {
  const { user } = useAuth();
  const isMember = user?.role === 'member';

  const [step, setStep] = useState('request'); // 'request' | 'change'
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function requestOtp() {
    setRequestingOtp(true);
    try {
      await api.post('/auth/otp/request-action', { purpose: 'change_password' });
      toast.success('Verification code sent to your email!');
      setOtpRequested(true);
      setStep('change');
      setResendCooldown(60);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setRequestingOtp(false);
    }
  }

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
    if (!otpCode || otpCode.length < 6) {
      toast.error('Enter the 6-digit verification code');
      return;
    }
    mutation.mutate({
      old_password: isMember ? undefined : form.old_password,
      new_password: form.new_password,
      otp_code: otpCode,
    });
  }

  function passwordField(key, label, showKey, required = true) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="relative">
          <input
            type={show[showKey] ? 'text' : 'password'}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            className="input pr-10"
            required={required}
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
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <MdLock size={20} className="text-brand-gold" />
            <h2 className="font-heading font-bold text-brand-navy text-lg">Change Password</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <MdClose size={22} />
          </button>
        </div>

        {/* ── Step 1: Request OTP ─────────────────────────────── */}
        {step === 'request' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              For security, we'll send a one-time verification code to your registered email before
              allowing you to change your password.
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 btn-outline py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={requestOtp}
                disabled={requestingOtp}
                className="flex-1 btn-primary py-2"
              >
                {requestingOtp ? 'Sending…' : 'Send Verification Code'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Enter OTP + new password ───────────────── */}
        {step === 'change' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current password — hidden for members with no password */}
            {!isMember && passwordField('old_password', 'Current Password', 'old')}

            {passwordField('new_password', 'New Password', 'new')}
            {passwordField('confirm_password', 'Confirm New Password', 'confirm')}

            {/* OTP input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                {resendCooldown > 0 ? (
                  <span className="text-xs text-gray-400">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={requestingOtp}
                    className="text-xs text-brand-gold hover:underline"
                  >
                    {requestingOtp ? 'Sending…' : 'Resend OTP'}
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code from email"
                className="input text-center tracking-widest font-bold text-lg"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 btn-outline py-2">
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
        )}
      </div>
    </div>
  );
}
