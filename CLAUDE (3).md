# CLAUDE.md — My Life Companion Welfare Management System

> **Project codename:** `mlc-welfare`
> **Stack:** Node.js · React · Tailwind CSS · PostgreSQL (Neon) · Heroku
> **IDE:** Visual Studio Code on Linux
> **Author:** Mistified Solutions

---

## 1. Project Overview

A web-based SaaS Welfare Management Platform for **My Life Companion Welfare** (underwritten by Old Mutual). The system handles member registration, agent workflows, admin approvals, claims management, automated communications, and virtual membership card generation.

**Brand identity (from PDF):**
- Organization: My Life Companion Welfare
- Underwriter: Old Mutual
- Contact: +254-118-043-715
- Email: info@mylife-companion.com
- Website: www.mylife-companion.com
- Address: Development House, Floor 13, Suite no. 18

**Primary colors:**
- Gold/Orange: `#F5A623` (from logo)
- Dark navy: `#1A2B4A`
- White: `#FFFFFF`
- Accent green: `#27AE60`

---

## 2. Architecture Overview

```
mlc-welfare/
├── client/                  # React frontend (Vite + Tailwind)
│   ├── public/
│   │   └── assets/          # Logo, brand images
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Route-level pages
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── member/      # Member portal pages
│   │   │   ├── agent/       # Agent portal pages
│   │   │   └── admin/       # Admin portal pages
│   │   ├── context/         # AuthContext, etc.
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # Axios API service layer
│   │   ├── utils/           # Helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                  # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js        # Neon PostgreSQL pool
│   │   │   └── env.js       # Env validation
│   │   ├── middleware/
│   │   │   ├── auth.js      # JWT verify middleware
│   │   │   ├── rbac.js      # Role-based access control
│   │   │   ├── audit.js     # Audit log middleware
│   │   │   └── errorHandler.js
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── members/
│   │   │   ├── agents/
│   │   │   ├── admin/
│   │   │   ├── claims/
│   │   │   ├── communications/
│   │   │   ├── cards/
│   │   │   └── reports/
│   │   ├── utils/
│   │   │   ├── memberNumber.js   # Auto membership number generator
│   │   │   ├── sms.js            # SMS gateway wrapper
│   │   │   ├── email.js          # Email service wrapper
│   │   │   └── qrcode.js         # QR code generator
│   │   └── app.js
│   ├── migrations/          # SQL migration files
│   └── package.json
│
├── .env.example
├── Procfile                 # Heroku process file
├── package.json             # Root (optional monorepo scripts)
└── CLAUDE.md                # ← this file
```

---

## 3. Tech Stack & Dependencies

### Backend (`server/`)
```json
{
  "express": "^4.18.x",
  "pg": "^8.11.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "dotenv": "^16.x",
  "cors": "^2.x",
  "helmet": "^7.x",
  "express-rate-limit": "^7.x",
  "express-validator": "^7.x",
  "multer": "^1.x",
  "nodemailer": "^6.x",
  "qrcode": "^1.5.x",
  "pdfkit": "^0.14.x",
  "axios": "^1.x",
  "uuid": "^9.x",
  "morgan": "^1.x"
}
```

### Frontend (`client/`)
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "axios": "^1.x",
  "@tanstack/react-query": "^5.x",
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "@hookform/resolvers": "^3.x",
  "recharts": "^2.x",
  "react-hot-toast": "^2.x",
  "react-icons": "^5.x",
  "date-fns": "^3.x",
  "clsx": "^2.x"
}
```

### Dev dependencies
```json
{
  "vite": "^5.x",
  "@vitejs/plugin-react": "^4.x",
  "tailwindcss": "^3.x",
  "autoprefixer": "^10.x",
  "postcss": "^8.x",
  "nodemon": "^3.x",
  "concurrently": "^8.x"
}
```

---

## 4. Environment Variables

Create `.env` in `server/` directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/mlc_welfare?sslmode=require

# JWT
JWT_SECRET=your_super_secret_key_minimum_32_chars
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=7d

# Email (Nodemailer - SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@mylife-companion.com
SMTP_PASS=your_app_password
FROM_EMAIL="My Life Companion <notifications@mylife-companion.com>"

# SMS Gateway (Africa's Talking recommended for Kenya)
AT_API_KEY=your_africas_talking_api_key
AT_USERNAME=your_at_username
AT_SENDER_ID=MYLIFECOMP

# App URL
CLIENT_URL=https://mlc-welfare.herokuapp.com
SERVER_URL=https://mlc-welfare-api.herokuapp.com

# Membership Number Config
MEMBERSHIP_PREFIX=WEL
```

---

## 5. Database Schema (PostgreSQL / Neon)

### Run order for migrations

```
migrations/
  001_create_users.sql
  002_create_members.sql
  003_create_dependents.sql
  004_create_beneficiaries.sql
  005_create_claims.sql
  006_create_audit_logs.sql
  007_create_communications.sql
  008_create_membership_cards.sql
```

### Core tables

```sql
-- 001_create_users.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('member', 'agent', 'admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 002_create_members.sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  membership_number VARCHAR(30) UNIQUE,          -- Auto-generated on approval
  full_name VARCHAR(255) NOT NULL,
  id_passport_no VARCHAR(50) UNIQUE NOT NULL,
  kra_pin VARCHAR(20),
  dob DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  physical_address TEXT,
  cover_option INTEGER CHECK (cover_option BETWEEN 1 AND 6),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'deceased', 'claim_pending', 'claim_settled')),
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  approval_date TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  registered_by_agent UUID REFERENCES users(id),
  medical_declaration BOOLEAN DEFAULT false,
  medical_conditions TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 003_create_dependents.sql
CREATE TABLE dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  dob DATE,
  id_or_birth_cert_no VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 004_create_beneficiaries.sql
CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  id_passport_no VARCHAR(50),
  address TEXT,
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 005_create_claims.sql
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  membership_number VARCHAR(30) NOT NULL,
  claim_type VARCHAR(100) NOT NULL,
  claim_amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  submitted_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  document_urls TEXT[],
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 006_create_audit_logs.sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 007_create_communications.sql
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES users(id),
  channel VARCHAR(10) CHECK (channel IN ('sms', 'email', 'both')),
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('all', 'member', 'agent', 'group')),
  recipient_ids UUID[],
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 008_create_membership_cards.sql
CREATE TABLE membership_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID UNIQUE NOT NULL REFERENCES members(id),
  membership_number VARCHAR(30) NOT NULL,
  qr_code_data TEXT,
  card_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  emailed_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_agent ON members(registered_by_agent);
CREATE INDEX idx_members_membership_no ON members(membership_number);
CREATE INDEX idx_claims_member ON claims(member_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

---

## 6. Membership Number Generation

**File:** `server/src/utils/memberNumber.js`

```js
// Format: WEL-2026-0001
// Atomic: uses a DB sequence to avoid race conditions

const { pool } = require('../config/db');

async function generateMembershipNumber() {
  const year = new Date().getFullYear();
  const prefix = process.env.MEMBERSHIP_PREFIX || 'WEL';

  const result = await pool.query(`
    SELECT COUNT(*) + 1 AS next_seq
    FROM members
    WHERE membership_number LIKE $1
  `, [`${prefix}-${year}-%`]);

  const seq = String(result.rows[0].next_seq).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

module.exports = { generateMembershipNumber };
```

> **Rules:**
> - Generated only when admin approves a member registration
> - Never user-editable
> - Permanently assigned — does NOT change on status update
> - Included in all SMS, email, and PDF card output

---

## 7. API Routes

Base URL: `/api/v1`

### Auth
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | All | Login, returns JWT |
| POST | `/auth/refresh` | All | Refresh JWT |
| POST | `/auth/logout` | All | Invalidate token |
| GET | `/auth/me` | All | Current user info |

### Members
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/members/register` | agent, admin | Register new member |
| GET | `/members` | admin | List all members (paginated) |
| GET | `/members/:id` | admin, member(own) | Get member profile |
| PUT | `/members/:id` | admin | Update member details |
| PATCH | `/members/:id/approve` | admin | Approve → auto-generate number + card + notify |
| PATCH | `/members/:id/status` | admin | Update status (suspend, deceased, etc.) |
| GET | `/members/search` | admin, agent | Search by name, ID, phone, number |
| GET | `/members/:id/card` | admin, member | Download virtual membership card |

### Dependents
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/members/:id/dependents` | agent, admin | Add dependent |
| GET | `/members/:id/dependents` | admin, member(own) | List dependents |
| DELETE | `/members/:id/dependents/:depId` | admin | Remove dependent |

### Claims
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/claims` | admin, agent | Submit claim |
| GET | `/claims` | admin | All claims |
| GET | `/claims/:id` | admin, member(own) | Claim detail |
| PATCH | `/claims/:id/status` | admin | Approve/Reject/Mark Paid |
| GET | `/members/:id/claims` | admin, member(own) | Member's claims |

### Communications
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/communications/send` | admin | Send SMS/Email blast |
| GET | `/communications` | admin | Communication history |

### Reports
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/reports/summary` | admin | Dashboard summary stats |
| GET | `/reports/agents` | admin | Agent recruitment performance |
| GET | `/reports/growth` | admin | Membership growth trends |
| GET | `/reports/claims` | admin | Claims summary |
| GET | `/reports/export` | admin | Export to CSV/PDF |

### Admin User Management
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/admin/users` | super_admin | List all users |
| POST | `/admin/users` | super_admin | Create agent/admin |
| DELETE | `/admin/users/:id` | super_admin | Deactivate user |
| GET | `/admin/audit-logs` | super_admin | Full audit trail |

---

## 8. JWT & RBAC Middleware

```js
// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// server/src/middleware/rbac.js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage examples:
// router.get('/members', verifyToken, requireRole('admin'), handler);
// router.post('/members/register', verifyToken, requireRole('agent', 'admin'), handler);
```

---

## 9. Frontend Routes & Role Gating

### React Router structure

```
/                        → Landing page (public)
/login                   → Single login page (all roles)

/member/dashboard        → Member: profile, dependents, claims
/member/profile          → Member: view personal details
/member/claims           → Member: view own claims

/agent/dashboard         → Agent: registration form, own recruits, performance
/agent/register          → Agent: new member registration

/admin/dashboard         → Admin: stats overview
/admin/members           → Admin: all members table + search
/admin/members/:id       → Admin: member detail + approve
/admin/claims            → Admin: claims management
/admin/communicate       → Admin: bulk SMS/email
/admin/reports           → Admin: reports + export
/admin/users             → Super admin: user management
/admin/audit             → Super admin: audit trail
```

### Protected Route component

```jsx
// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return children;
}
```

---

## 10. Virtual Membership Card

**Generated as PDF using PDFKit on the backend.**

### Card contents:
- Organization name + logo
- Member full name
- Membership number (large, bold)
- Cover option / plan
- Issue date + valid year
- QR code (links to `/verify/:membership_number`)
- "Underwritten by Old Mutual" footer

### Generation trigger:
1. Admin approves member → `PATCH /members/:id/approve`
2. Server generates membership number
3. Generates QR code → `qrcode.toDataURL(verifyUrl)`
4. Builds PDF card with PDFKit → saves to `/tmp/cards/`
5. Emails card PDF to member email
6. Sends SMS with download link
7. Stores card URL in `membership_cards` table
8. Member can also download from dashboard

---

## 11. Automated Notifications

### Trigger: Agent submits registration
```
SMS to member:
"Hello [Name], we have received your registration with My Life Companion Welfare. Processing is underway. For queries call +254-118-043-715."

Email to member:
Subject: Registration Received – My Life Companion Welfare
Body: Confirmation with details submitted.
```

### Trigger: Admin approves member
```
SMS to member:
"Congratulations [Name]! Your My Life Companion Welfare membership is ACTIVE. Your membership number is [WEL-2026-0001]. Welcome to the family!"

Email to member:
Subject: Welcome to My Life Companion Welfare – Membership Approved
Body: Welcome message + membership number + card attachment (PDF)

SMS to agent:
"Your registration of [Member Name] (ID: [ID]) has been approved. Membership No: [WEL-2026-0001]"
```

### SMS Gateway (Africa's Talking — Kenya)
```js
// server/src/utils/sms.js
const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

async function sendSMS(to, message) {
  return at.SMS.send({
    to: Array.isArray(to) ? to : [to],
    message,
    from: process.env.AT_SENDER_ID,
  });
}
```

---

## 12. Landing Page Design

**Aesthetic:** Clean corporate + warm gold. Professional, trust-building, mobile-first.

### Sections:
1. **Hero** — Logo, tagline, "Get Covered Today" CTA button, Old Mutual underwriter badge
2. **Cover Plans** — 6 option cards pulled directly from the PDF table (KES 1,500 – 15,000/year)
3. **How It Works** — 3 steps: Register via Agent → Admin Approval → Get Covered
4. **Who Is Covered** — Icons for Member, Spouse, Children (4), Parents (4)
5. **Key Terms** — Waiting periods, max ages, claim limits (from T&Cs)
6. **Contact** — Phone, email, address, paybill number (625625, Acc: 20190955)
7. **Footer** — Branded footer with links

### Tailwind color config:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#F5A623',
          'gold-dark': '#D4891A',
          navy: '#1A2B4A',
          'navy-light': '#243A63',
          green: '#27AE60',
        }
      },
      fontFamily: {
        heading: ['Merriweather', 'Georgia', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      }
    }
  }
}
```

---

## 13. Admin Dashboard Widgets

```
┌─────────────────────────────────────────────────────────────┐
│  Total Members  │  Active  │  Pending  │  Deceased  │ Claims │
│     1,240       │  1,180   │    45     │    15      │   22   │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────┐  ┌──────────────────────────────────┐
│  Membership Growth   │  │  Agent Recruitment Leaderboard   │
│  (Recharts LineChart)│  │  Agent Name | Recruits | Period  │
└──────────────────────┘  └──────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Recent Registrations (last 10, with quick approve button)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 14. Agent Sales Dashboard

**Accessed from:** `/agent/dashboard`

Shows:
- Agent's total registrations (all time)
- Registrations this month
- Registrations this week
- Approval rate (approved / total submitted)
- List of all registered members with status badges
- Filter by date range

Admin view at `/admin/reports/agents` shows:
- Sortable leaderboard: Agent Name | Total Recruits | This Month | Approved | Pending
- Exportable to CSV

---

## 15. Security Implementation

1. **Passwords:** `bcryptjs` with 12 salt rounds
2. **JWT:** Short-lived access tokens (8h) + refresh tokens (7d) in httpOnly cookies
3. **Rate limiting:** Login endpoint: 5 attempts / 15 min per IP
4. **Helmet:** Security headers on all responses
5. **Input validation:** `express-validator` on all POST/PUT routes
6. **Audit logging:** Middleware logs every mutating action (POST/PUT/PATCH/DELETE)
7. **Data access:** Members can only query their own `user_id` — enforced in query layer
8. **HTTPS:** Enforced by Heroku in production
9. **Session timeout:** JWT expiry + frontend idle timer (30 min inactivity → logout)

---

## 16. Heroku Deployment

### `Procfile`
```
web: node server/src/app.js
```

### Build process
```json
// root package.json scripts
{
  "scripts": {
    "start": "node server/src/app.js",
    "build": "cd client && npm install && npm run build",
    "heroku-postbuild": "npm run build",
    "dev": "concurrently \"cd server && nodemon src/app.js\" \"cd client && npm run dev\""
  }
}
```

### Static file serving (production)
```js
// server/src/app.js (production block)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}
```

### Neon PostgreSQL connection
```js
// server/src/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

module.exports = { pool };
```

### Heroku config vars to set:
```
DATABASE_URL         (auto-set by Neon/Heroku add-on or manual)
JWT_SECRET
JWT_REFRESH_SECRET
SMTP_HOST / SMTP_USER / SMTP_PASS
AT_API_KEY / AT_USERNAME / AT_SENDER_ID
CLIENT_URL
NODE_ENV=production
```

---

## 17. Development Setup (Linux / VS Code)

```bash
# 1. Clone and install
git clone https://github.com/mistified/mlc-welfare.git
cd mlc-welfare

# 2. Backend setup
cd server && npm install
cp .env.example .env
# Edit .env with your Neon connection string and keys

# 3. Run migrations
psql $DATABASE_URL < migrations/001_create_users.sql
# ... repeat for all migration files

# 4. Frontend setup
cd ../client && npm install

# 5. Run both (from root)
npm run dev
# Backend: http://localhost:5000
# Frontend: http://localhost:5173
```

### Recommended VS Code extensions:
- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier** — `esbenp.prettier-vscode`
- **Tailwind CSS IntelliSense** — `bradlc.vscode-tailwindcss`
- **REST Client** — `humao.rest-client` (for API testing)
- **PostgreSQL** — `cweijan.vscode-postgresql-client2`
- **GitLens** — `eamodio.gitlens`

---

## 18. Build Order (Recommended)

Claude should build the system in this sequence:

```
Phase 1 — Foundation
  [ ] Database schema + migrations
  [ ] Express app setup + middleware
  [ ] Auth module (register user, login, JWT, RBAC)
  [ ] DB connection (Neon pool)

Phase 2 — Core Member Module
  [ ] Member registration API (agents)
  [ ] Member approval API + membership number generator
  [ ] Dependents & beneficiaries API
  [ ] Audit log middleware

Phase 3 — Communication & Cards
  [ ] SMS service (Africa's Talking)
  [ ] Email service (Nodemailer)
  [ ] QR code generation
  [ ] PDF membership card generator
  [ ] Notification triggers on registration + approval

Phase 4 — Claims & Status
  [ ] Claims CRUD API
  [ ] Status transitions (active → deceased, etc.)
  [ ] Claim document upload (Multer)

Phase 5 — Reports
  [ ] Summary stats endpoint
  [ ] Agent leaderboard
  [ ] Growth trends
  [ ] CSV/PDF export

Phase 6 — React Frontend
  [ ] Vite + Tailwind setup
  [ ] AuthContext + ProtectedRoute
  [ ] Landing page (branded, all sections)
  [ ] Login page (single form, role-aware redirect)
  [ ] Member portal (3 pages)
  [ ] Agent portal (dashboard + registration form)
  [ ] Admin portal (full suite)

Phase 7 — Deployment
  [ ] Heroku app + config vars
  [ ] Neon DB production connection
  [ ] Production build test
  [ ] Smoke test all flows
```

---

## 19. Key Business Rules (Enforce in Code)

| Rule | Where to enforce |
|------|-----------------|
| Membership number = auto-generated, never manual | DB: no default, set only via approval endpoint |
| Only admins can approve registrations | RBAC middleware |
| Member can only view own records | Query filter: `WHERE user_id = req.user.id` |
| Max 4 children, 4 parents in cover | Validation in registration handler |
| Waiting period: 2 months general, 3 months parents | Store `commencement_date`, check in claims handler |
| Max 6 claims per family per year | Check count in claims submission handler |
| Children exit at 25 unless special needs | Cron job or check on login |
| Virtual card generated only after approval | Triggered inside approval handler, not separately |
| Audit log every mutation | Middleware on all non-GET routes |
| Session timeout: 30 minutes idle | Frontend: activity event listener + token expiry |

---

## 20. Notes for Claude

- **Never** hardcode credentials. Always use `process.env.*`
- **Always** validate and sanitize inputs server-side (`express-validator`)
- Use `async/await` with `try/catch` throughout — no raw Promise chains
- Wrap all DB queries in the `pool.query()` pattern — no ORMs
- React state management: use `@tanstack/react-query` for server state, `useState`/`useContext` for local/auth state
- All API responses follow: `{ success: true, data: {}, message: "" }` or `{ success: false, error: "" }`
- Format all KES amounts with `toLocaleString('en-KE')` in the frontend
- Date handling: store as UTC in DB, display in `Africa/Nairobi` timezone
- SMS numbers must include Kenya country code: `+254XXXXXXXXX`
- The landing page must be fully functional and branded before building auth flows
- Build mobile-first — all admin tables must be responsive with horizontal scroll on small screens

---

*Generated by Mistified Solutions | mlc-welfare v1.0.0*
