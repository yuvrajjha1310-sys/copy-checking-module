const express = require('express');
const router = express.Router();
const {
  getSubmissions,
  getSubmissionById,
  createSubmission,
  assignChecker,
  checkSubmission,
  returnSubmission,
  deleteSubmission,
} = require('../controllers/submissionsController');
const { requireAuth } = require('../middleware/auth');

// Mount this router in the main app as: app.use('/api/submissions', submissionsRouter);

// Reads stay open so anyone signed in (or not) can view the board.
router.get('/', getSubmissions);
router.get('/:id', getSubmissionById);

// Every write requires a signed-in user, so we know who did what.
router.post('/', requireAuth, createSubmission);
router.patch('/:id/assign', requireAuth, assignChecker);
router.patch('/:id/check', requireAuth, checkSubmission);
router.patch('/:id/return', requireAuth, returnSubmission);
router.delete('/:id', requireAuth, deleteSubmission);

module.exports = router;