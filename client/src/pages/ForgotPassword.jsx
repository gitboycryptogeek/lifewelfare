import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MdCheckCircle } from 'react-icons/md';

export default function ForgotPassword() {
  const [step, setStep] = useState('identify'); // 'identify' | 'otp' | 'success'
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/otp/request-forgot-password', { identifier: identifier.trim() });
      toast.success('OTP sent! Check your email.');
      setStep('otp');
      setResendCooldown(60);
      startCooldown();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startCooldown() {
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    setLoading(true);
    try {
      await api.post('/auth/otp/request-forgot-password', { identifier: identifier.trim() });
      toast.success('OTP resent!');
      setResendCooldown(60);
      startCooldown();
    } catch {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/otp/reset-password', {
        identifier: identifier.trim(),
        code,
        new_password: newPassword,
      });
      setStep('success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password. Check your code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-brand-navy py-4 px-6">
        <Link to="/" className="font-heading font-bold text-brand-gold text-lg">
          My Life Companion Welfare
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card">

            {/* ── Step 1: Enter email or phone ─────────────────── */}
            {step === 'identify' && (
              <>
                <div className="text-center mb-8">
                  <h1 className="font-heading text-2xl font-bold text-brand-navy">Reset Password</h1>
                  <p className="text-gray-500 text-sm mt-2">
                    Enter your email or phone number and we'll send you a verification code.
                  </p>
                </div>
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div>
                    <label className="label">Email or Phone Number</label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="email@example.com or +254XXXXXXXXX"
                      className="input"
                      autoComplete="username"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full text-center">
                    {loading ? 'Sending…' : 'Send OTP'}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    <Link to="/login" className="text-brand-gold hover:underline">Back to Login</Link>
                  </p>
                </form>
              </>
            )}

            {/* ── Step 2: Enter OTP + new password ─────────────── */}
            {step === 'otp' && (
              <>
                <div className="text-center mb-6">
                  <h1 className="font-heading text-2xl font-bold text-brand-navy">Enter Your Code</h1>
                  <p className="text-gray-500 text-sm mt-2">
                    A 6-digit code was sent to your registered email. Enter it below along with your new password.
                  </p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="label">Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="input text-center text-xl tracking-widest font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="input"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      className="input"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="btn-primary w-full text-center"
                  >
                    {loading ? 'Resetting…' : 'Reset Password'}
                  </button>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <button type="button" onClick={() => setStep('identify')} className="hover:underline">
                      ← Back
                    </button>
                    {resendCooldown > 0 ? (
                      <span className="text-gray-400">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="text-brand-gold hover:underline font-medium"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}

            {/* ── Step 3: Success ───────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center py-8">
                <MdCheckCircle size={56} className="text-green-500 mx-auto mb-4" />
                <h1 className="font-heading text-2xl font-bold text-brand-navy mb-2">
                  Password Reset!
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                  Your password has been updated successfully. You can now sign in with your new password.
                </p>
                <Link to="/login" className="btn-primary inline-block">
                  Back to Login
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
