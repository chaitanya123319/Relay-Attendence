import PDFDocument from 'pdfkit';

/**
 * Minimal report PDF renderer: title block + paginated table with repeated
 * headers. Column widths are relative weights. Pure pdfkit — no wkhtmltopdf
 * or headless browser needed.
 */
export function renderReportPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  widths?: number[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const usable = doc.page.width - left - doc.page.margins.right;
    const weights = widths ?? headers.map(() => 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const colW = weights.map((w) => (w / totalWeight) * usable);
    const bottom = doc.page.height - doc.page.margins.bottom - 14;

    const rowHeight = (cells: Array<string | number>, font: string, size: number): number =>
      Math.max(
        ...cells.map((c, i) =>
          doc.font(font).fontSize(size).heightOfString(String(c ?? ''), { width: colW[i] - 8 }),
        ),
        size + 4,
      );

    const drawRow = (cells: Array<string | number>, isHeader: boolean) => {
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
      const size = isHeader ? 8.5 : 8.5;
      let h = rowHeight(cells, font, size);
      if (doc.y + h > bottom) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        if (!isHeader) {
          drawRow(headers, true); // repeat the header on each page
          h = rowHeight(cells, font, size);
        }
      }
      const y = doc.y;
      let x = left;
      cells.forEach((c, i) => {
        doc
          .font(font)
          .fontSize(size)
          .fillColor(isHeader ? '#111111' : '#333333')
          .text(String(c ?? ''), x + 3, y + 2, { width: colW[i] - 8 });
        x += colW[i];
      });
      doc
        .moveTo(left, y + h)
        .lineTo(left + usable, y + h)
        .lineWidth(0.4)
        .strokeColor(isHeader ? '#999999' : '#dddddd')
        .stroke();
      doc.y = y + h + 2;
    };

    // ── Header block
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('RELAY Attendance');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(11).fillColor('#222222').text(title);
    doc.fontSize(8.5).fillColor('#666666').text(subtitle);
    doc.moveDown(0.7);

    drawRow(headers, true);
    for (const r of rows) drawRow(r, false);

    doc.end();
  });
}
