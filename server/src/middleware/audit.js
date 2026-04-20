const { pool } = require('../config/db');

function auditLog(action, entityType) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.user.id,
              action,
              entityType,
              body?.data?.id || req.params?.id || null,
              body?.data ? JSON.stringify(body.data) : null,
              req.ip,
              req.headers['user-agent'],
            ]
          );
        } catch (err) {
          console.error('Audit log error:', err.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

// Generic middleware that logs all mutating requests automatically
async function autoAudit(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user) {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.user.id,
              `${req.method} ${req.path}`,
              req.params?.id ? 'resource' : null,
              req.params?.id || null,
              body?.data ? JSON.stringify(body.data) : null,
              req.ip,
              req.headers['user-agent'],
            ]
          );
        } catch (err) {
          console.error('Auto audit log error:', err.message);
        }
      }
      return originalJson(body);
    };
  }
  next();
}

module.exports = { auditLog, autoAudit };
