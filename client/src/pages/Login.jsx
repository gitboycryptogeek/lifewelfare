import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import OtpModal from '../components/OtpModal';

const staffSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

const memberSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required'),
});

const roleRedirects = {
  member: '/member/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
  super_admin: '/admin/dashboard',
  team_leader: '/team-leader/dashboard',
};

export default function Login() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [loginType, setLoginType] = useState('staff'); // 'staff' | 'member'
  const [step, setStep] = useState('credentials');     // 'credentials' | 'otp'
  const [showPass, setShowPass] = useState(false);

  // Staff OTP session
  const [otpSessionToken, setOtpSessionToken] = useState(null);
  // Member OTP identifier (to reuse in verify step)
  const [memberIdentifier, setMemberIdentifier] = useState('');

  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);

  const staffForm = useForm({ resolver: zodResolver(staffSchema) });
  const memberForm = useForm({ resolver: zodResolver(memberSchema) });

  function switchType(type) {
    setLoginType(type);
    setStep('credentials');
    setOtpSessionToken(null);
    setMemberIdentifier('');
    setOtpError(null);
    staffForm.reset();
    memberForm.reset();
  }

  // ── Staff: submit phone+password ──────────────────────────────────────────
  async function onStaffSubmit(values) {
    try {
      const { data } = await api.post('/auth/login', {
        phone: values.phone,
        password: values.password,
      });
      // OTP disabled — server returns JWT directly
      if (data.data?.token) {
        loginWithToken({ token: data.data.token, user: data.data.user });
        toast.success(`Welcome back, ${data.data.user.full_name.split(' ')[0]}!`);
        navigate(roleRedirects[data.data.user.role] || '/');
        return;
      }
      setOtpSessionToken(data.data.otpSessionToken);
      setStep('otp');
      toast.success('Verification code sent to your email!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
    }
  }

  // ── Member: submit email/phone to request OTP ────────────────────────────
  async function onMemberSubmit(values) {
    try {
      const { data } = await api.post('/auth/otp/request-member-login', { identifier: values.identifier });
      // OTP disabled — server returns JWT directly
      if (data.data?.token) {
        loginWithToken({ token: data.data.token, user: data.data.user });
        toast.success(`Welcome back, ${data.data.user.full_name.split(' ')[0]}!`);
        navigate(roleRedirects[data.data.user.role] || '/');
        return;
      }
      setMemberIdentifier(values.identifier);
      setStep('otp');
      toast.success('Verification code sent to your email!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not find your account. Please try again.');
    }
  }

  // ── Verify OTP (both staff and member) ───────────────────────────────────
  async function handleOtpSubmit(code) {
    setOtpLoading(true);
    setOtpError(null);
    try {
      let data;
      if (loginType === 'staff') {
        const res = await api.post('/auth/otp/verify-login', { otpSessionToken, code });
        data = res.data;
      } else {
        const res = await api.post('/auth/otp/verify-member-login', {
          identifier: memberIdentifier,
          code,
        });
        data = res.data;
      }
      loginWithToken({ token: data.data.token, user: data.data.user });
      toast.success(`Welcome back, ${data.data.user.full_name.split(' ')[0]}!`);
      navigate(roleRedirects[data.data.user.role] || '/');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleOtpResend() {
    try {
      if (loginType === 'staff') {
        const values = staffForm.getValues();
        const { data } = await api.post('/auth/login', {
          phone: values.phone,
          password: values.password,
        });
        setOtpSessionToken(data.data.otpSessionToken);
      } else {
        await api.post('/auth/otp/request-member-login', { identifier: memberIdentifier });
      }
      toast.success('New verification code sent!');
    } catch {
      toast.error('Failed to resend OTP');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-brand-navy py-4 px-6">
        <Link to="/" className="font-heading font-bold text-brand-gold text-lg">
          My Life Companion Welfare
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card">
            <div className="text-center mb-6">
              <h1 className="font-heading text-2xl font-bold text-brand-navy">Sign In</h1>
              <p className="text-gray-500 text-sm mt-1">Access your portal</p>
            </div>

            {/* Tab toggle */}
            {step === 'credentials' && (
              <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
                <button
                  type="button"
                  onClick={() => switchType('staff')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    loginType === 'staff'
                      ? 'bg-brand-navy text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Staff / Admin
                </button>
                <button
                  type="button"
                  onClick={() => switchType('member')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    loginType === 'member'
                      ? 'bg-brand-navy text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Member
                </button>
              </div>
            )}

            {/* ── Staff credentials form ───────────────────────── */}
            {loginType === 'staff' && step === 'credentials' && (
              <form onSubmit={staffForm.handleSubmit(onStaffSubmit)} className="space-y-5">
                <div>
                  <label className="label">Phone Number</label>
                  <input
                    {...staffForm.register('phone')}
                    type="tel"
                    placeholder="+254XXXXXXXXX"
                    className="input"
                    autoComplete="username"
                  />
                  {staffForm.formState.errors.phone && (
                    <p className="text-red-500 text-xs mt-1">
                      {staffForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Password</label>
                    <Link to="/forgot-password" className="text-xs text-brand-gold hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      {...staffForm.register('password')}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="input pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                    </button>
                  </div>
                  {staffForm.formState.errors.password && (
                    <p className="text-red-500 text-xs mt-1">
                      {staffForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={staffForm.formState.isSubmitting}
                  className="btn-primary w-full text-center"
                >
                  {staffForm.formState.isSubmitting ? 'Checking…' : 'Continue'}
                </button>
              </form>
            )}

            {/* ── Member credentials form ──────────────────────── */}
            {loginType === 'member' && step === 'credentials' && (
              <form onSubmit={memberForm.handleSubmit(onMemberSubmit)} className="space-y-5">
                <div>
                  <label className="label">Email or Phone Number</label>
                  <input
                    {...memberForm.register('identifier')}
                    type="text"
                    placeholder="email@example.com or +254XXXXXXXXX"
                    className="input"
                    autoComplete="username"
                  />
                  {memberForm.formState.errors.identifier && (
                    <p className="text-red-500 text-xs mt-1">
                      {memberForm.formState.errors.identifier.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    A verification code will be sent to your registered email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={memberForm.formState.isSubmitting}
                  className="btn-primary w-full text-center"
                >
                  {memberForm.formState.isSubmitting ? 'Sending code…' : 'Send Verification Code'}
                </button>
              </form>
            )}
          </div>

          <div className="text-center mt-6 text-sm text-gray-500">
            Need help?{' '}
            <a href="tel:+254118043715" className="text-brand-gold hover:underline">
              Call +254-118-043-715
            </a>
          </div>
        </div>
      </div>

      {/* OTP Modal — appears over the login card */}
      <OtpModal
        isOpen={step === 'otp'}
        title="Verify Your Identity"
        description={
          loginType === 'staff'
            ? 'Enter the 6-digit code sent to your registered email to complete sign-in.'
            : `Enter the 6-digit code sent to your email.`
        }
        onSubmit={handleOtpSubmit}
        onClose={() => { setStep('credentials'); setOtpError(null); }}
        onResend={handleOtpResend}
        isLoading={otpLoading}
        error={otpError}
      />
    </div>
  );
}
