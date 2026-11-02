// Service-suspension switch, controlled entirely by env vars:
//   MAINTENANCE_MODE=true                         -> turn the switch on
//   MAINTENANCE_START=2026-11-03T00:00:00+03:00   -> optional; suspend from this moment (ISO 8601)
// Evaluated per request, so a scheduled start kicks in without a restart.

function isSuspended() {
  if (String(process.env.MAINTENANCE_MODE).toLowerCase() !== 'true') return false;
  const start = process.env.MAINTENANCE_START;
  if (!start) return true;
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) return true;
  return Date.now() >= startMs;
}

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Service Suspended</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #f4f4f5; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #18181b; padding: 16px; box-sizing: border-box; }
  .card { max-width: 520px; background: #fff; border-top: 6px solid #dc2626; border-radius: 10px;
          padding: 40px 32px; box-shadow: 0 10px 30px rgba(0,0,0,.08); text-align: center; }
  h1 { margin: 0 0 16px; font-size: 1.6rem; color: #dc2626; }
  p { margin: 0 0 12px; line-height: 1.6; color: #3f3f46; }
  .code { margin-top: 24px; font-size: .8rem; color: #a1a1aa; }
</style>
</head>
<body>
  <div class="card">
    <h1>Service Suspended</h1>
    <p>This application has been suspended because the payment for hosting and maintenance services is overdue.</p>
    <p><strong>Payment was due on 1st November 2026.</strong></p>
    <p>Please contact your service provider to settle the balance and restore access.</p>
    <div class="code">Error 503 &middot; Account suspended for non-payment</div>
  </div>
</body>
</html>`;

function maintenanceMode(req, res, next) {
  if (!isSuspended()) return next();
  res.set('Retry-After', '86400');
  res.set('Cache-Control', 'no-store');
  if (req.path.startsWith('/api')) {
    return res.status(503).json({
      success: false,
      message: 'Service suspended: hosting and maintenance payment was due on 1st November 2026. Please contact your service provider.',
    });
  }
  return res.status(503).type('html').send(PAGE);
}

module.exports = { maintenanceMode };
