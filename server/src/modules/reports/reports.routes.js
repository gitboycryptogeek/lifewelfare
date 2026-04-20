const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./reports.controller');

router.get('/summary', verifyToken, requireRole('admin', 'super_admin'), ctrl.getSummary);
router.get('/agents', verifyToken, requireRole('admin', 'super_admin', 'agent'), ctrl.getAgentLeaderboard);
router.get('/growth', verifyToken, requireRole('admin', 'super_admin'), ctrl.getGrowthTrends);
router.get('/claims', verifyToken, requireRole('admin', 'super_admin'), ctrl.getClaimsReport);
router.get('/export', verifyToken, requireRole('admin', 'super_admin'), ctrl.exportData);

module.exports = router;
