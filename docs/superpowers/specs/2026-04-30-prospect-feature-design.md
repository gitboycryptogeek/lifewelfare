# Prospect Feature Design

**Date:** 2026-04-30  
**Status:** Approved

---

## Overview

A "prospect" is a lightweight lead record captured by an agent — name, phone, and optionally email. Prospects are not members and carry none of the member obligations (no ID/passport, no cover option, no dependents). They exist as a sales pipeline: admin can approve them (signalling intent to convert), they can receive promotional communications, and they are preserved historically even after a full member registration is completed.

---

## Database

New table `prospects` added via migration `012_create_prospects.sql`. No changes to the existing `members` table.

```sql
CREATE TABLE prospects (
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

CREATE INDEX idx_prospects_agent  ON prospects(registered_by_agent);
CREATE INDEX idx_prospects_status ON prospects(status);
```

---

## API

New module: `server/src/modules/prospects/` (`prospects.controller.js`, `prospects.routes.js`).

| Method  | Path                            | Roles                    | Description                                      |
|---------|---------------------------------|--------------------------|--------------------------------------------------|
| POST    | /prospects                      | agent, admin, super_admin | Register a prospect. Body: full_name, phone, email?, notes?. `registered_by_agent` set from `req.user.id`. |
| GET     | /prospects                      | admin, super_admin        | List all prospects. Query params: `status`, `page`, `limit`. Joins `users` for agent name. |
| GET     | /prospects/my                   | agent                    | Agent's own prospects, ordered by created_at DESC. |
| GET     | /prospects/agent/:agentId       | team_leader              | Prospects registered by a specific agent who belongs to the requesting team leader. |
| PATCH   | /prospects/:id/approve          | admin, super_admin        | Sets `status = 'approved'`, `updated_at = NOW()`. No notification sent. |

The `POST /prospects` validation: `full_name` required, `phone` required, `email` optional (valid email if provided).

### Communicate endpoint change

`communications.controller.js` currently supports recipient types like `all`, `active`, `pending`. A new type `prospects` is added: it queries `SELECT email FROM prospects WHERE email IS NOT NULL`. The existing email-dispatch logic is reused unchanged.

---

## Frontend

### 1. Agent Register page — `client/src/pages/agent/Register.jsx`

Add a toggle at the top of the page: **"Register Member"** | **"Register Prospect"**.

- Default: Member (existing multi-step form, unchanged).
- Prospect mode: Single-card form with Full Name (required), Phone (required), Email (optional), Notes (optional). Submits to `POST /prospects`. On success: toast + reset form. No steps, no dependents, no beneficiaries.

### 2. Agent Dashboard — `client/src/pages/agent/Dashboard.jsx`

Add a 5th stat card **"Prospects"** fetched from `GET /prospects/my`. Displayed alongside Total Recruits, Approved, Pending, Approval Rate.

### 3. Admin Prospects page — `client/src/pages/admin/Prospects.jsx` (new file)

Route: `/admin/prospects`, protected for `admin | super_admin`.

- Paginated table: Name, Phone, Email, Agent, Status badge, Date registered.
- Status filter dropdown: All / Prospect / Approved.
- "Approve" button per row (inline, only visible when status is `prospect`). Calls `PATCH /prospects/:id/approve`, invalidates query on success.
- No delete action (records are kept historically).

### 4. Admin Sidebar — `client/src/components/Sidebar.jsx`

Add **Prospects** nav link to the admin section pointing to `/admin/prospects`.

### 5. Communicate page — `client/src/pages/admin/Communicate.jsx`

Add **Prospects** to the recipient-type selector. When selected, the backend uses the `prospects` recipient type and targets prospect email addresses. Label: `"Prospects (email only)"` — since prospects may not have phone numbers sufficient for SMS (or may not have email — backend silently skips records with no email).

### 6. Team Leader AgentDetail — `client/src/pages/team-leader/AgentDetail.jsx`

Below the existing Recruits table, add a collapsible **"Prospects"** section. Fetches from `GET /prospects/agent/:agentId`. Columns: Name, Phone, Email, Status badge, Date. Read-only — no approve action for team leaders.

---

## Access Control Summary

| Action                    | agent | team_leader | admin / super_admin |
|---------------------------|-------|-------------|----------------------|
| Register prospect          | yes   | no          | yes                  |
| View own prospects         | yes   | no          | yes (all)            |
| View agent's prospects     | no    | yes         | yes                  |
| Approve prospect           | no    | no          | yes                  |
| Send comms to prospects    | no    | no          | yes                  |

---

## Data Flow

1. Agent opens Register page → toggles to Prospect → submits 3-field form.
2. `POST /prospects` inserts row with `status = 'prospect'` and `registered_by_agent = agent.id`.
3. Admin views `/admin/prospects`, sees the record, clicks Approve → status becomes `approved`.
4. Agent (informed out-of-band) registers the person as a full member via the normal member form.
5. Prospect record remains in the `prospects` table permanently as a historical lead record.
6. Admin can send promotional email to all prospects (those with an email address) via the Communicate page.

---

## What is NOT in scope

- Automatic notification to agent when admin approves a prospect.
- Auto-linking a prospect to a member record after full registration.
- Team leader ability to approve prospects.
- Prospect SMS (only email is targeted in communications, since email is the optional field).
