# Prospect Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight "prospect" record type that agents can capture with just name/phone/email, visible to admins on a dedicated page and to team leaders under their agents, with prospects targetable as a communication recipient group.

**Architecture:** Separate `prospects` table (no changes to `members`). New Express module at `server/src/modules/prospects/`. Six frontend surfaces updated: agent Register toggle, agent Dashboard stat, admin Prospects page, admin Sidebar, admin Communicate recipient, team leader AgentDetail section.

**Tech Stack:** Node.js/Express, PostgreSQL (pg pool), React, React Query, React Hook Form + Zod, Tailwind CSS, react-hot-toast, react-icons/md.

> **Note:** No automated test suite exists in this project. Each task includes manual verification via curl or browser steps instead.

---

## File Map

**New files:**
- `server/migrations/012_create_prospects.sql` — prospects table DDL
- `server/src/modules/prospects/prospects.controller.js` — all prospect request handlers
- `server/src/modules/prospects/prospects.routes.js` — route definitions + validation
- `client/src/pages/admin/Prospects.jsx` — admin prospects list page

**Modified files:**
- `server/src/app.js` — mount `/api/v1/prospects` router
- `server/src/modules/communications/communications.controller.js` — add `prospects` recipient type (lines 18–41)
- `client/src/App.jsx` — add `/admin/prospects` route
- `client/src/components/Sidebar.jsx` — add Prospects nav link for `admin` and `super_admin`
- `client/src/pages/agent/Register.jsx` — add prospect toggle + minimal form
- `client/src/pages/agent/Dashboard.jsx` — add Prospects stat card
- `client/src/pages/admin/Communicate.jsx` — add `prospects` option to recipient selector
- `client/src/pages/team-leader/AgentDetail.jsx` — add Prospects section below Recruits table

---

## Task 1: Database migration

**Files:**
- Create: `server/migrations/012_create_prospects.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- server/migrations/012_create_prospects.sql
CREATE TABLE IF NOT EXISTS prospects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           VARCHAR(255) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  email               VARCHAR(255),
  notes               TEXT,
  status              VARCHAR(20) DEFAULT 'prospect'
                      CHECK (status IN ('prospect', 'approved')),
  registered_by_agent UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_agent  ON prospects(registered_by_agent);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
```

- [ ] **Step 2: Run the migration**

```bash
cd server && npm run migrate
```

Expected output includes:
```
Running: 012_create_prospects.sql...
  ✅ 012_create_prospects.sql completed
✅ All migrations completed successfully.
```

- [ ] **Step 3: Verify table exists**

```bash
psql $DATABASE_URL -c "\d prospects"
```

Expected: table with columns id, full_name, phone, email, notes, status, registered_by_agent, created_at, updated_at.

- [ ] **Step 4: Commit**

```bash
git add server/migrations/012_create_prospects.sql
git commit -m "feat: add prospects table migration"
```

---

## Task 2: Backend prospects module

**Files:**
- Create: `server/src/modules/prospects/prospects.controller.js`
- Create: `server/src/modules/prospects/prospects.routes.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Create the controller**

```js
// server/src/modules/prospects/prospects.controller.js
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');

async function registerProspect(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { full_name, phone, email, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO prospects (full_name, phone, email, notes, registered_by_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [full_name, phone, email || null, notes || null, req.user.id]
    );

    return res.status(201).json({ success: true, data: result.rows[0], message: 'Prospect registered successfully' });
  } catch (err) {
    next(err);
  }
}

async function listProspects(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = [limit, offset];
    let where = '';
    if (status) {
      where = 'WHERE p.status = $3';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT p.*, u.full_name AS agent_name
       FROM prospects p
       LEFT JOIN users u ON u.id = p.registered_by_agent
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM prospects ${status ? 'WHERE status = $1' : ''}`,
      status ? [status] : []
    );

    return res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getMyProspects(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT * FROM prospects
       WHERE registered_by_agent = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getAgentProspects(req, res, next) {
  try {
    const { agentId } = req.params;

    // Verify agent belongs to this team leader
    const agentCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND team_leader_id = $2 AND role = 'agent'`,
      [agentId, req.user.id]
    );
    if (agentCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Agent not found or not in your team' });
    }

    const result = await pool.query(
      `SELECT * FROM prospects
       WHERE registered_by_agent = $1
       ORDER BY created_at DESC`,
      [agentId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function approveProspect(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE prospects
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Prospect not found' });
    }

    return res.json({ success: true, data: result.rows[0], message: 'Prospect approved' });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerProspect, listProspects, getMyProspects, getAgentProspects, approveProspect };
```

- [ ] **Step 2: Create the routes file**

```js
// server/src/modules/prospects/prospects.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./prospects.controller');

const prospectValidation = [
  body('full_name').notEmpty().trim().withMessage('Full name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address'),
];

router.post(
  '/',
  verifyToken,
  requireRole('agent', 'admin', 'super_admin'),
  prospectValidation,
  ctrl.registerProspect
);

router.get(
  '/',
  verifyToken,
  requireRole('admin', 'super_admin'),
  ctrl.listProspects
);

router.get(
  '/my',
  verifyToken,
  requireRole('agent'),
  ctrl.getMyProspects
);

router.get(
  '/agent/:agentId',
  verifyToken,
  requireRole('team_leader'),
  ctrl.getAgentProspects
);

router.patch(
  '/:id/approve',
  verifyToken,
  requireRole('admin', 'super_admin'),
  ctrl.approveProspect
);

module.exports = router;
```

- [ ] **Step 3: Mount the router in app.js**

In `server/src/app.js`, after the existing require statements (around line 21), add:

```js
const prospectRoutes = require('./modules/prospects/prospects.routes');
```

After line 55 (`app.use('/api/v1/team-leader', teamLeaderRoutes);`), add:

```js
app.use('/api/v1/prospects', prospectRoutes);
```

- [ ] **Step 4: Verify the endpoints respond**

Start the dev server:
```bash
cd server && npm run dev
```

In another terminal, get a JWT token by logging in, then test:

```bash
# Replace TOKEN with a valid agent JWT
curl -s -X POST http://localhost:5000/api/v1/prospects \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Jane Test","phone":"+254700000001","email":"jane@example.com"}' | jq .
```

Expected: `{ "success": true, "data": { "id": "...", "full_name": "Jane Test", ... } }`

```bash
# Test list (admin token)
curl -s http://localhost:5000/api/v1/prospects \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq .
```

Expected: `{ "success": true, "data": [...], "meta": { "total": 1, ... } }`

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/prospects/ server/src/app.js
git commit -m "feat: add prospects API module and routes"
```

---

## Task 3: Communications backend — prospects recipient type

**Files:**
- Modify: `server/src/modules/communications/communications.controller.js`

- [ ] **Step 1: Add the `prospects` recipient type**

In `server/src/modules/communications/communications.controller.js`, after the `agent` branch (after line 27), add a new `else if` block:

```js
} else if (recipient_type === 'prospects') {
  const result = await pool.query(
    "SELECT phone, email, full_name FROM prospects WHERE email IS NOT NULL"
  );
  recipients = result.rows;
}
```

The full `if/else if` chain in `sendCommunication` (starting around line 18) now reads:

```js
if (recipient_type === 'all') {
  const result = await pool.query(
    "SELECT phone, email, full_name FROM members WHERE status = 'active'"
  );
  recipients = result.rows;
} else if (recipient_type === 'agent') {
  const result = await pool.query(
    "SELECT phone, email, full_name FROM users WHERE role = 'agent' AND is_active = true"
  );
  recipients = result.rows;
} else if (recipient_type === 'prospects') {
  const result = await pool.query(
    "SELECT phone, email, full_name FROM prospects WHERE email IS NOT NULL"
  );
  recipients = result.rows;
} else if (recipient_type === 'member' && recipient_ids?.length > 0) {
  const result = await pool.query(
    'SELECT phone, email, full_name FROM members WHERE id = ANY($1)',
    [recipient_ids]
  );
  recipients = result.rows;
} else if (recipient_type === 'group' && recipient_ids?.length > 0) {
  const result = await pool.query(
    'SELECT phone, email, full_name FROM members WHERE id = ANY($1)',
    [recipient_ids]
  );
  recipients = result.rows;
}
```

- [ ] **Step 2: Verify manually**

With at least one prospect with an email in the DB, send a test communication using an admin token:

```bash
curl -s -X POST http://localhost:5000/api/v1/communications/send \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"email","recipient_type":"prospects","subject":"Test","message":"Hello prospect"}' | jq .
```

Expected: `{ "success": true, "message": "Communication sent to 1 recipients (0 failed)" }`

- [ ] **Step 3: Commit**

```bash
git add server/src/modules/communications/communications.controller.js
git commit -m "feat: add prospects recipient type to communications"
```

---

## Task 4: Agent Register page — prospect toggle

**Files:**
- Modify: `client/src/pages/agent/Register.jsx`

- [ ] **Step 1: Add prospect mode state and form**

At the top of `Register.jsx`, after the existing imports, add the `MdPerson` icon import. The existing import line is:

```js
import { MdAdd, MdDelete, MdUploadFile, MdInsertDriveFile } from 'react-icons/md';
```

Replace it with:

```js
import { MdAdd, MdDelete, MdUploadFile, MdInsertDriveFile, MdPerson, MdPeople } from 'react-icons/md';
```

- [ ] **Step 2: Add mode state and prospect schema**

After `const [docFiles, setDocFiles] = useState([]);` (line 41), add:

```js
const [mode, setMode] = useState('member'); // 'member' | 'prospect'
```

After the existing `schema` definition (after line 36), add the prospect schema:

```js
const prospectSchema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
});
```

- [ ] **Step 3: Add prospect form and mutation**

After the existing `mutation` definition (after line 79), add:

```js
const { register: registerProspect, handleSubmit: handleProspectSubmit, formState: { errors: prospectErrors }, reset: resetProspect } = useForm({
  resolver: zodResolver(prospectSchema),
});

const prospectMutation = useMutation({
  mutationFn: async (values) => {
    const { data } = await api.post('/prospects', values);
    return data.data;
  },
  onSuccess: (data) => {
    toast.success(`${data.full_name} added as a prospect!`);
    resetProspect();
  },
  onError: (err) => {
    toast.error(err.response?.data?.error || 'Failed to add prospect');
  },
});
```

- [ ] **Step 4: Add the toggle UI and prospect form**

Replace the opening of the return statement's outer `<div>` (the `<div className="max-w-3xl">` block, currently at line 123) with the full updated return:

```jsx
return (
  <Layout title="Register New Member">
    <div className="max-w-3xl">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode('member')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'member' ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <MdPeople size={16} /> Register Member
        </button>
        <button
          type="button"
          onClick={() => setMode('prospect')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'prospect' ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <MdPerson size={16} /> Register Prospect
        </button>
      </div>

      {/* Prospect form */}
      {mode === 'prospect' && (
        <form onSubmit={handleProspectSubmit((v) => prospectMutation.mutate(v))}>
          <div className="card space-y-4">
            <div>
              <h3 className="font-heading font-bold text-brand-navy text-lg">Prospect Details</h3>
              <p className="text-sm text-gray-500 mt-1">Capture a lead with basic contact info. Admin will review and approve before full registration.</p>
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input {...registerProspect('full_name')} className="input" placeholder="e.g. Jane Wanjiku" />
              {prospectErrors.full_name && <p className="text-red-500 text-xs mt-1">{prospectErrors.full_name.message}</p>}
            </div>
            <div>
              <label className="label">Phone *</label>
              <input {...registerProspect('phone')} type="tel" className="input" placeholder="+254700000000" />
              {prospectErrors.phone && <p className="text-red-500 text-xs mt-1">{prospectErrors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input {...registerProspect('email')} type="email" className="input" placeholder="prospect@email.com" />
              {prospectErrors.email && <p className="text-red-500 text-xs mt-1">{prospectErrors.email.message}</p>}
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea {...registerProspect('notes')} className="input" rows={2} placeholder="Where you met them, interest level, etc." />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={prospectMutation.isPending} className="btn-primary">
                {prospectMutation.isPending ? 'Saving…' : 'Save Prospect'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Member form (existing, unchanged) */}
      {mode === 'member' && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s ? 'bg-brand-gold text-white' : 'bg-gray-200 text-gray-500'
                }`}>{s}</div>
                {s < 4 && <div className={`h-0.5 w-10 ${step > s ? 'bg-brand-gold' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <div className="ml-3 text-sm text-gray-500">{stepLabels[step - 1]}</div>
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

            {/* Step 4: Documents (post-registration, optional) */}
            {step === 4 && (
              <div className="card space-y-4">
                <div>
                  <h3 className="font-heading font-bold text-brand-navy text-lg">Supporting Documents</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Attach copies of ID, passport, birth certificate, or any other supporting documents. Optional — you can skip this step.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-brand-gold transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MdUploadFile size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Click to select files</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, PNG, or JPG — max 5 MB each</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {docFiles.length > 0 && (
                  <ul className="space-y-2">
                    {docFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
                        <MdInsertDriveFile size={18} className="text-brand-gold flex-shrink-0" />
                        <span className="flex-1 truncate text-gray-700">{f.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => setDocFiles(docFiles.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600"
                        >
                          <MdDelete size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setRegisteredMemberId(null); setDocFiles([]); }}
                    className="btn-outline"
                  >
                    {docFiles.length === 0 ? 'Skip & Register Another' : 'Skip Uploads'}
                  </button>
                  {docFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDocUpload}
                      disabled={docUploading}
                      className="btn-primary"
                    >
                      {docUploading ? 'Uploading…' : `Upload ${docFiles.length} File${docFiles.length > 1 ? 's' : ''}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  </Layout>
);
```

- [ ] **Step 5: Verify in browser**

Navigate to `/agent/register`. Confirm:
- Two toggle buttons appear: "Register Member" and "Register Prospect".
- Clicking "Register Prospect" shows the 4-field form; the step wizard is hidden.
- Clicking "Register Member" shows the original multi-step form.
- Submitting the prospect form with name + phone shows a success toast and resets the form.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/agent/Register.jsx
git commit -m "feat: add prospect toggle and form to agent register page"
```

---

## Task 5: Agent Dashboard — prospects stat card

**Files:**
- Modify: `client/src/pages/agent/Dashboard.jsx`

- [ ] **Step 1: Add prospects query**

In `client/src/pages/agent/Dashboard.jsx`, after the `membersData` query (after line 30), add:

```js
const { data: prospectsData } = useQuery({
  queryKey: ['agent-prospects'],
  queryFn: async () => {
    const { data } = await api.get('/prospects/my');
    return data.data;
  },
});
```

- [ ] **Step 2: Add Prospects stat card**

Find the `stats` array (lines 34–46). Add `MdPersonSearch` to the imports at line 10:

```js
import { MdPersonAdd, MdPeople, MdCheckCircle, MdHourglassEmpty, MdTrendingUp, MdLock, MdPersonSearch } from 'react-icons/md';
```

Add a fifth entry to the `stats` array:

```js
{ label: 'Prospects', value: prospectsData?.length || 0, icon: MdPersonSearch, color: 'text-indigo-600' },
```

The full `stats` array becomes:

```js
const stats = [
  { label: 'Total Recruits', value: myStats?.total_recruits || 0, icon: MdPeople, color: 'text-blue-600' },
  { label: 'Approved', value: myStats?.approved || 0, icon: MdCheckCircle, color: 'text-green-600' },
  { label: 'Pending', value: myStats?.pending || 0, icon: MdHourglassEmpty, color: 'text-yellow-600' },
  {
    label: 'Approval Rate',
    value: myStats?.total_recruits > 0
      ? `${Math.round((myStats.approved / myStats.total_recruits) * 100)}%`
      : '0%',
    icon: MdTrendingUp,
    color: 'text-purple-600',
  },
  { label: 'Prospects', value: prospectsData?.length || 0, icon: MdPersonSearch, color: 'text-indigo-600' },
];
```

Also update the grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-5` (line 72):

```jsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
```

- [ ] **Step 3: Verify in browser**

Log in as an agent, go to `/agent/dashboard`. Confirm a 5th stat card labelled "Prospects" appears showing the correct count.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/agent/Dashboard.jsx
git commit -m "feat: add prospects stat card to agent dashboard"
```

---

## Task 6: Admin Prospects page, route, and sidebar link

**Files:**
- Create: `client/src/pages/admin/Prospects.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/Sidebar.jsx`

- [ ] **Step 1: Create the Prospects page**

```jsx
// client/src/pages/admin/Prospects.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MdPersonSearch, MdCheckCircle } from 'react-icons/md';

function StatusPill({ status }) {
  return status === 'approved' ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <MdCheckCircle size={12} /> Approved
    </span>
  ) : (
    <span className="inline-block text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      Prospect
    </span>
  );
}

export default function AdminProspects() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-prospects', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/prospects?${params}`);
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`/prospects/${id}/approve`),
    onSuccess: () => {
      toast.success('Prospect approved');
      qc.invalidateQueries(['admin-prospects']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to approve'),
  });

  const prospects = data?.data || [];
  const meta = data?.meta;

  return (
    <Layout title="Prospects">
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Leads captured by agents. Approve a prospect to signal readiness for full member registration.
          </p>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input w-40 text-sm"
          >
            <option value="">All statuses</option>
            <option value="prospect">Prospect</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-10">
              <MdPersonSearch size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No prospects found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Name', 'Phone', 'Email', 'Agent', 'Status', 'Date', ''].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium">{p.full_name}</td>
                        <td className="py-2.5 pr-4">{p.phone}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{p.email || '—'}</td>
                        <td className="py-2.5 pr-4 text-gray-500">{p.agent_name || '—'}</td>
                        <td className="py-2.5 pr-4"><StatusPill status={p.status} /></td>
                        <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap">
                          {format(new Date(p.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="py-2.5">
                          {p.status === 'prospect' && (
                            <button
                              onClick={() => approveMutation.mutate(p.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs font-semibold text-brand-navy hover:text-brand-gold transition-colors disabled:opacity-40"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && meta.pages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Page {page} of {meta.pages} ({meta.total} total)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                      disabled={page === meta.pages}
                      className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Register the route in App.jsx**

Add the import near the other admin imports (after line 23):

```js
import AdminProspects from './pages/admin/Prospects';
```

Add the route after the `/admin/members/:id` route:

```jsx
<Route path="/admin/prospects" element={
  <ProtectedRoute roles={['admin', 'super_admin']}><AdminProspects /></ProtectedRoute>
} />
```

- [ ] **Step 3: Add Prospects nav link to Sidebar.jsx**

In `client/src/components/Sidebar.jsx`, add `MdPersonSearch` to the icon imports:

```js
import {
  MdDashboard, MdPeople, MdAssignment, MdChat, MdBarChart,
  MdSecurity, MdHistory, MdLogout, MdPersonAdd, MdPerson, MdGroups, MdPersonSearch,
} from 'react-icons/md';
```

Add the Prospects link to the `admin` array after `Members`:

```js
admin: [
  { to: '/admin/dashboard', icon: MdDashboard, label: 'Dashboard' },
  { to: '/admin/members', icon: MdPeople, label: 'Members' },
  { to: '/admin/prospects', icon: MdPersonSearch, label: 'Prospects' },
  { to: '/admin/claims', icon: MdAssignment, label: 'Claims' },
  { to: '/admin/communicate', icon: MdChat, label: 'Communications' },
  { to: '/admin/reports', icon: MdBarChart, label: 'Reports' },
],
```

Also add to the `super_admin` array after `Members`:

```js
super_admin: [
  { to: '/admin/dashboard', icon: MdDashboard, label: 'Dashboard' },
  { to: '/admin/members', icon: MdPeople, label: 'Members' },
  { to: '/admin/prospects', icon: MdPersonSearch, label: 'Prospects' },
  { to: '/admin/claims', icon: MdAssignment, label: 'Claims' },
  { to: '/admin/communicate', icon: MdChat, label: 'Communications' },
  { to: '/admin/reports', icon: MdBarChart, label: 'Reports' },
  { to: '/admin/users', icon: MdSecurity, label: 'Users' },
  { to: '/admin/team-leaders', icon: MdGroups, label: 'Team Leaders' },
  { to: '/admin/audit', icon: MdHistory, label: 'Audit Trail' },
],
```

- [ ] **Step 4: Verify in browser**

Log in as admin. Confirm:
- "Prospects" link appears in the sidebar.
- Navigating to `/admin/prospects` shows the table.
- Status filter dropdown works.
- Clicking "Approve" on a prospect row flips its status to "Approved" inline.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/Prospects.jsx client/src/App.jsx client/src/components/Sidebar.jsx
git commit -m "feat: add admin prospects page, route, and sidebar link"
```

---

## Task 7: Communicate page — prospects recipient option

**Files:**
- Modify: `client/src/pages/admin/Communicate.jsx`

- [ ] **Step 1: Add prospects option to the recipient selector**

In `client/src/pages/admin/Communicate.jsx`, find the `<select>` for "Send To" (around line 56). Replace it with:

```jsx
<select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="input">
  <option value="all">All Active Members</option>
  <option value="agent">All Agents</option>
  <option value="prospects">Prospects (email only)</option>
</select>
```

- [ ] **Step 2: Verify in browser**

Log in as admin, go to `/admin/communicate`. Confirm:
- "Prospects (email only)" option appears in the Send To dropdown.
- Selecting it and sending an email message completes without error.
- The communication history table shows `prospects` in the "To" column for that sent message.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/Communicate.jsx
git commit -m "feat: add prospects recipient type to communicate page"
```

---

## Task 8: Team Leader AgentDetail — prospects section

**Files:**
- Modify: `client/src/pages/team-leader/AgentDetail.jsx`

- [ ] **Step 1: Add prospects query**

In `client/src/pages/team-leader/AgentDetail.jsx`, after the existing `useQuery` that fetches agent/member data (after the closing `});` of that query, around line 32), add:

```js
const { data: prospectsData } = useQuery({
  queryKey: ['tl-agent-prospects', agentId],
  queryFn: async () => {
    const { data } = await api.get(`/prospects/agent/${agentId}`);
    return data.data;
  },
  enabled: !!agentId,
});
```

- [ ] **Step 2: Add prospects section to the JSX**

In the return statement, after the closing `</div>` of the recruits card (after the pagination block, around line 217), add:

```jsx
{/* Prospects section */}
<div className="card">
  <h3 className="font-heading font-bold text-brand-navy mb-4">
    Prospects {prospectsData?.length ? `(${prospectsData.length})` : ''}
  </h3>
  {!prospectsData?.length ? (
    <p className="text-gray-500 text-sm text-center py-6">This agent has not captured any prospects yet.</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Name', 'Phone', 'Email', 'Status', 'Date'].map((h) => (
              <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prospectsData.map((p) => (
            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 pr-4 font-medium">{p.full_name}</td>
              <td className="py-2.5 pr-4">{p.phone}</td>
              <td className="py-2.5 pr-4 text-gray-500">{p.email || '—'}</td>
              <td className="py-2.5 pr-4">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.status === 'approved'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {p.status === 'approved' ? 'Approved' : 'Prospect'}
                </span>
              </td>
              <td className="py-2.5 text-gray-400 whitespace-nowrap">
                {format(new Date(p.created_at), 'dd MMM yyyy')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify in browser**

Log in as a team leader, navigate to an agent's detail page. Confirm:
- A "Prospects" section appears below the Recruits table.
- It shows the agent's prospects with correct data.
- Status is shown as a coloured pill.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/team-leader/AgentDetail.jsx
git commit -m "feat: add prospects section to team leader agent detail page"
```

---

## Self-Review Checklist

- [x] **DB migration** — Task 1 creates `prospects` table with correct columns, indexes, and constraint.
- [x] **POST /prospects** — Task 2 controller validates full_name + phone, sets registered_by_agent from JWT.
- [x] **GET /prospects** — Task 2 admin list with pagination + status filter.
- [x] **GET /prospects/my** — Task 2 agent own prospects.
- [x] **GET /prospects/agent/:agentId** — Task 2 team leader with agent ownership check.
- [x] **PATCH /prospects/:id/approve** — Task 2 flips status, no notification.
- [x] **Communications prospects type** — Task 3 queries prospects table for email IS NOT NULL.
- [x] **Agent Register toggle** — Task 4 adds mode state, prospect schema, prospect mutation, prospect form, wraps member form in `{mode === 'member' && ...}`.
- [x] **Agent Dashboard stat** — Task 5 adds 5th card fetching GET /prospects/my.
- [x] **Admin Prospects page** — Task 6 creates page with table, status filter, approve button, pagination.
- [x] **Route registered** — Task 6 adds `/admin/prospects` to App.jsx.
- [x] **Sidebar links** — Task 6 adds Prospects to both `admin` and `super_admin` nav arrays.
- [x] **Communicate dropdown** — Task 7 adds `prospects` option.
- [x] **Team Leader AgentDetail** — Task 8 adds prospects query + table section.
- [x] **No placeholders** — all steps contain complete code.
- [x] **Type consistency** — `prospectsData`, `prospectMutation`, `prospectSchema`, `registerProspect` used consistently across tasks.
