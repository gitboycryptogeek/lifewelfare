const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { verifyToken } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./members.controller');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../../uploads/documents'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`);
  },
});
const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF, PNG, or JPG files are allowed'), false);
};
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

const registrationValidation = [
  body('full_name').notEmpty().trim().withMessage('Full name is required'),
  body('id_passport_no').notEmpty().trim().withMessage('ID/Passport number is required'),
  body('dob').isDate().withMessage('Valid date of birth is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('cover_option').isInt({ min: 1, max: 6 }).withMessage('Cover option must be 1–6'),
  body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
];

// Member registration
router.post(
  '/register',
  verifyToken,
  requireRole('agent', 'admin', 'super_admin'),
  registrationValidation,
  ctrl.registerMember
);

// Search members
router.get('/search', verifyToken, requireRole('admin', 'agent'), ctrl.searchMembers);

// List all members (admin)
router.get('/', verifyToken, requireRole('admin', 'super_admin'), ctrl.listMembers);

// Get member by ID
router.get('/:id', verifyToken, ctrl.getMember);

// Update member
router.put(
  '/:id',
  verifyToken,
  requireRole('admin', 'super_admin'),
  ctrl.updateMember
);

// Approve member
router.patch('/:id/approve', verifyToken, requireRole('admin', 'super_admin'), ctrl.approveMember);

// Update status
router.patch('/:id/status', verifyToken, requireRole('admin', 'super_admin'), ctrl.updateStatus);

// Download card
router.get('/:id/card', verifyToken, ctrl.downloadCard);

// Dependents
router.post(
  '/:id/dependents',
  verifyToken,
  requireRole('agent', 'admin', 'super_admin'),
  [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('relationship').notEmpty().withMessage('Relationship is required'),
  ],
  ctrl.addDependent
);
router.get('/:id/dependents', verifyToken, ctrl.getDependents);
router.delete('/:id/dependents/:depId', verifyToken, requireRole('admin', 'super_admin'), ctrl.removeDependent);

// Beneficiaries
router.post(
  '/:id/beneficiaries',
  verifyToken,
  requireRole('agent', 'admin', 'super_admin'),
  [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('relationship').notEmpty().withMessage('Relationship is required'),
  ],
  ctrl.addBeneficiary
);
router.get('/:id/beneficiaries', verifyToken, ctrl.getBeneficiaries);
router.delete('/:id/beneficiaries/:benId', verifyToken, requireRole('admin', 'super_admin'), ctrl.removeBeneficiary);

// Claims for a member
router.get('/:id/claims', verifyToken, ctrl.getMemberClaims);

// Documents
router.post(
  '/:id/documents',
  verifyToken,
  requireRole('agent', 'admin', 'super_admin'),
  upload.array('documents', 10),
  ctrl.uploadDocuments
);
router.get('/:id/documents', verifyToken, ctrl.getDocuments);

module.exports = router;
