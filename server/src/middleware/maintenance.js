// Service-suspension switch, controlled entirely by env vars:
//   MAINTENANCE_MODE=true                         -> turn the switch on
//   MAINTENANCE_START=2026-11-03T00:00:00+03:00   -> optional; suspend from this moment (ISO 8601)
// Evaluated per request, so a scheduled start kicks in without a restart.
// While suspended, every request gets an empty 503 response.

function isSuspended() {
  if (String(process.env.MAINTENANCE_MODE).toLowerCase() !== 'true') return false;
  const start = process.env.MAINTENANCE_START;
  if (!start) return true;
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) return true;
  return Date.now() >= startMs;
}

function maintenanceMode(req, res, next) {
  if (!isSuspended()) return next();
  res.set('Cache-Control', 'no-store');
  return res.status(503).end();
}

module.exports = { maintenanceMode };
