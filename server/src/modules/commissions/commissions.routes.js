const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./commissions.controller');

// Agent: view own commissions and totals
router.get('/my', verifyToken, requireRole('agent'), ctrl.getMyCommissions);

// Admin: system-wide summary totals
router.get('/summary', verifyToken, requireRole('admin', 'super_admin'), ctrl.getCommissionsSummary);

// Admin: view individual agent's commissions (detail modal)
router.get('/agent/:agentId', verifyToken, requireRole('admin', 'super_admin'), ctrl.getAgentCommissions);

// Admin: per-agent rollup table (paginated)
router.get('/', verifyToken, requireRole('admin', 'super_admin'), ctrl.getAllCommissions);

// Admin: disburse pending commissions for an agent
router.patch('/disburse', verifyToken, requireRole('admin', 'super_admin'), ctrl.disburseCommissions);

module.exports = router;
