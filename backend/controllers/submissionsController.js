const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/submissions?status=PENDING&subject=Math
exports.getSubmissions = async (req, res) => {
  try {
    const { status, subject } = req.query;
    const where = {};
    if (status) where.status = status;
    if (subject) where.subject = { contains: subject, mode: 'insensitive' };

    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

// GET /api/submissions/:id
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!submission) return res.status(404).json({ error: 'Not found' });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
};

// POST /api/submissions
exports.createSubmission = async (req, res) => {
  try {
    const { studentName, studentRoll, subject, assignmentTitle, maxMarks } = req.body;
    if (!studentName || !studentRoll || !subject || !assignmentTitle) {
      return res.status(400).json({ error: 'studentName, studentRoll, subject and assignmentTitle are required' });
    }
    const submission = await prisma.submission.create({
      data: { studentName, studentRoll, subject, assignmentTitle, maxMarks: maxMarks || 100 },
    });
    res.status(201).json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create submission' });
  }
};

// PATCH /api/submissions/:id/assign  -> the signed-in user picks it up, move to IN_REVIEW
exports.assignChecker = async (req, res) => {
  try {
    const submission = await prisma.submission.update({
      where: { id: Number(req.params.id) },
      data: {
        checkerId: req.user.id,
        checkerName: req.user.name,
        status: 'IN_REVIEW',
      },
    });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign checker' });
  }
};

// PATCH /api/submissions/:id/check  -> enter marks + remarks, move to CHECKED
exports.checkSubmission = async (req, res) => {
  try {
    const { marksObtained, remarks } = req.body;
    if (marksObtained === undefined || marksObtained === null || marksObtained === '') {
      return res.status(400).json({ error: 'marksObtained is required' });
    }
    const marks = Number(marksObtained);
    if (Number.isNaN(marks) || marks < 0) {
      return res.status(400).json({ error: 'marksObtained must be a non-negative number' });
    }
    const existing = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });
    if (marks > existing.maxMarks) {
      return res.status(400).json({ error: `marksObtained cannot exceed maxMarks (${existing.maxMarks})` });
    }

    const submission = await prisma.submission.update({
      where: { id: Number(req.params.id) },
      data: {
        marksObtained: marks,
        remarks,
        status: 'CHECKED',
        checkedAt: new Date(),
      },
    });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check submission' });
  }
};

// PATCH /api/submissions/:id/return -> mark as RETURNED to student
exports.returnSubmission = async (req, res) => {
  try {
    const submission = await prisma.submission.update({
      where: { id: Number(req.params.id) },
      data: { status: 'RETURNED' },
    });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to return submission' });
  }
};

// PATCH /api/submissions/:id  -> edit any field, any status
exports.editSubmission = async (req, res) => {
  try {
    const existing = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });

    const { studentName, studentRoll, subject, assignmentTitle, maxMarks, marksObtained, remarks } = req.body;

    const data = {};
    if (studentName !== undefined) data.studentName = studentName;
    if (studentRoll !== undefined) data.studentRoll = studentRoll;
    if (subject !== undefined) data.subject = subject;
    if (assignmentTitle !== undefined) data.assignmentTitle = assignmentTitle;

    const effectiveMax = maxMarks !== undefined ? Number(maxMarks) : existing.maxMarks;
    if (maxMarks !== undefined) {
      if (Number.isNaN(effectiveMax) || effectiveMax <= 0) {
        return res.status(400).json({ error: 'maxMarks must be a positive number' });
      }
      data.maxMarks = effectiveMax;
    }

    if (marksObtained !== undefined && marksObtained !== null && marksObtained !== '') {
      const marks = Number(marksObtained);
      if (Number.isNaN(marks) || marks < 0) {
        return res.status(400).json({ error: 'marksObtained must be a non-negative number' });
      }
      if (marks > effectiveMax) {
        return res.status(400).json({ error: `marksObtained cannot exceed maxMarks (${effectiveMax})` });
      }
      data.marksObtained = marks;
    }

    if (remarks !== undefined) data.remarks = remarks;

    const submission = await prisma.submission.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update submission' });
  }
};

// DELETE /api/submissions/:id
exports.deleteSubmission = async (req, res) => {
  try {
    await prisma.submission.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
};