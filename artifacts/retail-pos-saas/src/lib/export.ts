import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn = {
  header: string;
  key: string;
  width?: number;
  format?: "currency" | "number" | "percent" | "date" | "text";
};

function formatCell(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "";
  if (format === "currency") return `₹${Number(value).toFixed(2)}`;
  if (format === "percent") return `${Number(value).toFixed(1)}%`;
  if (format === "number") return String(Number(value));
  if (format === "date") return value instanceof Date ? value.toLocaleDateString("en-IN") : String(value).split("T")[0] ?? "";
  return String(value);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportCSV(data: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const header = columns.map((c) => c.header).join(",");
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = formatCell(row[c.key], c.format);
      return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), filename + ".csv");
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export function exportExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  sheetName = "Report",
  summaryRows?: { label: string; value: string }[]
) {
  const wb = XLSX.utils.book_new();

  const headerRow = columns.map((c) => c.header);
  const dataRows = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (c.format === "currency" || c.format === "number" || c.format === "percent") {
        return typeof val === "number" ? val : parseFloat(String(val ?? 0)) || 0;
      }
      return formatCell(val, c.format);
    })
  );

  const wsData: unknown[][] = [headerRow, ...dataRows];

  if (summaryRows && summaryRows.length > 0) {
    wsData.push([]);
    for (const s of summaryRows) wsData.push([s.label, s.value]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 4, 12) }));

  // Bold header row
  for (let i = 0; i < columns.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "4472C4" } } };
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename + ".xlsx");
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title: string,
  subtitle?: string,
  summaryRows?: { label: string; value: string }[],
  landscape = false
) {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(title, pageW / 2, 16, { align: "center" });
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageW / 2, 23, { align: "center" });
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageW - 14, 10, { align: "right" });

  const headers = columns.map((c) => c.header);
  const rows = data.map((row) => columns.map((c) => formatCell(row[c.key], c.format)));

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: subtitle ? 28 : 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [68, 114, 196], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    },
  });

  if (summaryRows && summaryRows.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    for (let i = 0; i < summaryRows.length; i++) {
      const s = summaryRows[i]!;
      doc.text(`${s.label}: ${s.value}`, 14, finalY + i * 6);
    }
  }

  doc.save(filename + ".pdf");
}

// ─── Print ────────────────────────────────────────────────────────────────────

export function printReport(elementId: string, title: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const original = document.body.innerHTML;
  document.body.innerHTML = `
    <div class="print-container">
      <div class="print-header">
        <h2 style="margin:0;font-size:18px;">${title}</h2>
        <p style="margin:4px 0 0;font-size:11px;color:#666;">Generated: ${new Date().toLocaleString("en-IN")}</p>
      </div>
      ${el.outerHTML}
    </div>`;
  window.print();
  document.body.innerHTML = original;
  window.location.reload();
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
