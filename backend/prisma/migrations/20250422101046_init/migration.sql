-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('MENSUEL', 'JOURNALIER');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('journal', 'abonnement');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Subscription" AS ENUM ('Journal', 'Membership');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "deletedAt" TIMESTAMP(6),
    "email" VARCHAR(256),
    "fullname" VARCHAR(256),
    "password" TEXT,
    "refreshToken" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "resetPasswordToken" TEXT,
    "accessToken" TEXT,
    "phoneNumber" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(256),
    "firstName" VARCHAR(56),
    "lastName" VARCHAR(56),
    "bio" TEXT,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plan" "Subscription" DEFAULT 'Journal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "deletedAt" TIMESTAMP(6),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "functionality" TEXT,
    "phone" INTEGER,
    "userId" INTEGER,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "type" "PriceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "timePeriod" JSONB NOT NULL,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journals" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "memberID" TEXT,
    "isReservation" BOOLEAN NOT NULL DEFAULT false,
    "priceId" TEXT,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonnements" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredDate" TIMESTAMP(3) NOT NULL,
    "leaveDate" TIMESTAMP(3),
    "stayedPeriode" TEXT,
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),
    "memberID" TEXT NOT NULL,
    "isReservation" BOOLEAN NOT NULL DEFAULT false,
    "priceId" TEXT NOT NULL,

    CONSTRAINT "abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "isPayed" BOOLEAN NOT NULL,
    "registredTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "payedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "memberID" TEXT,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prix_achat" DOUBLE PRECISION NOT NULL,
    "prix_vente" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL,
    "img" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prix" DOUBLE PRECISION NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_JournalExpenses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "_JournalExpenses_AB_unique" ON "_JournalExpenses"("A", "B");

-- CreateIndex
CREATE INDEX "_JournalExpenses_B_index" ON "_JournalExpenses"("B");

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journals" ADD CONSTRAINT "journals_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_memberID_fkey" FOREIGN KEY ("memberID") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JournalExpenses" ADD CONSTRAINT "_JournalExpenses_A_fkey" FOREIGN KEY ("A") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JournalExpenses" ADD CONSTRAINT "_JournalExpenses_B_fkey" FOREIGN KEY ("B") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
