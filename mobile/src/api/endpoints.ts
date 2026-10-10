import { api } from '../lib/api';
import type {
  AuthSession,
  BalanceRow,
  CheckResult,
  HistoryResponse,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  NotificationItem,
  SiteWithAssignments,
  SummaryResponse,
  User,
} from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (identifier: string, password: string) =>
    api.post<AuthSession>('/api/auth/login', { identifier, password }).then((r) => r.data),
  me: () => api.get<User>('/api/auth/me').then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post<{ ok: boolean }>('/api/auth/logout', { refreshToken }).then((r) => r.data),
};

// ── Attendance ───────────────────────────────────────────────────────────────

export interface CapturePayload {
  lat: number;
  lng: number;
  accuracy: number;
  mocked: boolean;
  siteId?: string;
  photo: { uri: string; name: string; mimeType: string };
}

function buildCaptureForm(payload: CapturePayload, deviceId: string): FormData {
  const form = new FormData();
  form.append('lat', String(payload.lat));
  form.append('lng', String(payload.lng));
  form.append('accuracy', String(payload.accuracy));
  form.append('clientTimestamp', new Date().toISOString());
  form.append('deviceId', deviceId);
  form.append('mocked', payload.mocked ? 'true' : 'false');
  // Attendance is live-camera only — the server rejects anything else.
  form.append('captureSource', 'camera');
  if (payload.siteId) form.append('siteId', payload.siteId);
  form.append('photo', {
    uri: payload.photo.uri,
    name: payload.photo.name,
    type: payload.photo.mimeType,
  } as unknown as Blob);
  return form;
}

export const attendanceApi = {
  checkIn: (payload: CapturePayload, deviceId: string) =>
    api
      .post<CheckResult>('/api/attendance/check-in', buildCaptureForm(payload, deviceId))
      .then((r) => r.data),
  checkOut: (payload: CapturePayload, deviceId: string) =>
    api
      .post<CheckResult>('/api/attendance/check-out', buildCaptureForm(payload, deviceId))
      .then((r) => r.data),
  history: (params: { from?: string; to?: string; page?: number; pageSize?: number }) =>
    api.get<HistoryResponse>('/api/attendance/me', { params }).then((r) => r.data),
  summary: (month: string) =>
    api.get<SummaryResponse>('/api/attendance/me/summary', { params: { month } }).then((r) => r.data),
};

// ── Leave ────────────────────────────────────────────────────────────────────

export interface ApplyLeavePayload {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: 'AM' | 'PM';
  reason: string;
  document?: { uri: string; name: string; mimeType: string };
}

export const leaveApi = {
  types: () => api.get<LeaveType[]>('/api/leave/types').then((r) => r.data),
  balances: (year?: number) =>
    api
      .get<BalanceRow[]>('/api/leave/balances/me', { params: year ? { year } : {} })
      .then((r) => r.data),
  requests: (status?: LeaveStatus) =>
    api
      .get<LeaveRequest[]>('/api/leave/requests/me', { params: status ? { status } : {} })
      .then((r) => r.data),
  apply: (payload: ApplyLeavePayload) => {
    const form = new FormData();
    form.append('leaveTypeId', payload.leaveTypeId);
    form.append('fromDate', payload.fromDate);
    form.append('toDate', payload.toDate);
    form.append('isHalfDay', payload.isHalfDay ? 'true' : 'false');
    if (payload.isHalfDay && payload.halfDayPeriod) form.append('halfDayPeriod', payload.halfDayPeriod);
    form.append('reason', payload.reason);
    if (payload.document) {
      form.append('document', {
        uri: payload.document.uri,
        name: payload.document.name,
        type: payload.document.mimeType,
      } as unknown as Blob);
    }
    return api.post<LeaveRequest>('/api/leave/requests', form).then((r) => r.data);
  },
  cancel: (id: string) =>
    api.post<LeaveRequest>(`/api/leave/requests/${id}/cancel`).then((r) => r.data),
};

// ── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api
      .get<NotificationItem[]>('/api/notifications/me', {
        params: unreadOnly ? { unreadOnly: 'true' } : {},
      })
      .then((r) => r.data),
  markRead: (id: string) =>
    api.post<{ ok: boolean; updated: number }>(`/api/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () =>
    api.post<{ ok: boolean; updated: number }>('/api/notifications/read-all').then((r) => r.data),
  registerPushToken: (token: string, platform: string) =>
    api.post<{ ok: boolean }>('/api/notifications/push-token', { token, platform }).then((r) => r.data),
};

// ── Uploads / signed URLs ────────────────────────────────────────────────────

export const uploadsApi = {
  /** Exchange an authenticated session for an expiring signed URL (for <Image>). */
  sign: (path: string) =>
    api
      .post<{ url: string; expiresAt: string }>('/api/uploads/signed-url', { path })
      .then((r) => r.data),
};

// ── Sites ────────────────────────────────────────────────────────────────────

export const sitesApi = {
  list: () => api.get<SiteWithAssignments[]>('/api/sites').then((r) => r.data),
};
