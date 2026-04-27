const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./teamLeader.controller');

router.get('/dashboard', verifyToken, requireRole('team_leader'), ctrl.getTeamLeaderDashboard);
router.get('/agents',    verifyToken, requireRole('team_leader'), ctrl.getTeamLeaderAgents);

module.exports = router;
