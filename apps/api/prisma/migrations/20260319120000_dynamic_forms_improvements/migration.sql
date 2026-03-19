-- AlterEnum
ALTER TYPE "DynamicFormQuestionType" ADD VALUE 'nps';
ALTER TYPE "DynamicFormQuestionType" ADD VALUE 'file_upload';

-- AlterTable
ALTER TABLE "DynamicFormQuestion" ADD COLUMN "conditionalLogic" JSONB;
