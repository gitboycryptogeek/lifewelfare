const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./claims.controller');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../../uploads/documents'),
  filename: (req, file, cb) => {
    cb(null, `claim-${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
});

router.post(
  '/',
  verifyToken,
  requireRole('admin', 'super_admin', 'agent'),
  upload.array('documents', 5),
  [
    body('member_id').notEmpty().withMessage('Member ID is required'),
    body('claim_type').notEmpty().withMessage('Claim type is required'),
    body('claim_amount').isFloat({ min: 0 }).withMessage('Valid claim amount is required'),
  ],
  ctrl.submitClaim
);

router.get('/', verifyToken, requireRole('admin', 'super_admin'), ctrl.listClaims);
router.get('/:id', verifyToken, ctrl.getClaim);
router.patch('/:id/status', verifyToken, requireRole('admin', 'super_admin'), ctrl.updateClaimStatus);

module.exports = router;
