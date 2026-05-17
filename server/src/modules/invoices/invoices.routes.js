const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./invoices.controller');

const staffRoles = ['admin', 'super_admin', 'agent', 'team_leader'];

router.post('/', verifyToken, requireRole(...staffRoles), ctrl.createInvoice);
router.get('/', verifyToken, requireRole(...staffRoles), ctrl.listInvoices);
router.get('/:id', verifyToken, requireRole(...staffRoles), ctrl.getInvoice);
router.get('/:id/pdf', verifyToken, requireRole(...staffRoles), ctrl.generatePdf);
router.patch('/:id/status', verifyToken, requireRole('admin', 'super_admin'), ctrl.updateStatus);

module.exports = router;
