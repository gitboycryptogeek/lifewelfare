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
