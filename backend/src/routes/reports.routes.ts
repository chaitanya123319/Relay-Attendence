import { Response, Router } from 'express';
import { writeAudit } from '../lib/audit';
import { toCsv } from '../lib/csv';
import { asyncHandler } from '../lib/errors';
import { renderReportPdf } from '../lib/pdf';
import { authenticate, requireRole } from '../middleware/auth';
import { parseOrThrow } from '../middleware/validate';
import {
  attendanceReportQuerySchema,
  leaveReportQuerySchema,
  payrollReportQuerySchema,
} from '../schemas/report.schema';
import * as reportService from '../services/report.service';
import { ReportData } from '../services/report.service';

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireRole('MANAGER', 'HR', 'ADMIN'));

async function respondReport(
  res: Response,
  format: 'json' | 'csv' | 'pdf',
  data: ReportData,
): Promise<void> {
  if (format === 'json') {
    res.json({ title: data.title, subtitle: data.subtitle, columns: data.headers, rows: data.rows });
    return;
  }
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${data.filenameBase}.csv"`);
    // BOM keeps Excel happy with UTF-8
    res.send('\uFEFF' + toCsv(data.headers, data.rows));
    return;
  }
  const pdf = await renderReportPdf(data.title, data.subtitle, data.headers, data.rows, data.widths);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.filenameBase}.pdf"`);
  res.send(pdf);
}

reportsRouter.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(attendanceReportQuerySchema, req.query);
    const data = await reportService.attendanceReport(req.user!, q);
    await writeAudit({
      actorId: req.user!.id,
      action: 'REPORT_EXPORT',
      entity: 'Report',
      meta: { kind: 'attendance', format: q.format, month: q.month, siteId: q.siteId },
      ip: req.ip,
    });
    await respondReport(res, q.format, data);
  }),
);

reportsRouter.get(
  '/leave',
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(leaveReportQuerySchema, req.query);
    const data = await reportService.leaveReport(req.user!, q);
    await writeAudit({
      actorId: req.user!.id,
      action: 'REPORT_EXPORT',
      entity: 'Report',
      meta: { kind: 'leave', format: q.format, from: q.from, to: q.to },
      ip: req.ip,
    });
    await respondReport(res, q.format, data);
  }),
);

reportsRouter.get(
  '/payroll',
  requireRole('HR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const q = parseOrThrow(payrollReportQuerySchema, req.query);
    const data = await reportService.payrollReport(req.user!, q);
    await writeAudit({
      actorId: req.user!.id,
      action: 'REPORT_EXPORT',
      entity: 'Report',
      meta: { kind: 'payroll', format: q.format, month: q.month },
      ip: req.ip,
    });
    await respondReport(res, q.format, data);
  }),
);
