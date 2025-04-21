-- CreateTable
CREATE TABLE "_ExpenseToJournal" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ExpenseToJournal_AB_unique" ON "_ExpenseToJournal"("A", "B");

-- CreateIndex
CREATE INDEX "_ExpenseToJournal_B_index" ON "_ExpenseToJournal"("B");

-- AddForeignKey
ALTER TABLE "_ExpenseToJournal" ADD CONSTRAINT "_ExpenseToJournal_A_fkey" FOREIGN KEY ("A") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpenseToJournal" ADD CONSTRAINT "_ExpenseToJournal_B_fkey" FOREIGN KEY ("B") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
