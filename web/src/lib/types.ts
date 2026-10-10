/* API payload types — mirror backend/src/services + schemas (single source of truth). */

export type Role = 'ADMIN' | 'HR' | 'MANAGER' | 'ENGINEER'

export interface User {
  id: string
  name: string
  email: string
  employeeId: string
  role: Role
  phone: string | null
  isActive: boolean
  createdAt?: string
  /** Present on GET /users rows: active site assignments. */
  sites?: Array<{ id: string; name: string }>
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

/* ── Attendance ─────────────────────────────────────────────────────────── */

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'INCOMPLETE'
export type TeamStatus =
  | AttendanceStatus
  | 'NOT_CHECKED_IN'
  | 'ON_LEAVE'
  | 'ABSENT'
  | 'UPCOMING'

export interface PhotoSide {
  time: string
  lat: number
  lng: number
  accuracy: number
  distanceMeters: number | null
  photoEndpoint: string
  photoHash: string | null
}

export interface AttendanceRecordDetail {
  id: string
  date: string
  status: AttendanceStatus
  flags: string[]
  checkIn: PhotoSide
  checkOut: PhotoSide | null
  workedMinutes: number | null
  clientDriftSeconds: number | null
  deviceId: string
  site?: { id: string; name: string; lat: number; lng: number; radiusM: number }
  user?: { id: string; name: string; employeeId: string }
}

export interface TeamItem {
  user: { id: string; name: string; employeeId: string; phone: string | null }
  site: { id: string; name: string; lat: number; lng: number; radiusM: number }
  record: AttendanceRecordDetail | null
  leaveType: string | null
  status: TeamStatus
}

export interface TeamBoardResponse {
  date: string
  items: TeamItem[]
}

/* ── Sites ──────────────────────────────────────────────────────────────── */

export type OutOfRangeBehavior = 'REJECT' | 'FLAG'

export interface SiteAssignment {
  id: string
  userId: string
  siteId: string
  active: boolean
  createdAt: string
  user: { id: string; name: string; employeeId: string; role: Role; email?: string; phone?: string | null }
}

export interface Site {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radiusM: number
  outOfRangeBehavior: OutOfRangeBehavior
  shiftStart: string
  shiftEnd: string
  lateGraceMinutes: number
  halfDayMinutes: number
  isActive: boolean
  createdAt?: string
  assignments: SiteAssignment[]
}

export interface SiteInput {
  name: string
  address: string
  lat: number
  lng: number
  radiusM: number
  outOfRangeBehavior: OutOfRangeBehavior
  shiftStart: string
  shiftEnd: string
  lateGraceMinutes: number
  halfDayMinutes: number
}

/* ── Leave ──────────────────────────────────────────────────────────────── */

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface LeaveDocument {
  id: string
  originalName: string
  mime: string
  size: number
  endpoint: string
}

export interface LeaveRequest {
  id: string
  fromDate: string
  toDate: string
  days: number
  isHalfDay: boolean
  halfDayPeriod: 'AM' | 'PM' | null
  reason: string
  status: LeaveStatus
  decisionComment: string | null
  decidedAt: string | null
  decidedBy: { id: string; name: string } | null
  createdAt: string
  leaveType: { id: string; code: string; name: string; paid: boolean }
  documents: LeaveDocument[]
  user?: { id: string; name: string; employeeId: string }
}

export interface LeaveType {
  id: string
  code: string
  name: string
  annualQuota: number
  paid: boolean
  requiresDocument: boolean
  minNoticeDays: number
  maxConsecutiveDays: number | null
  allowHalfDay: boolean
  isActive: boolean
}

export interface LeaveTypeInput {
  code: string
  name: string
  annualQuota: number
  paid: boolean
  requiresDocument: boolean
  minNoticeDays: number
  maxConsecutiveDays: number | null
  allowHalfDay: boolean
}

export interface BalanceRow {
  year: number
  leaveType: { id: string; code: string; name: string; paid: boolean }
  allocated: number
  used: number
  pending: number
  available: number
}

/* ── Reports / notifications ────────────────────────────────────────────── */

export interface ReportJson {
  title: string
  subtitle: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface AppNotification {
  id: string
  userId: string
  title: string
  body: string
  type: string
  data: string | null
  readAt: string | null
  createdAt: string
}
