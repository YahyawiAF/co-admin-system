-- Default new members to open collaboration + directory (messages)
ALTER TABLE "members" ALTER COLUMN "openToCollaboration" SET DEFAULT true;
ALTER TABLE "members" ALTER COLUMN "showInDirectory" SET DEFAULT true;
