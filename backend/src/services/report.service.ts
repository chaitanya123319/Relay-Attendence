import { prisma } from '../lib/prisma';
import { Role } from '../lib/roles';
import { monthDates, todayStr, isWeeklyOff } from '../lib/time';
import { managedSiteIds } from './access.service';

export interface ReportActor {
  id: string;
  role: Role;
}

export interface ReportData {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  /** Relative column weights used by the PDF renderer. */
  widths?: number[];
  filenameBase: string;
}

interface ScopeEngineer {
  id: string;
  name: string;
  employeeId: string;
  siteName: string;
}

/**
 * Engineers visible to the actor: MANAGER → managed sites only (empty when
 * none); HR/ADMIN → company-wide. Optional siteId filter intersects scope.
 */
async function scopeEngineers(actor: ReportActor, siteId?: string): Promise<ScopeEngineer[]> {
  let siteFilter: string[] | undefined;
  if (actor.role === 'MANAGER') {
    const mine = await managedSiteIds(actor.id);
    if (mine.length === 0) return [];
    siteFilter = siteId ? mine.filter((s) => s === siteId) : mine;
    if (siteFilter.length === 0) return [];
  } else if (siteId) {
    siteFilter = [siteId];
  }

  const rows = await prisma.siteAssignment.findMany({
    where: {
      active: true,
      ...(siteFilter ? { siteId: { in: siteFilter } } : {}),
      user: { role: 'ENGINEER', isActive: true },
    },
    include: { user: true, site: true },
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Set<string>();
  const out: ScopeEngineer[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push({ id: r.user.id, name: r.user.name, employeeId: r.user.employeeId, siteName: r.site.name });
  }
  return out;
}

interface MonthStats {
  present: number;
  late: number;
  halfDay: number;
  incomplete: number;
  onLeave: number;
  absent: number;
  totalWorkedMinutes: number;
}

/** Per-user month rollup, shared by attendance + payroll reports. */
async function computeMonthStats(userId: string, month: string): Promise<MonthStats> {
  const dates = monthDates(month);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const today = todayStr();

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { userId, date: { gte: first, lte: last } } }),
    prisma.leaveRequest.findMany({
      where: { userId, status: 'APPROVED', fromDate: { lte: last }, toDate: { gte: first } },
    }),
  ]);

  const recordByDate = new Map(records.map((r) => [r.date, r]));
  const leaveDates = new Set<string>();
  for (const lv of leaves) {
    for (let d = lv.fromDate < first ? first : lv.fromDate; d <= (lv.toDate > last ? last : lv.toDate); d = nextDay(d)) {
      if (dates.includes(d)) leaveDates.add(d);
    }
  }

  const stats: MonthStats = { present: 0, late: 0, halfDay: 0, incomplete: 0, onLeave: 0, absent: 0, totalWorkedMinutes: 0 };
  for (const d of dates) {
    const record = recordByDate.get(d);
    if (record) {
      if (record.status === 'LATE') stats.late++;
      else if (record.status === 'HALF_DAY') stats.halfDay++;
      else if (record.status === 'INCOMPLETE') stats.incomplete++;
      else stats.present++;
      stats.totalWorkedMinutes += record.workedMinutes ?? 0;
      continue;
    }
    if (leaveDates.has(d)) {
      stats.onLeave++;
      continue;
    }
    if (!isWeeklyOff(d) && d <= today) stats.absent++;
  }
  return stats;
}

const nextDay = (d: string) => {
  const dt = new Date(`${d}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

const stamp = () => `Generated ${new Date().toISOString()} (company timezone: see backend .env COMPANY_TZ)`;

// ─────────────────────────────────────────────────────────────────────────────
// Report builders

export async function attendanceReport(
  actor: ReportActor,
  opts: { month?: string; siteId?: string },
): Promise<ReportData> {
  const month = opts.month ?? todayStr().slice(0, 7);
  const engineers = await scopeEngineers(actor, opts.siteId);
  const rows: Array<Array<string | number>> = [];
  for (const eng of engineers) {
    const s = await computeMonthStats(eng.id, month);
    rows.push([
      eng.employeeId,
      eng.name,
      eng.siteName,
      s.present,
      s.late,
      s.halfDay,
      s.incomplete,
      s.onLeave,
      s.absent,
      hours(s.totalWorkedMinutes),
    ]);
  }
  return {
    title: `Monthly Attendance Report — ${month}`,
    subtitle: stamp(),
    headers: ['Employee ID', 'Name', 'Site', 'Present', 'Late', 'Half-day', 'Incomplete', 'On leave', 'Absent', 'Worked hrs'],
    rows,
    widths: [8, 15, 18, 6, 5, 7, 8, 7, 6, 8],
    filenameBase: `attendance-report-${month}`,
  };
}

export async function leaveReport(
  actor: ReportActor,
  opts: { from?: string; to?: string },
): Promise<ReportData> {
  const month = todayStr().slice(0, 7);
  const from = opts.from ?? `${month}-01`;
  const to = opts.to ?? monthDates(month)[monthDates(month).length - 1];

  let userIds: string[] | null = null;
  if (actor.role === 'MANAGER') {
    const engineers = await scopeEngineers(actor);
    if (engineers.length === 0) userIds = [];
    else userIds = engineers.map((e) => e.id);
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      fromDate: { lte: to },
      toDate: { gte: from },
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    include: {
      user: { select: { name: true, employeeId: true } },
      leaveType: true,
      decidedBy: { select: { name: true } },
    },
    orderBy: { fromDate: 'desc' },
  });

  const rows = requests.map((r) => [
    r.user.employeeId,
    r.user.name,
    r.leaveType.name,
    r.fromDate,
    r.toDate,
    r.days,
    r.status,
    r.decidedBy?.name ?? '—',
    r.decidedAt ? r.decidedAt.toISOString().slice(0, 10) : '—',
    r.decisionComment ?? '',
  ]);

  return {
    title: `Leave Report — ${from} → ${to}`,
    subtitle: stamp(),
    headers: ['Employee ID', 'Name', 'Type', 'From', 'To', 'Days', 'Status', 'Decided by', 'Decided on', 'Comment'],
    rows,
    widths: [9, 13, 12, 8, 8, 5, 8, 12, 9, 20],
    filenameBase: `leave-report-${from}_${to}`,
  };
}

export async function payrollReport(
  actor: ReportActor,
  opts: { month?: string },
): Promise<ReportData> {
  const month = opts.month ?? todayStr().slice(0, 7);
  const monthDays = monthDates(month);
  const workingDays = monthDays.filter((d) => !isWeeklyOff(d)).length;
  const first = monthDays[0];
  const last = monthDays[monthDays.length - 1];

  const engineers = await scopeEngineers(actor);
  const rows: Array<Array<string | number>> = [];

  for (const eng of engineers) {
    const s = await computeMonthStats(eng.id, month);

    // Paid vs unpaid approved leave days inside the month.
    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: eng.id, status: 'APPROVED', fromDate: { lte: last }, toDate: { gte: first } },
      include: { leaveType: { select: { paid: true } } },
    });
    let paidLeave = 0;
    let unpaidLeave = 0;
    for (const lv of leaves) {
      const overlapFrom = lv.fromDate < first ? first : lv.fromDate;
      const overlapTo = lv.toDate > last ? last : lv.toDate;
      let n = 0;
      if (lv.isHalfDay) {
        n = overlapFrom <= lv.fromDate && lv.fromDate <= overlapTo ? 0.5 : 0;
      } else {
        for (let d = overlapFrom; d <= overlapTo; d = nextDay(d)) if (monthDays.includes(d)) n++;
      }
      if (lv.leaveType.paid) paidLeave += n;
      else unpaidLeave += n;
    }

    rows.push([
      eng.employeeId,
      eng.name,
      eng.siteName,
      workingDays,
      s.present + s.late,
      s.halfDay,
      s.absent,
      paidLeave,
      unpaidLeave,
      hours(s.totalWorkedMinutes),
    ]);
  }

  return {
    title: `Payroll Summary — ${month}`,
    subtitle: `${stamp()} · Working days = Mon–Sat (Sunday weekly off) · Payroll input, not payslip`,
    headers: ['Employee ID', 'Name', 'Site', 'Working days', 'Days worked', 'Half-days', 'Absent', 'Paid leave', 'Unpaid leave', 'Worked hrs'],
    rows,
    widths: [9, 14, 16, 8, 7, 7, 6, 7, 8, 8],
    filenameBase: `payroll-summary-${month}`,
  };
}
