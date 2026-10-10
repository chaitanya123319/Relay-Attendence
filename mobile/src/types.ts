/** API response shapes — mirrors the backend routes/services (source of truth). */

export type Role = 'ADMIN' | 'HR' | 'MANAGER' | 'ENGINEER';

export interface User {
  id: string;
  email: string;
  employeeId: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface SiteInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface SiteWithAssignments extends SiteInfo {
  isActive: boolean;
  outOfRangeBehavior: string;
  assignments: { id: string; userId: string; user: { id: string; name: string; employeeId: string; role: Role } }[];
}

export interface AttendanceEventInfo {
  time: string;
  lat: number;
  lng: number;
  accuracy: number;
  distanceMeters: number | null;
  photoEndpoint: string;
  photoHash: string | null;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'INCOMPLETE';

export interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  flags: string[];
  checkIn: AttendanceEventInfo;
  checkOut: AttendanceEventInfo | null;
  workedMinutes: number | null;
  clientDriftSeconds?: number | null;
  deviceId?: string;
  site?: SiteInfo;
}

export interface HistoryResponse {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CheckResult {
  record: AttendanceRecord;
  distanceMeters: number;
  flags: string[];
  message: string;
}

export interface SummaryCounts {
  present: number;
  late: number;
  halfDay: number;
  incomplete: number;
  absent: number;
  onLeave: number;
  weeklyOff: number;
  totalWorkedMinutes: number;
}

export interface SummaryDay {
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  leaveType?: string;
}

export interface SummaryResponse {
  month: string;
  summary: SummaryCounts;
  days: SummaryDay[];
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  annualQuota: number;
  paid: boolean;
  requiresDocument: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
  allowHalfDay: boolean;
  isActive: boolean;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveDocument {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  endpoint: string;
}

export interface LeaveRequest {
  id: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay: boolean;
  halfDayPeriod: 'AM' | 'PM' | null;
  reason: string;
  status: LeaveStatus;
  decisionComment: string | null;
  decidedAt: string | null;
  decidedBy: { id: string; name: string } | null;
  createdAt: string;
  leaveType: { id: string; code: string; name: string; paid: boolean };
  documents: LeaveDocument[];
}

export interface BalanceRow {
  year: number;
  leaveType: { id: string; code: string; name: string; paid: boolean };
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
