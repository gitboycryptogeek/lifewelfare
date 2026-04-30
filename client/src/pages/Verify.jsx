import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { MdCheckCircle, MdCancel, MdShield } from 'react-icons/md';

const COVER_LABELS = {
  1: 'Option 1 — KES 1,500 / yr',
  2: 'Option 2 — KES 3,000 / yr',
  3: 'Option 3 — KES 5,000 / yr',
  4: 'Option 4 — KES 8,000 / yr',
  5: 'Option 5 — KES 12,000 / yr',
  6: 'Option 6 — KES 15,000 / yr',
};

export default function Verify() {
  const { membershipNumber } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify', membershipNumber],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/members/verify/${membershipNumber}`);
      return res.data.data;
    },
    retry: false,
  });

  const isActive = data?.status === 'active';

  return (
    <div className="min-h-screen bg-brand-navy flex flex-col">
      {/* Header */}
      <header className="bg-brand-navy border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-gold rounded-full flex items-center justify-center">
          <MdShield className="text-brand-navy" size={18} />
        </div>
        <div>
          <p className="text-brand-gold font-heading font-bold text-sm leading-none">MY LIFE COMPANION</p>
          <p className="text-white/60 text-xs tracking-widest">WELFARE</p>
        </div>
        <span className="ml-auto text-white/40 text-xs">Membership Verification</span>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {isLoading && (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-4 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60 text-sm">Verifying membership…</p>
            </div>
          )}

          {isError && (
            <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MdCancel className="text-red-500" size={44} />
              </div>
              <h2 className="text-xl font-heading font-bold text-gray-800 mb-2">Not Found</h2>
              <p className="text-gray-500 text-sm mb-1">
                Membership number <span className="font-mono font-bold text-gray-700">{membershipNumber}</span> was not found.
              </p>
              <p className="text-gray-400 text-xs mt-4">
                If you believe this is an error, contact us at +254-118-043-715
              </p>
            </div>
          )}

          {data && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Status banner */}
              <div className={`px-6 py-4 flex items-center gap-3 ${isActive ? 'bg-green-500' : 'bg-orange-400'}`}>
                {isActive
                  ? <MdCheckCircle className="text-white shrink-0" size={28} />
                  : <MdCancel className="text-white shrink-0" size={28} />}
                <div>
                  <p className="text-white font-bold text-base leading-tight">
                    {isActive ? 'VERIFIED ACTIVE MEMBER' : `MEMBERSHIP ${data.status?.toUpperCase()}`}
                  </p>
                  <p className="text-white/80 text-xs">
                    {isActive ? 'This membership is valid and in good standing' : 'This membership is not currently active'}
                  </p>
                </div>
              </div>

              {/* Member details */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Member Name</p>
                  <p className="text-gray-800 font-bold text-lg">{data.full_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Membership No.</p>
                    <p className="font-mono font-bold text-brand-gold text-base">{data.membership_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Cover</p>
                    <p className="text-gray-700 text-sm font-medium">
                      {COVER_LABELS[data.cover_option] || `Option ${data.cover_option}`}
                    </p>
                  </div>
                </div>

                {data.approval_date && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Member Since</p>
                    <p className="text-gray-700 text-sm">
                      {format(new Date(data.approval_date), 'dd MMMM yyyy')}
                    </p>
                  </div>
                )}

                <div className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium ${
                  isActive ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                }`}>
                  {isActive
                    ? <MdCheckCircle size={18} />
                    : <MdCancel size={18} />}
                  {isActive
                    ? 'Covered under My Life Companion Welfare plan'
                    : 'Member is not currently covered'}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-brand-gold px-6 py-3 text-center">
                <p className="text-brand-navy text-xs font-bold">Underwritten by Old Mutual</p>
                <p className="text-brand-navy/70 text-xs">+254-118-043-715 • info@mylife-companion.com</p>
              </div>
            </div>
          )}

          <p className="text-white/30 text-xs text-center mt-6">
            &copy; {new Date().getFullYear()} My Life Companion Welfare
          </p>
        </div>
      </main>
    </div>
  );
}
