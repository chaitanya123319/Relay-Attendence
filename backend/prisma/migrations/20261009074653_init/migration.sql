-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 150,
    "outOfRangeBehavior" TEXT NOT NULL DEFAULT 'REJECT',
    "shiftStart" TEXT NOT NULL DEFAULT '09:00',
    "shiftEnd" TEXT NOT NULL DEFAULT '18:00',
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayMinutes" INTEGER NOT NULL DEFAULT 240,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assignedById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "SiteAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "checkInTime" DATETIME NOT NULL,
    "checkOutTime" DATETIME,
    "checkInLat" REAL NOT NULL,
    "checkInLng" REAL NOT NULL,
    "checkInAccuracy" REAL NOT NULL,
    "checkInDistanceM" REAL NOT NULL,
    "checkInPhotoPath" TEXT NOT NULL,
    "checkInPhotoHash" TEXT NOT NULL,
    "checkOutLat" REAL,
    "checkOutLng" REAL,
    "checkOutAccuracy" REAL,
    "checkOutDistanceM" REAL,
    "checkOutPhotoPath" TEXT,
    "checkOutPhotoHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "flags" TEXT NOT NULL DEFAULT '[]',
    "workedMinutes" INTEGER,
    "clientDriftSeconds" INTEGER,
    "deviceId" TEXT,
    "checkInIp" TEXT,
    "checkOutIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualQuota" REAL NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveDays" INTEGER,
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" REAL NOT NULL DEFAULT 0,
    "used" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "days" REAL NOT NULL,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayPeriod" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionComment" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSite_name_key" ON "ProjectSite"("name");

-- CreateIndex
CREATE INDEX "SiteAssignment_siteId_active_idx" ON "SiteAssignment"("siteId", "active");

-- CreateIndex
CREATE INDEX "SiteAssignment_userId_active_idx" ON "SiteAssignment"("userId", "active");

-- CreateIndex
CREATE INDEX "AttendanceRecord_siteId_date_idx" ON "AttendanceRecord"("siteId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_date_key" ON "AttendanceRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_leaveTypeId_year_key" ON "LeaveBalance"("userId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_status_idx" ON "LeaveRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_createdAt_idx" ON "LeaveRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
