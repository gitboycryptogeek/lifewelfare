import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';

const schema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

const roleRedirects = {
  member: '/member/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
  super_admin: '/admin/dashboard',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values) {
    try {
      const user = await login(values.phone, values.password);
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`);
      navigate(roleRedirects[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
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
            <div className="text-center mb-8">
              <h1 className="font-heading text-2xl font-bold text-brand-navy">Sign In</h1>
              <p className="text-gray-500 text-sm mt-2">Access your member, agent, or admin portal</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Phone Number</label>
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="+254XXXXXXXXX"
                  className="input"
                  autoComplete="username"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
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
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full text-center"
              >
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="text-center mt-6 text-sm text-gray-500">
            Need help?{' '}
            <a href="tel:+254118043715" className="text-brand-gold hover:underline">
              Call +254-118-043-715
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
