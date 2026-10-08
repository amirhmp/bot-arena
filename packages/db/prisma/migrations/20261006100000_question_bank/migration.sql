-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "ComparisonRule" AS ENUM ('trimmed', 'strict', 'token');

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statementMdx" TEXT NOT NULL,
    "statementCompiled" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 256,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "comparison" "ComparisonRule" NOT NULL DEFAULT 'trimmed',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "stdin" TEXT NOT NULL DEFAULT '',
    "expectedOutput" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_updatedAt_idx" ON "Question"("updatedAt");

-- CreateIndex
CREATE INDEX "TestCase_questionId_position_idx" ON "TestCase"("questionId", "position");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
