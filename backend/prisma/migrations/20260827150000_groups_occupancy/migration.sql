-- AlterTable
ALTER TABLE "members" ADD COLUMN "groupId" TEXT;
ALTER TABLE "members" ADD COLUMN "discountForfait" DOUBLE PRECISION;
ALTER TABLE "members" ADD COLUMN "discountSalle" DOUBLE PRECISION;
ALTER TABLE "members" ADD COLUMN "discountOpenSpace" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "member_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 15,
    "discountForfait" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountSalle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountOpenSpace" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_groupId_idx" ON "members"("groupId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "member_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "journals" ADD COLUMN "groupVisitId" TEXT;

-- CreateIndex
CREATE INDEX "journals_groupVisitId_idx" ON "journals"("groupVisitId");
