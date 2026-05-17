import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MdAdd, MdDelete } from 'react-icons/md';
import OtpModal from '../../components/OtpModal';
import { useAuth } from '../../context/AuthContext';

const schema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  id_passport_no: z.string().min(1, 'ID/Passport required'),
  kra_pin: z.string().optional(),
  dob: z.string().min(1, 'Date of birth required'),
  gender: z.enum(['male', 'female'], { required_error: 'Gender required' }),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  physical_address: z.string().optional(),
  cover_option: z.coerce.number().min(1).max(6),
  medical_declaration: z.boolean().optional(),
  notes: z.string().optional(),
});

const coverOptions = [
  { value: 1, label: 'Option 1 — KES 1,500/yr — Cover KES 50,000' },
  { value: 2, label: 'Option 2 — KES 3,000/yr — Cover KES 100,000' },
  { value: 3, label: 'Option 3 — KES 6,000/yr — Cover KES 200,000' },
  { value: 4, label: 'Option 4 — KES 9,000/yr — Cover KES 300,000' },
  { value: 5, label: 'Option 5 — KES 12,000/yr — Cover KES 400,000' },
  { value: 6, label: 'Option 6 — KES 15,000/yr — Cover KES 500,000' },
];

export default function AdminEditMember() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState(null);
  const [otpError, setOtpError] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}`);
      return data.data;
    },
  });

  const { data: dependents } = useQuery({
    queryKey: ['dependents', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/dependents`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ['beneficiaries', id],
    queryFn: async () => {
      const { data } = await api.get(`/members/${id}/beneficiaries`);
      return data.data;
    },
    enabled: !!id,
  });

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { cover_option: 1 },
  });

  useEffect(() => {
    if (member) {
      reset({
        full_name: member.full_name || '',
        id_passport_no: member.id_passport_no || '',
        kra_pin: member.kra_pin || '',
        dob: member.dob ? member.dob.split('T')[0] : '',
        gender: member.gender || 'male',
        phone: member.phone || '',
        email: member.email || '',
        physical_address: member.physical_address || '',
        cover_option: member.cover_option || 1,
        medical_declaration: member.medical_declaration || false,
        notes: member.notes || '',
      });
    }
  }, [member, reset]);

  const updateMutation = useMutation({
    mutationFn: (values) => api.put(`/members/${id}`, values),
    onSuccess: () => {
      toast.success('Member updated successfully');
      qc.invalidateQueries(['member', id]);
      setShowOtpModal(false);
      navigate(`/admin/members/${id}`);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'Update failed';
      // Surface OTP errors inside the modal
      if (showOtpModal) setOtpError(msg);
      else toast.error(msg);
    },
  });

  async function handleSave(formValues) {
    if (user?.role === 'super_admin') {
      setPendingFormValues(formValues);
      setOtpError(null);
      try {
        await api.post('/auth/otp/request-action', {
          purpose: 'edit_member',
          context_ref: { member_id: id },
        });
        toast.success('Verification code sent to your email!');
        setShowOtpModal(true);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to send verification code');
      }
    } else {
      updateMutation.mutate(formValues);
    }
  }

  async function handleOtpSubmit(code) {
    setOtpLoading(true);
    setOtpError(null);
    updateMutation.mutate({ ...pendingFormValues, otp_code: code });
    setOtpLoading(false);
  }

  const addDepMutation = useMutation({
    mutationFn: (dep) => api.post(`/members/${id}/dependents`, dep),
    onSuccess: () => {
      toast.success('Dependent added');
      qc.invalidateQueries(['dependents', id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add dependent'),
  });

  const removeDepMutation = useMutation({
    mutationFn: (depId) => api.delete(`/members/${id}/dependents/${depId}`),
    onSuccess: () => {
      toast.success('Dependent removed');
      qc.invalidateQueries(['dependents', id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove dependent'),
  });

  const addBenMutation = useMutation({
    mutationFn: (ben) => api.post(`/members/${id}/beneficiaries`, ben),
    onSuccess: () => {
      toast.success('Beneficiary added');
      qc.invalidateQueries(['beneficiaries', id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add beneficiary'),
  });

  const removeBenMutation = useMutation({
    mutationFn: (benId) => api.delete(`/members/${id}/beneficiaries/${benId}`),
    onSuccess: () => {
      toast.success('Beneficiary removed');
      qc.invalidateQueries(['beneficiaries', id]);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove beneficiary'),
  });

  const {
    register: registerDep,
    handleSubmit: handleDepSubmit,
    reset: resetDep,
    formState: { errors: depErrors },
  } = useForm();

  const {
    register: registerBen,
    handleSubmit: handleBenSubmit,
    reset: resetBen,
    formState: { errors: benErrors },
  } = useForm();

  if (isLoading) {
    return (
      <Layout title="Edit Member">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!member) {
    return <Layout title="Edit Member"><p className="text-gray-500">Member not found.</p></Layout>;
  }

  return (
    <Layout title="Edit Member">
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-brand-navy">
            Editing: {member.full_name}
          </h2>
          <button
            type="button"
            onClick={() => navigate(`/admin/members/${id}`)}
            className="btn-outline text-sm"
          >
            Cancel
          </button>
        </div>

        {/* Personal information form */}
        <form onSubmit={handleSubmit(handleSave)}>
          <div className="card space-y-4">
            <h3 className="font-heading font-bold text-brand-navy text-lg">Personal Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input {...register('full_name')} className="input" />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="label">ID / Passport No. *</label>
                <input {...register('id_passport_no')} className="input" />
                {errors.id_passport_no && <p className="text-red-500 text-xs mt-1">{errors.id_passport_no.message}</p>}
              </div>
              <div>
                <label className="label">KRA PIN</label>
                <input {...register('kra_pin')} className="input" placeholder="A012345678B" />
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input {...register('dob')} type="date" className="input" />
                {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob.message}</p>}
              </div>
              <div>
                <label className="label">Gender *</label>
                <select {...register('gender')} className="input">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
              </div>
              <div>
                <label className="label">Phone *</label>
                <input {...register('phone')} type="tel" className="input" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input {...register('email')} type="email" className="input" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label">Physical Address</label>
                <input {...register('physical_address')} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Cover Option *</label>
              <select {...register('cover_option')} className="input">
                {coverOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-3">
              <input type="checkbox" {...register('medical_declaration')} id="medical" className="mt-1" />
              <label htmlFor="medical" className="text-sm text-gray-600">
                Member declares they have disclosed all pre-existing medical conditions and the information provided is accurate.
              </label>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea {...register('notes')} className="input" rows={2} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Dependents */}
        <div className="card space-y-4">
          <h3 className="font-heading font-bold text-brand-navy text-lg">
            Dependents ({dependents?.length || 0})
          </h3>

          {dependents?.length > 0 && (
            <div className="space-y-2">
              {dependents.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-navy">{dep.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{dep.relationship}{dep.dob ? ` · DOB: ${dep.dob.split('T')[0]}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDepMutation.mutate(dep.id)}
                    disabled={removeDepMutation.isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    <MdDelete size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={handleDepSubmit((v) => {
              addDepMutation.mutate(v, { onSuccess: () => resetDep() });
            })}
            className="bg-gray-50 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-gray-700">Add Dependent</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input {...registerDep('full_name', { required: 'Name required' })} className="input" />
                {depErrors.full_name && <p className="text-red-500 text-xs mt-1">{depErrors.full_name.message}</p>}
              </div>
              <div>
                <label className="label">Relationship *</label>
                <select {...registerDep('relationship', { required: 'Relationship required' })} className="input">
                  <option value="">Select</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="parent-in-law">Parent-in-law</option>
                  <option value="sibling">Sibling</option>
                </select>
                {depErrors.relationship && <p className="text-red-500 text-xs mt-1">{depErrors.relationship.message}</p>}
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input {...registerDep('dob')} type="date" className="input" />
              </div>
              <div>
                <label className="label">ID / Birth Certificate No.</label>
                <input {...registerDep('id_or_birth_cert_no')} className="input" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={addDepMutation.isPending} className="btn-outline text-sm flex items-center gap-1">
                <MdAdd size={16} /> {addDepMutation.isPending ? 'Adding…' : 'Add Dependent'}
              </button>
            </div>
          </form>
        </div>

        {/* Beneficiaries */}
        <div className="card space-y-4">
          <h3 className="font-heading font-bold text-brand-navy text-lg">
            Beneficiaries ({beneficiaries?.length || 0})
          </h3>

          {beneficiaries?.length > 0 && (
            <div className="space-y-2">
              {beneficiaries.map((ben) => (
                <div key={ben.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-navy">{ben.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{ben.relationship}{ben.phone ? ` · ${ben.phone}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBenMutation.mutate(ben.id)}
                    disabled={removeBenMutation.isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    <MdDelete size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={handleBenSubmit((v) => {
              addBenMutation.mutate(v, { onSuccess: () => resetBen() });
            })}
            className="bg-gray-50 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-gray-700">Add Beneficiary</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input {...registerBen('full_name', { required: 'Name required' })} className="input" />
                {benErrors.full_name && <p className="text-red-500 text-xs mt-1">{benErrors.full_name.message}</p>}
              </div>
              <div>
                <label className="label">Relationship *</label>
                <input {...registerBen('relationship', { required: 'Relationship required' })} className="input" placeholder="e.g. Spouse" />
                {benErrors.relationship && <p className="text-red-500 text-xs mt-1">{benErrors.relationship.message}</p>}
              </div>
              <div>
                <label className="label">Phone</label>
                <input {...registerBen('phone')} type="tel" className="input" />
              </div>
              <div>
                <label className="label">ID / Passport No.</label>
                <input {...registerBen('id_passport_no')} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input {...registerBen('address')} className="input" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={addBenMutation.isPending} className="btn-outline text-sm flex items-center gap-1">
                <MdAdd size={16} /> {addBenMutation.isPending ? 'Adding…' : 'Add Beneficiary'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* OTP confirmation modal — super_admin only */}
      <OtpModal
        isOpen={showOtpModal}
        title="Confirm Member Edit"
        description="Enter the 6-digit verification code sent to your email to save these changes."
        onSubmit={handleOtpSubmit}
        onClose={() => setShowOtpModal(false)}
        onResend={async () => {
          try {
            await api.post('/auth/otp/request-action', {
              purpose: 'edit_member',
              context_ref: { member_id: id },
            });
            toast.success('New verification code sent!');
          } catch {
            toast.error('Failed to resend code');
          }
        }}
        isLoading={otpLoading || updateMutation.isPending}
        error={otpError}
      />
    </Layout>
  );
}
