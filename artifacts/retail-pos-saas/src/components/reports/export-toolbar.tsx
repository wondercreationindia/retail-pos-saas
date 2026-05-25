import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown, Share2 } from "lucide-react";
import { type ExportColumn, exportCSV, exportExcel, exportPDF, printReport } from "@/lib/export";

type Props = {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title: string;
  subtitle?: string;
  summaryRows?: { label: string; value: string }[];
  printElementId?: string;
  landscape?: boolean;
  count?: number;
};

export function ExportToolbar({ data, columns, filename, title, subtitle, summaryRows, printElementId, landscape, count }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "csv" | "excel" | "pdf") {
    setExporting(true);
    try {
      if (format === "csv") exportCSV(data, columns, filename);
      else if (format === "excel") exportExcel(data, columns, filename, "Report", summaryRows);
      else exportPDF(data, columns, filename, title, subtitle, summaryRows, landscape);
      await logExport(format, data.length);
    } finally {
      setExporting(false);
    }
  }

  async function handlePrint() {
    if (printElementId) printReport(printElementId, title);
    else window.print();
    await logExport("print", data.length);
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Report link copied to clipboard!");
    } catch {
      alert("Share: Copy the URL from the address bar.");
    }
  }

  async function logExport(format: string, rowCount: number) {
    const token = localStorage.getItem("pos_token");
    await fetch("/api/reports/log-export", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ reportType: filename, exportFormat: format, rowCount }),
    }).catch(() => {});
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      {count !== undefined && (
        <span className="text-sm text-muted-foreground mr-2">{count.toLocaleString()} records</span>
      )}
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => handlePrint()}>
        <Printer className="h-3.5 w-3.5" />
        Print
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleShare}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5" disabled={exporting || data.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            <FileText className="h-4 w-4 mr-2 text-green-600" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-700" />
            Export as Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4 mr-2 text-red-600" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
