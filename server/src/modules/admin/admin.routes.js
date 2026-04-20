const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./admin.controller');

router.get('/users', verifyToken, requireRole('super_admin'), ctrl.listUsers);
router.post(
  '/users',
  verifyToken,
  requireRole('super_admin'),
  [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['agent', 'admin', 'super_admin']).withMessage('Invalid role'),
  ],
  ctrl.createUser
);
router.patch('/users/:id/deactivate', verifyToken, requireRole('super_admin'), ctrl.deactivateUser);
router.get('/audit-logs', verifyToken, requireRole('super_admin'), ctrl.getAuditLogs);

module.exports = router;
