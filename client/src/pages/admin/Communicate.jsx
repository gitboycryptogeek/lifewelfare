import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MdSend } from 'react-icons/md';

export default function AdminCommunicate() {
  const [channel, setChannel] = useState('sms');
  const [recipientType, setRecipientType] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const { data: history } = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const { data } = await api.get('/communications');
      return data.data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post('/communications/send', {
      channel,
      recipient_type: recipientType,
      subject: subject || undefined,
      message,
    }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setMessage('');
      setSubject('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Send failed'),
  });

  return (
    <Layout title="Communications">
      <div className="max-w-4xl space-y-6">
        {/* Compose */}
        <div className="card space-y-4">
          <h3 className="font-heading font-bold text-brand-navy text-lg">Send Message</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input">
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">SMS + Email</option>
              </select>
            </div>
            <div>
              <label className="label">Send To</label>
              <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="input">
                <option value="all">All Active Members</option>
                <option value="agent">All Agents</option>
                <option value="prospects">Prospects (email only)</option>
              </select>
            </div>
          </div>

          {(channel === 'email' || channel === 'both') && (
            <div>
              <label className="label">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Email subject line"
              />
            </div>
          )}

          <div>
            <label className="label">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input"
              rows={5}
              placeholder="Type your message here..."
            />
            {channel === 'sms' && (
              <p className="text-xs text-gray-400 mt-1">{message.length}/160 characters</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!message || sendMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <MdSend size={16} />
              {sendMutation.isPending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h3 className="font-heading font-bold text-brand-navy mb-4">Communication History</h3>
          {!history?.length ? (
            <p className="text-gray-500 text-sm">No messages sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Date', 'Channel', 'To', 'Message', 'Sent', 'Failed', 'By'].map((h) => (
                      <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                        {format(new Date(c.created_at), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="py-2.5 pr-4 uppercase text-xs font-semibold">{c.channel}</td>
                      <td className="py-2.5 pr-4 capitalize">{c.recipient_type}</td>
                      <td className="py-2.5 pr-4 max-w-xs truncate text-gray-600">{c.message}</td>
                      <td className="py-2.5 pr-4 text-green-600 font-semibold">{c.sent_count}</td>
                      <td className="py-2.5 pr-4 text-red-500">{c.failed_count}</td>
                      <td className="py-2.5 text-gray-500">{c.sent_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
