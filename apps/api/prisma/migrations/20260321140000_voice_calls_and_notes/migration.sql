-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'NOTA_VOZ';
ALTER TYPE "MessageKind" ADD VALUE 'LLAMADA_PERDIDA';
ALTER TYPE "MessageKind" ADD VALUE 'LLAMADA_FINALIZADA';

-- CreateEnum
CREATE TYPE "MeetingCallType" AS ENUM ('VIDEO', 'VOZ');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN "callType" "MeetingCallType" NOT NULL DEFAULT 'VIDEO';
