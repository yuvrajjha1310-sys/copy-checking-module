-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'CHECKED', 'RETURNED');

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentRoll" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "assignmentTitle" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "checkerName" TEXT,
    "marksObtained" INTEGER,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "remarks" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Submission_subject_idx" ON "Submission"("subject");
