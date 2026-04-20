const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./communications.controller');

router.post(
  '/send',
  verifyToken,
  requireRole('admin', 'super_admin'),
  [
    body('channel').isIn(['sms', 'email', 'both']).withMessage('Channel must be sms, email, or both'),
    body('message').notEmpty().withMessage('Message is required'),
    body('recipient_type').isIn(['all', 'member', 'agent', 'group']).withMessage('Invalid recipient type'),
  ],
  ctrl.sendCommunication
);

router.get('/', verifyToken, requireRole('admin', 'super_admin'), ctrl.listCommunications);

module.exports = router;
