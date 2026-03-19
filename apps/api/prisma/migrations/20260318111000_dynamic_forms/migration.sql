-- CreateEnum
CREATE TYPE "DynamicFormQuestionType" AS ENUM ('short_text', 'long_text', 'multiple_choice', 'checkbox', 'rating', 'date');

-- CreateTable
CREATE TABLE "DynamicForm" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "projectId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "allowMultipleSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicFormQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formId" UUID NOT NULL,
    "type" "DynamicFormQuestionType" NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicFormQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicFormResponse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formId" UUID NOT NULL,
    "userId" UUID,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DynamicFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicFormAnswer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "responseId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "DynamicFormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DynamicForm_createdById_createdAt_idx" ON "DynamicForm"("createdById", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DynamicForm_projectId_isActive_createdAt_idx" ON "DynamicForm"("projectId", "isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DynamicForm_isActive_createdAt_idx" ON "DynamicForm"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DynamicFormQuestion_formId_order_key" ON "DynamicFormQuestion"("formId", "order");

-- CreateIndex
CREATE INDEX "DynamicFormQuestion_formId_idx" ON "DynamicFormQuestion"("formId");

-- CreateIndex
CREATE INDEX "DynamicFormResponse_formId_submittedAt_idx" ON "DynamicFormResponse"("formId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "DynamicFormResponse_userId_idx" ON "DynamicFormResponse"("userId");

-- CreateIndex
CREATE INDEX "DynamicFormResponse_formId_userId_idx" ON "DynamicFormResponse"("formId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicFormAnswer_responseId_questionId_key" ON "DynamicFormAnswer"("responseId", "questionId");

-- CreateIndex
CREATE INDEX "DynamicFormAnswer_questionId_idx" ON "DynamicFormAnswer"("questionId");

-- AddForeignKey
ALTER TABLE "DynamicForm" ADD CONSTRAINT "DynamicForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicForm" ADD CONSTRAINT "DynamicForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicFormQuestion" ADD CONSTRAINT "DynamicFormQuestion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "DynamicForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicFormResponse" ADD CONSTRAINT "DynamicFormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "DynamicForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicFormResponse" ADD CONSTRAINT "DynamicFormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicFormAnswer" ADD CONSTRAINT "DynamicFormAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "DynamicFormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicFormAnswer" ADD CONSTRAINT "DynamicFormAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "DynamicFormQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
