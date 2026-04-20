import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MdAdd, MdDelete } from 'react-icons/md';

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
  dependents: z.array(z.object({
    full_name: z.string().min(1, 'Name required'),
    relationship: z.string().min(1, 'Relationship required'),
    dob: z.string().optional(),
    id_or_birth_cert_no: z.string().optional(),
  })).optional(),
  beneficiaries: z.array(z.object({
    full_name: z.string().min(1, 'Name required'),
    relationship: z.string().min(1, 'Relationship required'),
    phone: z.string().optional(),
    id_passport_no: z.string().optional(),
    address: z.string().optional(),
  })).optional(),
});

export default function AgentRegister() {
  const [step, setStep] = useState(1);

  const { register, handleSubmit, control, formState: { errors }, getValues, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      dependents: [],
      beneficiaries: [],
      cover_option: 1,
    },
  });

  const { fields: depFields, append: appendDep, remove: removeDep } = useFieldArray({ control, name: 'dependents' });
  const { fields: benFields, append: appendBen, remove: removeBen } = useFieldArray({ control, name: 'beneficiaries' });

  const mutation = useMutation({
    mutationFn: async (values) => {
      // Register member
      const { data } = await api.post('/members/register', values);
      const memberId = data.data.id;

      // Add dependents
      for (const dep of values.dependents || []) {
        await api.post(`/members/${memberId}/dependents`, dep);
      }
      // Add beneficiaries
      for (const ben of values.beneficiaries || []) {
        await api.post(`/members/${memberId}/beneficiaries`, ben);
      }
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.full_name} registered successfully!`);
      reset();
      setStep(1);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Registration failed');
    },
  });

  const coverOptions = [
    { value: 1, label: 'Option 1 — KES 1,500/yr — Individual basic' },
    { value: 2, label: 'Option 2 — KES 2,500/yr — Individual + spouse' },
    { value: 3, label: 'Option 3 — KES 3,500/yr — Family (2+2)' },
    { value: 4, label: 'Option 4 — KES 6,000/yr — Family (2+4)' },
    { value: 5, label: 'Option 5 — KES 10,000/yr — Extended + parents' },
    { value: 6, label: 'Option 6 — KES 15,000/yr — Full extended' },
  ];

  return (
    <Layout title="Register New Member">
      <div className="max-w-3xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? 'bg-brand-gold text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s}</div>
              {s < 3 && <div className={`h-0.5 w-12 ${step > s ? 'bg-brand-gold' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <div className="ml-3 text-sm text-gray-500">
            {step === 1 ? 'Member Details' : step === 2 ? 'Dependents' : 'Beneficiaries'}
          </div>
        </div>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
          {/* Step 1: Member details */}
          {step === 1 && (
            <div className="card space-y-4">
              <h3 className="font-heading font-bold text-brand-navy text-lg">Member Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input {...register('full_name')} className="input" placeholder="e.g. John Kamau Mwangi" />
                  {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label className="label">ID / Passport No. *</label>
                  <input {...register('id_passport_no')} className="input" placeholder="12345678" />
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
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input {...register('phone')} type="tel" className="input" placeholder="+254700000000" />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="label">Email</label>
                  <input {...register('email')} type="email" className="input" placeholder="member@email.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="label">Physical Address</label>
                  <input {...register('physical_address')} className="input" placeholder="Estate, Town" />
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
                <textarea {...register('notes')} className="input" rows={2} placeholder="Any additional notes..." />
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setStep(2)} className="btn-primary">
                  Next: Dependents
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Dependents */}
          {step === 2 && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-brand-navy text-lg">Dependents</h3>
                <button
                  type="button"
                  onClick={() => appendDep({ full_name: '', relationship: '', dob: '', id_or_birth_cert_no: '' })}
                  className="btn-outline text-sm py-1.5 px-4 flex items-center gap-1"
                >
                  <MdAdd size={16} /> Add Dependent
                </button>
              </div>

              {depFields.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No dependents added. Click "Add Dependent" to add family members.</p>
              )}

              {depFields.map((field, i) => (
                <div key={field.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Dependent {i + 1}</span>
                    <button type="button" onClick={() => removeDep(i)} className="text-red-500 hover:text-red-700">
                      <MdDelete size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full Name *</label>
                      <input {...register(`dependents.${i}.full_name`)} className="input" />
                    </div>
                    <div>
                      <label className="label">Relationship *</label>
                      <select {...register(`dependents.${i}.relationship`)} className="input">
                        <option value="">Select</option>
                        <option value="spouse">Spouse</option>
                        <option value="child">Child</option>
                        <option value="parent">Parent</option>
                        <option value="parent-in-law">Parent-in-law</option>
                        <option value="sibling">Sibling</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Date of Birth</label>
                      <input {...register(`dependents.${i}.dob`)} type="date" className="input" />
                    </div>
                    <div>
                      <label className="label">ID / Birth Certificate No.</label>
                      <input {...register(`dependents.${i}.id_or_birth_cert_no`)} className="input" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="btn-outline">Back</button>
                <button type="button" onClick={() => setStep(3)} className="btn-primary">Next: Beneficiaries</button>
              </div>
            </div>
          )}

          {/* Step 3: Beneficiaries */}
          {step === 3 && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-brand-navy text-lg">Beneficiaries</h3>
                <button
                  type="button"
                  onClick={() => appendBen({ full_name: '', relationship: '', phone: '', id_passport_no: '', address: '' })}
                  className="btn-outline text-sm py-1.5 px-4 flex items-center gap-1"
                >
                  <MdAdd size={16} /> Add Beneficiary
                </button>
              </div>

              {benFields.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No beneficiaries added. At least one beneficiary is recommended.</p>
              )}

              {benFields.map((field, i) => (
                <div key={field.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Beneficiary {i + 1}</span>
                    <button type="button" onClick={() => removeBen(i)} className="text-red-500 hover:text-red-700">
                      <MdDelete size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full Name *</label>
                      <input {...register(`beneficiaries.${i}.full_name`)} className="input" />
                    </div>
                    <div>
                      <label className="label">Relationship *</label>
                      <input {...register(`beneficiaries.${i}.relationship`)} className="input" placeholder="e.g. Spouse" />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input {...register(`beneficiaries.${i}.phone`)} type="tel" className="input" />
                    </div>
                    <div>
                      <label className="label">ID / Passport No.</label>
                      <input {...register(`beneficiaries.${i}.id_passport_no`)} className="input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Address</label>
                      <input {...register(`beneficiaries.${i}.address`)} className="input" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="btn-outline">Back</button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary"
                >
                  {mutation.isPending ? 'Submitting…' : 'Submit Registration'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}
