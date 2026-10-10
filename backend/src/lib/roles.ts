/** Central role/status/flag constants — SQLite has no enums, so the unions live here. */

export const ROLES = ['ADMIN', 'HR', 'MANAGER', 'ENGINEER'] as const;
export type Role = (typeof ROLES)[number];

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'HALF_DAY', 'INCOMPLETE'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_FLAGS = ['OUT_OF_RANGE', 'TIME_DRIFT'] as const;
export type AttendanceFlag = (typeof ATTENDANCE_FLAGS)[number];

export const OUT_OF_RANGE_BEHAVIORS = ['REJECT', 'FLAG'] as const;
export type OutOfRangeBehavior = (typeof OUT_OF_RANGE_BEHAVIORS)[number];

export const HALF_DAY_PERIODS = ['AM', 'PM'] as const;
export type HalfDayPeriod = (typeof HALF_DAY_PERIODS)[number];

export const NOTIFICATION_TYPES = [
  'LEAVE_SUBMITTED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'LEAVE_CANCELLED',
  'ATTENDANCE_FLAGGED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
