import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter, type DateRange } from "@/components/reports/date-range-filter";
import { ExportToolbar } from "@/components/reports/export-toolbar";
import { type ExportColumn } from "@/lib/export";
import {
  useSalesReport, usePurchaseReport, useGstReport,
  useStockValuationReport, useLowStockReport, useDeadStockReport,
  useCustomerLedgerReport, useSupplierLedgerReport,
  usePaymentCollectionReport, useCashierShiftReport,
  useExpenseReport, useDailyClosingReport,
  type ReportFilters,
} from "@/hooks/use-report-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, AlertTriangle,
  Users, Truck, CreditCard, Receipt, Calendar, Search, ChevronRight,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function today() { return new Date().toISOString().split("T")[0]!; }
function firstOfMonth() { return today().substring(0, 7) + "-01"; }

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SummaryCard({ title, value, sub, icon: Icon, color = "blue" }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600",
    orange: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="border border-gray-100 shadow-none">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg flex-shrink-0 ${colors[color] ?? colors.blue}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportShell({ title, subtitle, toolbar, filters, children }: {
  title: string; subtitle?: string;
  toolbar?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {toolbar}
      </div>
      {/* Filters bar */}
      {filters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 mb-4 flex flex-wrap gap-2 items-center print:hidden">
          {filters}
        </div>
      )}
      {/* Content */}
      <div className="flex-1 space-y-4">{children}</div>
    </div>
  );
}

function DataTable({ id, cols, children }: { id?: string; cols: number; children: React.ReactNode }) {
  return (
    <Card className="border border-gray-100 shadow-none">
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg" id={id}>
          <Table>
            {children}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyRow({ cols, message = "No data for this period" }: { cols: number; message?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-16 text-muted-foreground text-sm">{message}</TableCell>
    </TableRow>
  );
}

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

// ─── SALES REPORT ─────────────────────────────────────────────────────────────

function SalesReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [status, setStatus] = useState("completed");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today(), status: "completed" });
  const { data, isLoading } = useSalesReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.saleNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.cashierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Sale #", key: "saleNumber" }, { header: "Date", key: "date", format: "date" },
    { header: "Customer", key: "customerName" }, { header: "Cashier", key: "cashierName" },
    { header: "Status", key: "status" }, { header: "Subtotal", key: "subtotal", format: "currency", width: 14 },
    { header: "Discount", key: "discountAmount", format: "currency" }, { header: "Tax (GST)", key: "taxAmount", format: "currency" },
    { header: "Total", key: "total", format: "currency", width: 14 }, { header: "Payment", key: "paymentStatus" },
  ];

  return (
    <ReportShell
      title="Sales Report"
      subtitle={`${rows.length} transactions`}
      toolbar={
        <ExportToolbar
          data={rows as unknown as Record<string, unknown>[]} columns={cols}
          filename={`sales-report-${range.dateFrom}-${range.dateTo}`}
          title="Sales Report" subtitle={`${range.dateFrom} to ${range.dateTo}`}
          summaryRows={[
            { label: "Total Revenue", value: fmt(data?.totals.total) },
            { label: "Total Tax", value: fmt(data?.totals.tax) },
            { label: "Discount", value: fmt(data?.totals.discount) },
          ]}
          count={rows.length} landscape
        />
      }
      filters={
        <>
          <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters({ ...range, status })} isLoading={isLoading} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[120px] text-sm bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm w-[180px] bg-white" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard title="Total Revenue" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} orders`} icon={ShoppingCart} color="blue" />
        <SummaryCard title="Subtotal" value={fmt(data?.totals.subtotal)} icon={TrendingUp} color="green" />
        <SummaryCard title="Tax Collected" value={fmt(data?.totals.tax)} icon={Receipt} color="orange" />
        <SummaryCard title="Discount Given" value={fmt(data?.totals.discount)} icon={TrendingDown} color="red" />
      </div>
      <DataTable id="sales-table" cols={10}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Sale #</TableHead><TableHead className="font-medium">Date</TableHead>
            <TableHead className="font-medium">Customer</TableHead><TableHead className="font-medium">Cashier</TableHead>
            <TableHead className="font-medium">Status</TableHead><TableHead className="text-right font-medium">Subtotal</TableHead>
            <TableHead className="text-right font-medium">Discount</TableHead><TableHead className="text-right font-medium">GST</TableHead>
            <TableHead className="text-right font-medium">Total</TableHead><TableHead className="font-medium">Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={10} /> : rows.length === 0 ? <EmptyRow cols={10} message="No sales found. Adjust filters and click Run." /> : rows.map((r) => (
            <TableRow key={r.id} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-mono text-xs text-blue-600">{r.saleNumber}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{new Date(r.date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
              <TableCell className="max-w-[120px] truncate">{r.customerName ?? <span className="text-muted-foreground text-xs">Walk-in</span>}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.cashierName ?? "—"}</TableCell>
              <TableCell><Badge variant={r.status === "completed" ? "default" : "destructive"} className="text-xs">{r.status}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.subtotal)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-600">-{fmt(r.discountAmount)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.taxAmount)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmt(r.total)}</TableCell>
              <TableCell><Badge variant={r.paymentStatus === "paid" ? "outline" : "secondary"} className="text-xs">{r.paymentStatus}</Badge></TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-blue-50/60 font-semibold text-sm">
              <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">Totals</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(data?.totals.subtotal)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-600">-{fmt(data?.totals.discount)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(data?.totals.tax)}</TableCell>
              <TableCell className="text-right tabular-nums text-blue-700">{fmt(data?.totals.total)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── PURCHASE REPORT ──────────────────────────────────────────────────────────

function PurchaseReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = usePurchaseReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.purchaseNumber.toLowerCase().includes(search.toLowerCase()) || (r.supplierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "PO #", key: "purchaseNumber" }, { header: "Invoice #", key: "invoiceNumber" },
    { header: "Date", key: "date", format: "date" }, { header: "Supplier", key: "supplierName" },
    { header: "Status", key: "status" }, { header: "Subtotal", key: "subtotal", format: "currency" },
    { header: "Tax", key: "taxAmount", format: "currency" }, { header: "Discount", key: "discountAmount", format: "currency" },
    { header: "Total", key: "total", format: "currency" }, { header: "Paid", key: "paidAmount", format: "currency" },
    { header: "Pay Status", key: "paymentStatus" },
  ];

  return (
    <ReportShell
      title="Purchase Report"
      subtitle={`${rows.length} orders`}
      toolbar={<ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`purchase-report-${range.dateFrom}`} title="Purchase Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={rows.length} landscape />}
      filters={
        <>
          <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm w-[180px] bg-white" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard title="Total Purchases" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} orders`} icon={Truck} color="blue" />
        <SummaryCard title="Amount Paid" value={fmt(data?.totals.paid)} icon={TrendingUp} color="green" />
        <SummaryCard title="Tax (GST)" value={fmt(data?.totals.tax)} icon={Receipt} color="orange" />
        <SummaryCard title="Discount" value={fmt(data?.totals.discount)} icon={TrendingDown} color="red" />
      </div>
      <DataTable cols={11}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">PO #</TableHead><TableHead className="font-medium">Invoice #</TableHead>
            <TableHead className="font-medium">Date</TableHead><TableHead className="font-medium">Supplier</TableHead>
            <TableHead className="font-medium">Status</TableHead><TableHead className="text-right font-medium">Subtotal</TableHead>
            <TableHead className="text-right font-medium">Tax</TableHead><TableHead className="text-right font-medium">Total</TableHead>
            <TableHead className="text-right font-medium">Paid</TableHead><TableHead className="font-medium">Pay Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={10} /> : rows.length === 0 ? <EmptyRow cols={10} message="No purchases found. Adjust filters and click Run." /> : rows.map((r) => (
            <TableRow key={r.id} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-mono text-xs text-blue-600">{r.purchaseNumber}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.invoiceNumber ?? "—"}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-IN")}</TableCell>
              <TableCell>{r.supplierName ?? "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.subtotal)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.taxAmount)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmt(r.total)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmt(r.paidAmount)}</TableCell>
              <TableCell><Badge variant={r.paymentStatus === "paid" ? "default" : "secondary"} className="text-xs">{r.paymentStatus}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── GST REPORT ───────────────────────────────────────────────────────────────

function GstReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useGstReport(filters);

  const outCols: ExportColumn[] = [
    { header: "GST Rate %", key: "gstRate", format: "percent" }, { header: "Taxable Amount", key: "taxableAmount", format: "currency" },
    { header: "GST Amount", key: "gstAmount", format: "currency" }, { header: "Invoice Count", key: "invoiceCount", format: "number" },
  ];

  return (
    <ReportShell
      title="GST Report"
      subtitle="Output vs Input tax reconciliation"
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Output GST (Sales)" value={fmt(data?.outputGst.total)} icon={TrendingUp} color="orange" />
        <SummaryCard title="Input GST (Purchases)" value={fmt(data?.inputGst.total)} icon={TrendingDown} color="blue" />
        <SummaryCard title="Net GST Payable" value={fmt(data?.netPayable)} sub={data ? (data.netPayable >= 0 ? "Payable to Govt" : "Refundable") : undefined} icon={Receipt} color={data && data.netPayable < 0 ? "green" : "red"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Output GST — Sales</CardTitle>
              <ExportToolbar data={(data?.outputGst.rows ?? []) as unknown as Record<string, unknown>[]} columns={outCols} filename={`output-gst-${range.dateFrom}`} title="Output GST Report" count={(data?.outputGst.rows ?? []).length} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-gray-50 text-xs"><TableHead className="font-medium">Rate %</TableHead><TableHead className="text-right font-medium">Taxable</TableHead><TableHead className="text-right font-medium">GST</TableHead><TableHead className="text-right font-medium">Invoices</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.outputGst.rows ?? []).length === 0 ? <EmptyRow cols={4} message="No output GST — click Run." /> : (data?.outputGst.rows ?? []).map((r) => (
                  <TableRow key={r.gstRate} className="text-sm">
                    <TableCell><Badge variant="outline">{r.gstRate}%</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.taxableAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-amber-600">{fmt(r.gstAmount)}</TableCell>
                    <TableCell className="text-right">{r.invoiceCount}</TableCell>
                  </TableRow>
                ))}
                {(data?.outputGst.rows ?? []).length > 0 && (
                  <TableRow className="bg-amber-50 font-semibold text-sm">
                    <TableCell>Total</TableCell><TableCell /><TableCell className="text-right tabular-nums">{fmt(data?.outputGst.total)}</TableCell><TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Input GST — Purchases</CardTitle>
              <ExportToolbar data={(data?.inputGst.rows ?? []) as unknown as Record<string, unknown>[]} columns={outCols} filename={`input-gst-${range.dateFrom}`} title="Input GST Report" count={(data?.inputGst.rows ?? []).length} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-gray-50 text-xs"><TableHead className="font-medium">Rate %</TableHead><TableHead className="text-right font-medium">Taxable</TableHead><TableHead className="text-right font-medium">GST</TableHead><TableHead className="text-right font-medium">Invoices</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.inputGst.rows ?? []).length === 0 ? <EmptyRow cols={4} message="No input GST — click Run." /> : (data?.inputGst.rows ?? []).map((r) => (
                  <TableRow key={r.gstRate} className="text-sm">
                    <TableCell><Badge variant="outline">{r.gstRate}%</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.taxableAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-blue-600">{fmt(r.gstAmount)}</TableCell>
                    <TableCell className="text-right">{r.invoiceCount}</TableCell>
                  </TableRow>
                ))}
                {(data?.inputGst.rows ?? []).length > 0 && (
                  <TableRow className="bg-blue-50 font-semibold text-sm">
                    <TableCell>Total</TableCell><TableCell /><TableCell className="text-right tabular-nums">{fmt(data?.inputGst.total)}</TableCell><TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ReportShell>
  );
}

// ─── STOCK VALUATION ──────────────────────────────────────────────────────────

function StockValuationReport() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useStockValuationReport({});

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Product", key: "name", width: 30 }, { header: "SKU", key: "sku" }, { header: "Category", key: "categoryName" },
    { header: "Unit", key: "unit" }, { header: "Stock", key: "stock", format: "number" },
    { header: "Cost Price", key: "costPrice", format: "currency" }, { header: "Sale Price", key: "price", format: "currency" },
    { header: "MRP", key: "mrp", format: "currency" }, { header: "Cost Value", key: "costValue", format: "currency" },
    { header: "Retail Value", key: "retailValue", format: "currency" },
  ];

  return (
    <ReportShell
      title="Stock Valuation"
      subtitle={`${rows.length} products`}
      toolbar={<ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename="stock-valuation" title="Stock Valuation Report" summaryRows={[{ label: "Total Cost Value", value: fmt(data?.totals.totalCostValue) }, { label: "Total Retail Value", value: fmt(data?.totals.totalRetailValue) }]} count={rows.length} />}
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm w-[220px] bg-white" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Stock Units" value={(data?.totals.totalStock ?? 0).toLocaleString("en-IN")} icon={Package} color="blue" />
        <SummaryCard title="Cost Value" value={fmt(data?.totals.totalCostValue)} sub="At purchase cost" icon={TrendingDown} color="orange" />
        <SummaryCard title="Retail Value" value={fmt(data?.totals.totalRetailValue)} sub="At sale price" icon={TrendingUp} color="green" />
      </div>
      <DataTable cols={8}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Product</TableHead><TableHead className="font-medium">SKU</TableHead>
            <TableHead className="font-medium">Category</TableHead><TableHead className="text-right font-medium">Stock</TableHead>
            <TableHead className="text-right font-medium">Cost Price</TableHead><TableHead className="text-right font-medium">Sale Price</TableHead>
            <TableHead className="text-right font-medium">Cost Value</TableHead><TableHead className="text-right font-medium">Retail Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r) => (
            <TableRow key={r.id} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{r.sku ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{r.stock} {r.unit}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.costPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.price)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.costValue)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{fmt(r.retailValue)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-gray-50 font-semibold text-sm">
              <TableCell colSpan={6}>Total</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(data?.totals.totalCostValue)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmt(data?.totals.totalRetailValue)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── LOW STOCK ────────────────────────────────────────────────────────────────

function LowStockReport() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useLowStockReport({});

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Product", key: "name", width: 30 }, { header: "SKU", key: "sku" }, { header: "Category", key: "categoryName" },
    { header: "Unit", key: "unit" }, { header: "Current Stock", key: "stock", format: "number" },
    { header: "Min Alert", key: "minStockAlert", format: "number" }, { header: "Shortage", key: "shortage", format: "number" },
    { header: "Price", key: "price", format: "currency" },
  ];

  const outOfStock = (data?.data ?? []).filter((r) => r.stock === 0).length;

  return (
    <ReportShell
      title="Low Stock Report"
      subtitle="Products at or below minimum stock level"
      toolbar={<ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename="low-stock-report" title="Low Stock Report" count={rows.length} />}
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm w-[220px] bg-white" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }
    >
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>Reorder promptly to avoid stockouts.</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard title="Low Stock Items" value={String(data?.count ?? 0)} sub="Need reorder" icon={AlertTriangle} color="red" />
        <SummaryCard title="Out of Stock" value={String(outOfStock)} sub="Zero stock" icon={Package} color="orange" />
      </div>
      <DataTable cols={7}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Product</TableHead><TableHead className="font-medium">SKU</TableHead>
            <TableHead className="font-medium">Category</TableHead><TableHead className="text-right font-medium">Stock</TableHead>
            <TableHead className="text-right font-medium">Min Level</TableHead><TableHead className="text-right font-medium">Shortage</TableHead>
            <TableHead className="text-right font-medium">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={7} /> : rows.length === 0 ? <EmptyRow cols={7} message="All products are well stocked!" /> : rows.map((r) => (
            <TableRow key={r.id} className={`text-sm ${r.stock === 0 ? "bg-red-50" : ""}`}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{r.sku ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
              <TableCell className="text-right"><Badge variant={r.stock === 0 ? "destructive" : "secondary"} className="text-xs">{r.stock} {r.unit}</Badge></TableCell>
              <TableCell className="text-right text-muted-foreground">{r.minStockAlert}</TableCell>
              <TableCell className="text-right font-semibold text-red-600">{r.shortage}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── DEAD STOCK ───────────────────────────────────────────────────────────────

function DeadStockReport() {
  const [days, setDays] = useState("90");
  const [filters, setFilters] = useState<ReportFilters>({ days: "90" });
  const { data, isLoading } = useDeadStockReport(filters);

  const cols: ExportColumn[] = [
    { header: "Product", key: "name", width: 30 }, { header: "SKU", key: "sku" }, { header: "Category", key: "categoryName" },
    { header: "Stock", key: "stock", format: "number" }, { header: "Cost Price", key: "costPrice", format: "currency" },
    { header: "Stock Value", key: "stockValue", format: "currency" },
  ];

  return (
    <ReportShell
      title="Dead Stock Report"
      subtitle="Products with stock but no recent sales"
      toolbar={<ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`dead-stock-${days}days`} title="Dead Stock Report" count={data?.count} />}
      filters={
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">No sales in last</span>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[110px] text-sm bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 bg-white" onClick={() => setFilters({ days })}>Run</Button>
        </div>
      }
    >
      <DataTable cols={6}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Product</TableHead><TableHead className="font-medium">SKU</TableHead>
            <TableHead className="font-medium">Category</TableHead><TableHead className="text-right font-medium">Stock</TableHead>
            <TableHead className="text-right font-medium">Cost Price</TableHead><TableHead className="text-right font-medium">Stock Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={6} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={6} message="No dead stock — all products have recent sales!" /> : (data?.data ?? []).map((r) => (
            <TableRow key={r.id} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{r.sku ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.costPrice)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-red-600">{fmt(r.stockValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── CUSTOMER LEDGER ──────────────────────────────────────────────────────────

function CustomerLedgerReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useCustomerLedgerReport(filters);

  const cols: ExportColumn[] = [
    { header: "Customer", key: "customerName", width: 25 }, { header: "Total Orders", key: "totalSales", format: "number" },
    { header: "Total Amount", key: "totalAmount", format: "currency" }, { header: "Paid", key: "totalPaid", format: "currency" },
    { header: "Outstanding", key: "outstanding", format: "currency" },
  ];

  return (
    <ReportShell
      title="Customer Ledger"
      subtitle={`${data?.count ?? 0} customers`}
      toolbar={<ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`customer-ledger-${range.dateFrom}`} title="Customer Ledger" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />}
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <DataTable cols={5}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Customer</TableHead><TableHead className="text-right font-medium">Orders</TableHead>
            <TableHead className="text-right font-medium">Total Amount</TableHead><TableHead className="text-right font-medium">Paid</TableHead>
            <TableHead className="text-right font-medium">Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={5} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={5} message="No customer transactions. Click Run." /> : (data?.data ?? []).map((r, i) => (
            <TableRow key={i} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium">{r.customerName}</TableCell>
              <TableCell className="text-right tabular-nums">{r.totalSales}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.totalAmount)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmt(r.totalPaid)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {r.outstanding > 0 ? <span className="text-red-600">{fmt(r.outstanding)}</span> : <span className="text-emerald-600 text-xs">Settled</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── SUPPLIER LEDGER ──────────────────────────────────────────────────────────

function SupplierLedgerReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useSupplierLedgerReport(filters);

  const cols: ExportColumn[] = [
    { header: "Supplier", key: "supplierName", width: 25 }, { header: "Total Orders", key: "totalOrders", format: "number" },
    { header: "Total Amount", key: "totalAmount", format: "currency" }, { header: "Paid", key: "totalPaid", format: "currency" },
    { header: "Outstanding", key: "outstanding", format: "currency" },
  ];

  return (
    <ReportShell
      title="Supplier Ledger"
      subtitle={`${data?.count ?? 0} suppliers`}
      toolbar={<ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`supplier-ledger-${range.dateFrom}`} title="Supplier Ledger" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />}
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <DataTable cols={5}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Supplier</TableHead><TableHead className="text-right font-medium">Orders</TableHead>
            <TableHead className="text-right font-medium">Total Amount</TableHead><TableHead className="text-right font-medium">Paid</TableHead>
            <TableHead className="text-right font-medium">Outstanding</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={5} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={5} message="No supplier transactions. Click Run." /> : (data?.data ?? []).map((r, i) => (
            <TableRow key={i} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium">{r.supplierName}</TableCell>
              <TableCell className="text-right tabular-nums">{r.totalOrders}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.totalAmount)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmt(r.totalPaid)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {r.outstanding > 0 ? <span className="text-red-600">{fmt(r.outstanding)}</span> : <span className="text-emerald-600 text-xs">Settled</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── PAYMENT COLLECTION ───────────────────────────────────────────────────────

function PaymentCollectionReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = usePaymentCollectionReport(filters);

  const cols: ExportColumn[] = [
    { header: "Payment Method", key: "method" }, { header: "Count", key: "count", format: "number" },
    { header: "Amount", key: "total", format: "currency" }, { header: "Share %", key: "percentage", format: "percent" },
  ];

  return (
    <ReportShell
      title="Payment Collection"
      subtitle="Breakdown by payment method"
      toolbar={<ExportToolbar data={(data?.byMethod ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`payment-collection-${range.dateFrom}`} title="Payment Collection" count={(data?.byMethod ?? []).length} />}
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <SummaryCard title="Total Collections" value={fmt(data?.grandTotal)} sub={`${(data?.byMethod ?? []).reduce((s, r) => s + r.count, 0)} transactions`} icon={CreditCard} color="blue" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-gray-100 shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="bg-gray-50 text-xs"><TableHead className="font-medium">Method</TableHead><TableHead className="text-right font-medium">Count</TableHead><TableHead className="text-right font-medium">Amount</TableHead><TableHead className="text-right font-medium">Share</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.byMethod ?? []).length === 0 ? <EmptyRow cols={4} message="No payments. Click Run." /> : (data?.byMethod ?? []).map((r) => (
                  <TableRow key={r.method} className="text-sm hover:bg-gray-50/50">
                    <TableCell className="capitalize font-medium">{r.method}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${r.percentage}%` }} /></div>
                        <span className="text-xs w-10 text-right">{r.percentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Payment Mix</CardTitle></CardHeader>
          <CardContent>
            {(data?.byMethod ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data?.byMethod ?? []} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={75} label={({ method, percentage }) => `${method} ${percentage}%`}>
                    {(data?.byMethod ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data — click Run</div>}
          </CardContent>
        </Card>
      </div>
      {(data?.daily ?? []).length > 0 && (
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Daily Collections</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="#3b82f6" name="Amount" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </ReportShell>
  );
}

// ─── CASHIER SHIFT ────────────────────────────────────────────────────────────

function CashierShiftReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: today(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: today(), dateTo: today() });
  const { data, isLoading } = useCashierShiftReport(filters);

  const cols: ExportColumn[] = [
    { header: "Cashier", key: "cashierName", width: 20 }, { header: "Sales Count", key: "salesCount", format: "number" },
    { header: "Total Sales", key: "totalSales", format: "currency" }, { header: "Discount Given", key: "totalDiscount", format: "currency" },
    { header: "Tax Collected", key: "totalTax", format: "currency" }, { header: "Avg Basket", key: "avgBasket", format: "currency" },
  ];

  return (
    <ReportShell
      title="Cashier Shift Report"
      subtitle="Performance by cashier"
      toolbar={<ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`cashier-shift-${range.dateFrom}`} title="Cashier Shift Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />}
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <DataTable cols={7}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Cashier</TableHead><TableHead className="text-right font-medium">Sales</TableHead>
            <TableHead className="text-right font-medium">Total</TableHead><TableHead className="text-right font-medium">Discount</TableHead>
            <TableHead className="text-right font-medium">Tax</TableHead><TableHead className="text-right font-medium">Avg Basket</TableHead>
            <TableHead className="font-medium">Payment Mix</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={7} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={7} message="No cashier data. Click Run." /> : (data?.data ?? []).map((r, i) => (
            <TableRow key={i} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium">{r.cashierName}</TableCell>
              <TableCell className="text-right tabular-nums">{r.salesCount}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-blue-600">{fmt(r.totalSales)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-500">-{fmt(r.totalDiscount)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.totalTax)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.avgBasket)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(r.paymentBreakdown).map(([m, a]) => (
                    <Badge key={m} variant="outline" className="text-xs capitalize">{m}: {fmt(a)}</Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── EXPENSE REPORT ───────────────────────────────────────────────────────────

function ExpensesReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useExpenseReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.description.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Exp #", key: "expenseNumber" }, { header: "Date", key: "date", format: "date" },
    { header: "Description", key: "description", width: 30 }, { header: "Category", key: "category" },
    { header: "Amount", key: "amount", format: "currency" }, { header: "GST", key: "gstAmount", format: "currency" },
    { header: "Total", key: "totalAmount", format: "currency" }, { header: "Status", key: "status" },
  ];

  return (
    <ReportShell
      title="Expense Report"
      subtitle={`${rows.length} entries`}
      toolbar={<ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`expenses-${range.dateFrom}`} title="Expense Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} summaryRows={[{ label: "Total", value: fmt(data?.totals.total) }]} count={rows.length} />}
      filters={
        <>
          <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm w-[180px] bg-white" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Expenses" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} entries`} icon={Receipt} color="red" />
        <SummaryCard title="GST on Expenses" value={fmt(data?.totals.gst)} icon={Receipt} color="orange" />
        <SummaryCard title="Approved" value={fmt(data?.totals.approved)} icon={TrendingDown} color="green" />
      </div>
      <DataTable cols={8}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Exp #</TableHead><TableHead className="font-medium">Date</TableHead>
            <TableHead className="font-medium">Description</TableHead><TableHead className="font-medium">Category</TableHead>
            <TableHead className="text-right font-medium">Amount</TableHead><TableHead className="text-right font-medium">GST</TableHead>
            <TableHead className="text-right font-medium">Total</TableHead><TableHead className="font-medium">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} message="No expenses. Click Run." /> : rows.map((r) => (
            <TableRow key={r.id} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-mono text-xs text-blue-600">{r.expenseNumber}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">{r.date}</TableCell>
              <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.amount)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.gstAmount)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmt(r.totalAmount)}</TableCell>
              <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="text-xs">{r.status}</Badge></TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-gray-50 font-semibold text-sm">
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(data?.totals.total)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(data?.totals.gst)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt((data?.totals.total ?? 0) + (data?.totals.gst ?? 0))}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── DAILY CLOSING ────────────────────────────────────────────────────────────

function DailyClosingReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useDailyClosingReport(filters);
  const rows = data?.data ?? [];

  const totals = rows.reduce((acc, r) => ({
    sales: acc.sales + r.totalSales, expenses: acc.expenses + r.totalExpenses, net: acc.net + r.netCash,
  }), { sales: 0, expenses: 0, net: 0 });

  const cols: ExportColumn[] = [
    { header: "Date", key: "date", format: "date" }, { header: "Sales Count", key: "salesCount", format: "number" },
    { header: "Total Sales", key: "totalSales", format: "currency" }, { header: "Tax", key: "totalTax", format: "currency" },
    { header: "Discount", key: "totalDiscount", format: "currency" }, { header: "Expenses", key: "totalExpenses", format: "currency" },
    { header: "Net Cash", key: "netCash", format: "currency" },
  ];

  return (
    <ReportShell
      title="Daily Closing Report"
      subtitle={`${rows.length} days`}
      toolbar={<ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`daily-closing-${range.dateFrom}`} title="Daily Closing Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} summaryRows={[{ label: "Total Net Cash", value: fmt(totals.net) }]} count={rows.length} landscape />}
      filters={<DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Sales" value={fmt(totals.sales)} sub={`${rows.length} days`} icon={ShoppingCart} color="blue" />
        <SummaryCard title="Total Expenses" value={fmt(totals.expenses)} icon={Receipt} color="red" />
        <SummaryCard title="Net Cash" value={fmt(totals.net)} icon={TrendingUp} color="green" />
      </div>
      {rows.length > 0 && (
        <Card className="border border-gray-100 shadow-none">
          <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Daily Sales Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rows.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="totalSales" fill="#3b82f6" name="Sales" radius={[3, 3, 0, 0]} />
                <Bar dataKey="totalExpenses" fill="#f59e0b" name="Expenses" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      <DataTable cols={8}>
        <TableHeader>
          <TableRow className="bg-gray-50 text-xs">
            <TableHead className="font-medium">Date</TableHead><TableHead className="text-right font-medium">Sales</TableHead>
            <TableHead className="text-right font-medium">Total</TableHead><TableHead className="text-right font-medium">Tax</TableHead>
            <TableHead className="text-right font-medium">Discount</TableHead><TableHead className="text-right font-medium">Expenses</TableHead>
            <TableHead className="text-right font-medium">Net Cash</TableHead><TableHead className="font-medium">Payment Mix</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} message="No data. Click Run." /> : rows.map((r) => (
            <TableRow key={r.date} className="text-sm hover:bg-gray-50/50">
              <TableCell className="font-medium whitespace-nowrap">{new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
              <TableCell className="text-right tabular-nums">{r.salesCount}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(r.totalSales)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmt(r.totalTax)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-500">-{fmt(r.totalDiscount)}</TableCell>
              <TableCell className="text-right tabular-nums text-red-600">{fmt(r.totalExpenses)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{fmt(r.netCash)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(r.paymentBreakdown).map(([m, a]) => (
                    <Badge key={m} variant="secondary" className="text-xs capitalize">{m}: {fmt(a)}</Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-blue-50/60 font-semibold text-sm">
              <TableCell colSpan={2} className="text-muted-foreground text-xs">Period Total</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(totals.sales)}</TableCell>
              <TableCell /><TableCell />
              <TableCell className="text-right tabular-nums text-red-600">{fmt(totals.expenses)}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmt(totals.net)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </DataTable>
    </ReportShell>
  );
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

type ReportId =
  | "sales" | "purchases" | "gst" | "payment-collection" | "daily-closing"
  | "stock-valuation" | "low-stock" | "dead-stock"
  | "customer-ledger" | "supplier-ledger"
  | "expenses" | "cashier-shift";

type NavGroup = {
  label: string;
  items: { id: ReportId; label: string; icon: React.ElementType }[];
};

const NAV: NavGroup[] = [
  {
    label: "Sales & Revenue",
    items: [
      { id: "sales", label: "Sales Report", icon: ShoppingCart },
      { id: "purchases", label: "Purchase Report", icon: Truck },
      { id: "gst", label: "GST Report", icon: Receipt },
      { id: "payment-collection", label: "Payment Collection", icon: CreditCard },
      { id: "daily-closing", label: "Daily Closing", icon: Calendar },
    ],
  },
  {
    label: "Inventory",
    items: [
      { id: "stock-valuation", label: "Stock Valuation", icon: Package },
      { id: "low-stock", label: "Low Stock", icon: AlertTriangle },
      { id: "dead-stock", label: "Dead Stock", icon: Package },
    ],
  },
  {
    label: "Parties",
    items: [
      { id: "customer-ledger", label: "Customer Ledger", icon: Users },
      { id: "supplier-ledger", label: "Supplier Ledger", icon: Truck },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "expenses", label: "Expense Report", icon: Receipt },
      { id: "cashier-shift", label: "Cashier Shift", icon: Users },
    ],
  },
];

const REPORT_COMPONENTS: Record<ReportId, React.ComponentType> = {
  "sales": SalesReport,
  "purchases": PurchaseReport,
  "gst": GstReport,
  "payment-collection": PaymentCollectionReport,
  "daily-closing": DailyClosingReport,
  "stock-valuation": StockValuationReport,
  "low-stock": LowStockReport,
  "dead-stock": DeadStockReport,
  "customer-ledger": CustomerLedgerReport,
  "supplier-ledger": SupplierLedgerReport,
  "expenses": ExpensesReport,
  "cashier-shift": CashierShiftReport,
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [active, setActive] = useState<ReportId>("sales");
  const ActiveReport = REPORT_COMPONENTS[active];

  return (
    <div className="flex h-full min-h-screen bg-gray-50/40">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto py-4 print:hidden">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-gray-900">Reports</h1>
          <p className="text-xs text-muted-foreground">Analytics & Exports</p>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
              {group.items.map((item) => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                    <span className="truncate">{item.label}</span>
                    {isActive && <ChevronRight className="h-3 w-3 ml-auto text-blue-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <ActiveReport />
      </main>
    </div>
  );
}
