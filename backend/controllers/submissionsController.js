const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { parseCsv, toCsv } = require('../utils/csv');
const { UPLOAD_ROOT } = require('../middleware/upload');
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

// ─────────────────────────────────────────────────────────────
// Copy attachment (the scanned PDF / photo of the student's paper)
// ─────────────────────────────────────────────────────────────

// POST /api/submissions/:id/copy -> attach/replace the scanned copy
exports.uploadCopy = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });

    const existing = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Now that the new file is safely saved, remove whatever was there before.
    if (existing.copyFilePath) {
      fs.unlink(path.join(UPLOAD_ROOT, existing.copyFilePath), () => {});
    }

    const submission = await prisma.submission.update({
      where: { id: existing.id },
      data: {
        copyFileName: req.file.originalname,
        copyFilePath: path.basename(req.file.path),
        copyFileType: req.file.mimetype,
        copyUploadedAt: new Date(),
      },
    });
    res.status(201).json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to attach copy' });
  }
};

// GET /api/submissions/:id/copy -> stream the attached scanned copy
exports.downloadCopy = async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
    if (!submission || !submission.copyFilePath) {
      return res.status(404).json({ error: 'No copy attached to this submission' });
    }
    const filePath = path.join(UPLOAD_ROOT, submission.copyFilePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Attached file is missing on the server' });
    }
    res.setHeader('Content-Type', submission.copyFileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(submission.copyFileName || 'copy')}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch copy' });
  }
};

// DELETE /api/submissions/:id/copy -> detach and delete the stored file
exports.deleteCopy = async (req, res) => {
  try {
    const existing = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'Submission not found' });
    if (existing.copyFilePath) {
      fs.unlink(path.join(UPLOAD_ROOT, existing.copyFilePath), () => {});
    }
    const submission = await prisma.submission.update({
      where: { id: existing.id },
      data: { copyFileName: null, copyFilePath: null, copyFileType: null, copyUploadedAt: null },
    });
    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove copy' });
  }
};

// ─────────────────────────────────────────────────────────────
// CSV bulk import / export
// ─────────────────────────────────────────────────────────────

// POST /api/submissions/import -> bulk-create submissions from an uploaded CSV.
// Expected header columns (case-insensitive): studentName, studentRoll, subject,
// assignmentTitle, maxMarks (optional, defaults to 100).
exports.importSubmissions = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV uploaded (field name: file)' });

    const records = parseCsv(req.file.buffer.toString('utf-8'));
    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV has no data rows' });
    }

    const toCreate = [];
    const skipped = [];

    records.forEach((r, idx) => {
      const rowNum = idx + 2; // +1 for header row, +1 for 1-indexing
      const studentName = r.studentname || r['student name'];
      const studentRoll = r.studentroll || r['roll number'] || r.roll;
      const subject = r.subject;
      const assignmentTitle = r.assignmenttitle || r['assignment title'] || r.assignment;
      const rawMax = r.maxmarks || r['max marks'];

      if (!studentName || !studentRoll || !subject || !assignmentTitle) {
        skipped.push({ row: rowNum, reason: 'Missing studentName, studentRoll, subject or assignmentTitle' });
        return;
      }

      let maxMarks = 100;
      if (rawMax) {
        const parsed = Number(rawMax);
        if (Number.isNaN(parsed) || parsed <= 0) {
          skipped.push({ row: rowNum, reason: `Invalid maxMarks "${rawMax}"` });
          return;
        }
        maxMarks = parsed;
      }

      toCreate.push({ studentName, studentRoll, subject, assignmentTitle, maxMarks });
    });

    let created = 0;
    if (toCreate.length > 0) {
      const result = await prisma.submission.createMany({ data: toCreate });
      created = result.count;
    }

    res.status(201).json({ created, skippedCount: skipped.length, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
};

// GET /api/submissions/export?status=&subject= -> CSV of the (optionally filtered) board
exports.exportSubmissions = async (req, res) => {
  try {
    const { status, subject } = req.query;
    const where = {};
    if (status) where.status = status;
    if (subject) where.subject = { contains: subject, mode: 'insensitive' };

    const submissions = await prisma.submission.findMany({ where, orderBy: { submittedAt: 'desc' } });

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'studentName', label: 'Student Name' },
      { key: 'studentRoll', label: 'Roll Number' },
      { key: 'subject', label: 'Subject' },
      { key: 'assignmentTitle', label: 'Assignment' },
      { key: 'status', label: 'Status' },
      { key: 'checkerName', label: 'Checker' },
      { key: 'marksObtained', label: 'Marks Obtained' },
      { key: 'maxMarks', label: 'Max Marks' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'hasCopy', label: 'Copy Attached' },
      { key: 'submittedAt', label: 'Submitted At' },
      { key: 'checkedAt', label: 'Checked At' },
    ];

    const rows = submissions.map((s) => ({
      ...s,
      hasCopy: s.copyFilePath ? 'Yes' : 'No',
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : '',
      checkedAt: s.checkedAt ? s.checkedAt.toISOString() : '',
    }));

    const csv = toCsv(columns, rows);
    const filename = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};