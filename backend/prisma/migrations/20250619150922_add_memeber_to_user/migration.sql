/*
  Warnings:

  - A unique constraint covering the columns `[memeberID]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "users_memeberID_key" ON "users"("memeberID");
