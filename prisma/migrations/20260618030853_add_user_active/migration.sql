-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyLimit" INTEGER NOT NULL DEFAULT 160,
    "dailyRemaining" INTEGER NOT NULL DEFAULT 160,
    "lastDailyReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowInputTimestamps" TEXT NOT NULL DEFAULT '[]',
    "windowQuizTimestamps" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_User" ("createdAt", "dailyLimit", "dailyRemaining", "id", "lastDailyReset", "passwordHash", "role", "username", "windowInputTimestamps", "windowQuizTimestamps") SELECT "createdAt", "dailyLimit", "dailyRemaining", "id", "lastDailyReset", "passwordHash", "role", "username", "windowInputTimestamps", "windowQuizTimestamps" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
