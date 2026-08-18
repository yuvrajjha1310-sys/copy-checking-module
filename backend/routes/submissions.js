const express = require('express');
const router = express.Router();
const {
  getSubmissions,
  getSubmissionById,
  createSubmission,
  assignChecker,
  checkSubmission,
  editSubmission,
  returnSubmission,
  deleteSubmission,
  uploadCopy,
  downloadCopy,
  deleteCopy,
  importSubmissions,
  exportSubmissions,
} = require('../controllers/submissionsController');
const { requireAuth } = require('../middleware/auth');
const { copyUpload, importUpload } = require('../middleware/upload');

// Mount this router in the main app as: app.use('/api/submissions', submissionsRouter);

// Fixed-path routes must come before '/:id' so "export" isn't parsed as an id.
router.get('/export', exportSubmissions);
router.post('/import', requireAuth, importUpload.array('files', 20), importSubmissions);

// Reads stay open so anyone signed in (or not) can view the board.
router.get('/', getSubmissions);
router.get('/:id', getSubmissionById);
router.get('/:id/copy', downloadCopy);

// Every write requires a signed-in user, so we know who did what.
router.post('/', requireAuth, createSubmission);
router.patch('/:id/assign', requireAuth, assignChecker);
router.patch('/:id/check', requireAuth, checkSubmission);
router.patch('/:id/return', requireAuth, returnSubmission);
router.patch('/:id', requireAuth, editSubmission); // full edit, any status
router.post('/:id/copy', requireAuth, copyUpload.single('file'), uploadCopy);
router.delete('/:id/copy', requireAuth, deleteCopy);
router.delete('/:id', requireAuth, deleteSubmission);

module.exports = router;