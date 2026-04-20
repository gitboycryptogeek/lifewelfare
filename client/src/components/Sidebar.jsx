import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdDashboard, MdPeople, MdAssignment, MdChat, MdBarChart,
  MdSecurity, MdHistory, MdLogout, MdPersonAdd, MdPerson,
} from 'react-icons/md';
import toast from 'react-hot-toast';

const navItems = {
  member: [
    { to: '/member/dashboard', icon: MdDashboard, label: 'Dashboard' },
    { to: '/member/profile', icon: MdPerson, label: 'My Profile' },
    { to: '/member/claims', icon: MdAssignment, label: 'My Claims' },
  ],
  agent: [
    { to: '/agent/dashboard', icon: MdDashboard, label: 'Dashboard' },
    { to: '/agent/register', icon: MdPersonAdd, label: 'Register Member' },
  ],
  admin: [
    { to: '/admin/dashboard', icon: MdDashboard, label: 'Dashboard' },
    { to: '/admin/members', icon: MdPeople, label: 'Members' },
    { to: '/admin/claims', icon: MdAssignment, label: 'Claims' },
    { to: '/admin/communicate', icon: MdChat, label: 'Communications' },
    { to: '/admin/reports', icon: MdBarChart, label: 'Reports' },
  ],
  super_admin: [
    { to: '/admin/dashboard', icon: MdDashboard, label: 'Dashboard' },
    { to: '/admin/members', icon: MdPeople, label: 'Members' },
    { to: '/admin/claims', icon: MdAssignment, label: 'Claims' },
    { to: '/admin/communicate', icon: MdChat, label: 'Communications' },
    { to: '/admin/reports', icon: MdBarChart, label: 'Reports' },
    { to: '/admin/users', icon: MdSecurity, label: 'Users' },
    { to: '/admin/audit', icon: MdHistory, label: 'Audit Trail' },
  ],
};

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  async function handleLogout() {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  return (
    <aside className="flex flex-col h-full w-64 bg-brand-navy text-white">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-brand-navy-light">
        <h1 className="font-heading text-base font-bold text-brand-gold leading-tight">
          My Life Companion
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">Welfare Management</p>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-brand-navy-light">
        <p className="text-sm font-semibold truncate">{user?.full_name}</p>
        <span className="inline-block mt-1 text-xs bg-brand-gold text-brand-navy font-semibold px-2 py-0.5 rounded-full capitalize">
          {user?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-gold text-brand-navy font-semibold'
                  : 'text-gray-300 hover:bg-brand-navy-light hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t border-brand-navy-light">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
        >
          <MdLogout size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
