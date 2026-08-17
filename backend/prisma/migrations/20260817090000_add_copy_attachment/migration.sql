-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "copyFileName" TEXT;
ALTER TABLE "Submission" ADD COLUMN     "copyFilePath" TEXT;
ALTER TABLE "Submission" ADD COLUMN     "copyFileType" TEXT;
ALTER TABLE "Submission" ADD COLUMN     "copyUploadedAt" TIMESTAMP(3);