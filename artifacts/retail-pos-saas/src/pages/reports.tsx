import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { TrendingUp, TrendingDown, ShoppingCart, Package, AlertTriangle, Users, Truck, CreditCard, Receipt, Clock, Calendar, Search } from "lucide-react";

function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() { return new Date().toISOString().split("T")[0]!; }
function firstOfMonth() { return today().substring(0, 7) + "-01"; }

function SummaryCard({ title, value, sub, icon: Icon, color = "blue" }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600", red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${colors[color] ?? colors.blue}`}>
            <Icon className="h-5 w-5" />
          </div>
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
            <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyRow({ cols, message = "No data found" }: { cols: number; message?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-12 text-muted-foreground">{message}</TableCell>
    </TableRow>
  );
}

const PIE_COLORS = ["#4472C4", "#ED7D31", "#A9D18E", "#FF0000", "#FFC000", "#9B59B6", "#1ABC9C"];

// ─── SALES REPORT ─────────────────────────────────────────────────────────────

function SalesReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("completed");
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today(), status: "completed" });
  const { data, isLoading } = useSalesReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.saleNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.cashierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Sale #", key: "saleNumber" },
    { header: "Date", key: "date", format: "date" },
    { header: "Customer", key: "customerName" },
    { header: "Cashier", key: "cashierName" },
    { header: "Status", key: "status" },
    { header: "Subtotal", key: "subtotal", format: "currency", width: 14 },
    { header: "Discount", key: "discountAmount", format: "currency", width: 12 },
    { header: "Tax (GST)", key: "taxAmount", format: "currency", width: 12 },
    { header: "Total", key: "total", format: "currency", width: 14 },
    { header: "Payment", key: "paymentStatus" },
  ];

  const summary = [
    { label: "Total Revenue", value: fmt(data?.totals.total) },
    { label: "Total Tax", value: fmt(data?.totals.tax) },
    { label: "Total Discount", value: fmt(data?.totals.discount) },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter
        value={range}
        onChange={setRange}
        onRefresh={() => setFilters({ ...range, status })}
        isLoading={isLoading}
        extraFilters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[130px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All Status</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title="Total Sales" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} orders`} icon={ShoppingCart} color="blue" />
        <SummaryCard title="Subtotal" value={fmt(data?.totals.subtotal)} icon={TrendingUp} color="green" />
        <SummaryCard title="Tax (GST)" value={fmt(data?.totals.tax)} icon={Receipt} color="orange" />
        <SummaryCard title="Discount" value={fmt(data?.totals.discount)} icon={TrendingDown} color="red" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Sales Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm w-[200px]" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ExportToolbar
                data={rows as unknown as Record<string, unknown>[]}
                columns={cols}
                filename={`sales-report-${range.dateFrom}-${range.dateTo}`}
                title="Sales Report"
                subtitle={`${range.dateFrom} to ${range.dateTo}`}
                summaryRows={summary}
                printElementId="sales-table"
                landscape
                count={rows.length}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto" id="sales-table">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Sale #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={10} /> : rows.length === 0 ? <EmptyRow cols={10} message="No sales in this period. Click Refresh to load." /> : rows.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-mono text-xs">{r.saleNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{r.customerName ?? <span className="text-muted-foreground text-xs">Walk-in</span>}</TableCell>
                    <TableCell className="text-xs">{r.cashierName ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "default" : "destructive"} className="text-xs">{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.subtotal)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmt(r.discountAmount)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.taxAmount)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                    <TableCell><Badge variant={r.paymentStatus === "paid" ? "outline" : "secondary"} className="text-xs">{r.paymentStatus}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PURCHASE REPORT ──────────────────────────────────────────────────────────

function PurchaseReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = usePurchaseReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.purchaseNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplierName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "PO #", key: "purchaseNumber" },
    { header: "Invoice #", key: "invoiceNumber" },
    { header: "Date", key: "date", format: "date" },
    { header: "Supplier", key: "supplierName" },
    { header: "Status", key: "status" },
    { header: "Subtotal", key: "subtotal", format: "currency" },
    { header: "Tax", key: "taxAmount", format: "currency" },
    { header: "Discount", key: "discountAmount", format: "currency" },
    { header: "Total", key: "total", format: "currency" },
    { header: "Paid", key: "paidAmount", format: "currency" },
    { header: "Payment Status", key: "paymentStatus" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title="Total Purchases" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} orders`} icon={Truck} color="blue" />
        <SummaryCard title="Paid" value={fmt(data?.totals.paid)} icon={TrendingUp} color="green" />
        <SummaryCard title="Tax (GST)" value={fmt(data?.totals.tax)} icon={Receipt} color="orange" />
        <SummaryCard title="Discount" value={fmt(data?.totals.discount)} icon={TrendingDown} color="red" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Purchase Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm w-[200px]" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`purchase-report-${range.dateFrom}`} title="Purchase Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={rows.length} landscape />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto" id="purchase-table">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>PO #</TableHead><TableHead>Invoice #</TableHead><TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead><TableHead className="text-right">Paid</TableHead>
                  <TableHead>Pay Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={10} /> : rows.length === 0 ? <EmptyRow cols={10} message="No purchases in this period. Click Refresh." /> : rows.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-mono text-xs">{r.purchaseNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{r.supplierName ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.subtotal)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.taxAmount)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(r.paidAmount)}</TableCell>
                    <TableCell><Badge variant={r.paymentStatus === "paid" ? "default" : "secondary"} className="text-xs">{r.paymentStatus}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── GST REPORT ───────────────────────────────────────────────────────────────

function GstReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useGstReport(filters);

  const outCols: ExportColumn[] = [
    { header: "GST Rate %", key: "gstRate", format: "percent" },
    { header: "Taxable Amount", key: "taxableAmount", format: "currency" },
    { header: "GST Amount", key: "gstAmount", format: "currency" },
    { header: "Invoice Count", key: "invoiceCount", format: "number" },
  ];

  const inCols: ExportColumn[] = [...outCols];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Output GST (Sales)" value={fmt(data?.outputGst.total)} icon={TrendingUp} color="orange" />
        <SummaryCard title="Input GST (Purchases)" value={fmt(data?.inputGst.total)} icon={TrendingDown} color="blue" />
        <SummaryCard
          title="Net GST Payable"
          value={fmt(data?.netPayable)}
          sub={data ? (data.netPayable >= 0 ? "Payable to Govt" : "Refundable") : undefined}
          icon={Receipt}
          color={data && data.netPayable < 0 ? "green" : "red"}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Output GST (from Sales)</CardTitle>
              <ExportToolbar data={(data?.outputGst.rows ?? []) as unknown as Record<string, unknown>[]} columns={outCols} filename={`output-gst-${range.dateFrom}`} title="Output GST Report" count={(data?.outputGst.rows ?? []).length} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Rate %</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Invoices</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.outputGst.rows ?? []).length === 0 ? <EmptyRow cols={4} message="No output GST. Click Refresh." /> : (data?.outputGst.rows ?? []).map((r) => (
                  <TableRow key={r.gstRate}>
                    <TableCell><Badge variant="outline">{r.gstRate}%</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.taxableAmount)}</TableCell>
                    <TableCell className="text-right font-medium text-orange-600">{fmt(r.gstAmount)}</TableCell>
                    <TableCell className="text-right">{r.invoiceCount}</TableCell>
                  </TableRow>
                ))}
                {data && data.outputGst.rows.length > 0 && (
                  <TableRow className="bg-orange-50 font-bold">
                    <TableCell>Total</TableCell><TableCell />
                    <TableCell className="text-right">{fmt(data.outputGst.total)}</TableCell><TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Input GST (from Purchases)</CardTitle>
              <ExportToolbar data={(data?.inputGst.rows ?? []) as unknown as Record<string, unknown>[]} columns={inCols} filename={`input-gst-${range.dateFrom}`} title="Input GST Report" count={(data?.inputGst.rows ?? []).length} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Rate %</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Invoices</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.inputGst.rows ?? []).length === 0 ? <EmptyRow cols={4} message="No input GST. Click Refresh." /> : (data?.inputGst.rows ?? []).map((r) => (
                  <TableRow key={r.gstRate}>
                    <TableCell><Badge variant="outline">{r.gstRate}%</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.taxableAmount)}</TableCell>
                    <TableCell className="text-right font-medium text-blue-600">{fmt(r.gstAmount)}</TableCell>
                    <TableCell className="text-right">{r.invoiceCount}</TableCell>
                  </TableRow>
                ))}
                {data && data.inputGst.rows.length > 0 && (
                  <TableRow className="bg-blue-50 font-bold">
                    <TableCell>Total</TableCell><TableCell />
                    <TableCell className="text-right">{fmt(data.inputGst.total)}</TableCell><TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── STOCK VALUATION ──────────────────────────────────────────────────────────

function StockValuationReport() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({});
  const { data, isLoading } = useStockValuationReport(filters);

  const rows = (data?.data ?? []).filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const cols: ExportColumn[] = [
    { header: "Product", key: "name", width: 30 },
    { header: "SKU", key: "sku" },
    { header: "Category", key: "categoryName" },
    { header: "Unit", key: "unit" },
    { header: "Stock", key: "stock", format: "number" },
    { header: "Cost Price", key: "costPrice", format: "currency" },
    { header: "Sale Price", key: "price", format: "currency" },
    { header: "MRP", key: "mrp", format: "currency" },
    { header: "Cost Value", key: "costValue", format: "currency" },
    { header: "Retail Value", key: "retailValue", format: "currency" },
  ];

  const summary = [
    { label: "Total Stock Items", value: String(data?.totals.totalStock ?? 0) },
    { label: "Total Cost Value", value: fmt(data?.totals.totalCostValue) },
    { label: "Total Retail Value", value: fmt(data?.totals.totalRetailValue) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Stock Items" value={(data?.totals.totalStock ?? 0).toLocaleString("en-IN")} icon={Package} color="blue" />
        <SummaryCard title="Cost Value" value={fmt(data?.totals.totalCostValue)} sub="At purchase cost" icon={TrendingDown} color="orange" />
        <SummaryCard title="Retail Value" value={fmt(data?.totals.totalRetailValue)} sub="At sale price" icon={TrendingUp} color="green" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Stock Valuation</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setFilters({ search })}>
                Refresh
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm w-[200px]" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename="stock-valuation" title="Stock Valuation Report" summaryRows={summary} count={rows.length} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead><TableHead className="text-right">Cost Value</TableHead>
                  <TableHead className="text-right">Retail Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} /> : rows.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.stock} {r.unit}</TableCell>
                    <TableCell className="text-right">{fmt(r.costPrice)}</TableCell>
                    <TableCell className="text-right">{fmt(r.price)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.costValue)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{fmt(r.retailValue)}</TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-gray-50 font-bold text-sm">
                    <TableCell colSpan={6}>Total</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(data?.totals.totalCostValue)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(data?.totals.totalRetailValue)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
    { header: "Product", key: "name", width: 30 },
    { header: "SKU", key: "sku" },
    { header: "Category", key: "categoryName" },
    { header: "Unit", key: "unit" },
    { header: "Current Stock", key: "stock", format: "number" },
    { header: "Min Alert", key: "minStockAlert", format: "number" },
    { header: "Shortage", key: "shortage", format: "number" },
    { header: "Price", key: "price", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>Showing products at or below their minimum stock alert level. Reorder promptly to avoid stockouts.</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard title="Low Stock Items" value={String(data?.count ?? 0)} sub="Need reorder" icon={AlertTriangle} color="red" />
        <SummaryCard title="Out of Stock" value={String((data?.data ?? []).filter((r) => r.stock === 0).length)} icon={Package} color="orange" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Low Stock Items</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm w-[200px]" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename="low-stock-report" title="Low Stock Report" count={rows.length} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min Level</TableHead>
                  <TableHead className="text-right">Shortage</TableHead><TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={7} /> : rows.length === 0 ? <EmptyRow cols={7} message="All products are well stocked!" /> : rows.map((r) => (
                  <TableRow key={r.id} className={`text-sm ${r.stock === 0 ? "bg-red-50" : "bg-amber-50/40"}`}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.stock === 0 ? "destructive" : "secondary"} className="text-xs">{r.stock} {r.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.minStockAlert}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{r.shortage}</TableCell>
                    <TableCell className="text-right">{fmt(r.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DEAD STOCK ───────────────────────────────────────────────────────────────

function DeadStockReport() {
  const [days, setDays] = useState("90");
  const [filters, setFilters] = useState<ReportFilters>({ days: "90" });
  const { data, isLoading } = useDeadStockReport(filters);

  const cols: ExportColumn[] = [
    { header: "Product", key: "name", width: 30 },
    { header: "SKU", key: "sku" },
    { header: "Category", key: "categoryName" },
    { header: "Stock", key: "stock", format: "number" },
    { header: "Cost Price", key: "costPrice", format: "currency" },
    { header: "Stock Value", key: "stockValue", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3 print:hidden">
        <span className="text-sm font-medium">No sales in the last</span>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-8 w-[100px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="180">6 months</SelectItem>
            <SelectItem value="365">1 year</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="default" className="h-8" onClick={() => setFilters({ days })}>Apply</Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Dead Stock ({data?.noSaleDays ?? days} days)</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Products with stock but no sales in this period</p>
            </div>
            <ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`dead-stock-${days}days`} title="Dead Stock Report" count={data?.count} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={6} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={6} message="No dead stock. All products have recent sales!" /> : (data?.data ?? []).map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.stock}</TableCell>
                    <TableCell className="text-right">{fmt(r.costPrice)}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{fmt(r.stockValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CUSTOMER LEDGER ──────────────────────────────────────────────────────────

function CustomerLedgerReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useCustomerLedgerReport(filters);

  const cols: ExportColumn[] = [
    { header: "Customer", key: "customerName", width: 25 },
    { header: "Total Sales", key: "totalSales", format: "number" },
    { header: "Total Amount", key: "totalAmount", format: "currency" },
    { header: "Paid", key: "totalPaid", format: "currency" },
    { header: "Outstanding", key: "outstanding", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Customer Ledger</CardTitle>
            <ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`customer-ledger-${range.dateFrom}`} title="Customer Ledger Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Customer</TableHead><TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead><TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={5} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={5} message="No customer data. Click Refresh." /> : (data?.data ?? []).map((r, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell className="text-right">{r.totalSales}</TableCell>
                    <TableCell className="text-right">{fmt(r.totalAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(r.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      {r.outstanding > 0 ? <span className="text-red-600 font-medium">{fmt(r.outstanding)}</span> : <span className="text-green-600">Paid</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SUPPLIER LEDGER ──────────────────────────────────────────────────────────

function SupplierLedgerReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useSupplierLedgerReport(filters);

  const cols: ExportColumn[] = [
    { header: "Supplier", key: "supplierName", width: 25 },
    { header: "Total Orders", key: "totalOrders", format: "number" },
    { header: "Total Amount", key: "totalAmount", format: "currency" },
    { header: "Paid", key: "totalPaid", format: "currency" },
    { header: "Outstanding", key: "outstanding", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Supplier Ledger</CardTitle>
            <ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`supplier-ledger-${range.dateFrom}`} title="Supplier Ledger Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Supplier</TableHead><TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead><TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={5} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={5} message="No supplier data. Click Refresh." /> : (data?.data ?? []).map((r, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell className="font-medium">{r.supplierName}</TableCell>
                    <TableCell className="text-right">{r.totalOrders}</TableCell>
                    <TableCell className="text-right">{fmt(r.totalAmount)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(r.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      {r.outstanding > 0 ? <span className="text-red-600 font-medium">{fmt(r.outstanding)}</span> : <span className="text-green-600">Paid</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PAYMENT COLLECTION ───────────────────────────────────────────────────────

function PaymentCollectionReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = usePaymentCollectionReport(filters);

  const cols: ExportColumn[] = [
    { header: "Payment Method", key: "method" },
    { header: "Count", key: "count", format: "number" },
    { header: "Amount", key: "total", format: "currency" },
    { header: "Share %", key: "percentage", format: "percent" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3 mb-2">
        <SummaryCard title="Total Collections" value={fmt(data?.grandTotal)} sub={`${(data?.byMethod ?? []).reduce((s, r) => s + r.count, 0)} transactions`} icon={CreditCard} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">By Payment Method</CardTitle>
              <ExportToolbar data={(data?.byMethod ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`payment-collection-${range.dateFrom}`} title="Payment Collection Report" count={(data?.byMethod ?? []).length} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={4} /> : (data?.byMethod ?? []).length === 0 ? <EmptyRow cols={4} message="No payments. Click Refresh." /> : (data?.byMethod ?? []).map((r) => (
                  <TableRow key={r.method} className="text-sm">
                    <TableCell className="capitalize font-medium">{r.method}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${r.percentage}%` }} /></div>
                        <span className="text-xs text-muted-foreground">{r.percentage}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Payment Mix</CardTitle></CardHeader>
          <CardContent>
            {(data?.byMethod ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data?.byMethod ?? []} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80} label={({ method, percentage }) => `${method} ${percentage}%`}>
                    {(data?.byMethod ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet — click Refresh</div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Daily Collections</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="total" fill="#4472C4" name="Amount" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CASHIER SHIFT ────────────────────────────────────────────────────────────

function CashierShiftReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: today(), dateTo: today() });
  const [filters, setFilters] = useState<ReportFilters>({ dateFrom: today(), dateTo: today() });
  const { data, isLoading } = useCashierShiftReport(filters);

  const cols: ExportColumn[] = [
    { header: "Cashier", key: "cashierName", width: 20 },
    { header: "Sales Count", key: "salesCount", format: "number" },
    { header: "Total Sales", key: "totalSales", format: "currency" },
    { header: "Discount Given", key: "totalDiscount", format: "currency" },
    { header: "Tax Collected", key: "totalTax", format: "currency" },
    { header: "Avg Basket", key: "avgBasket", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Cashier Performance</CardTitle>
            <ExportToolbar data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={cols} filename={`cashier-shift-${range.dateFrom}`} title="Cashier Shift Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} count={data?.count} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Cashier</TableHead><TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Avg Basket</TableHead>
                  <TableHead>Payment Mix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={7} /> : (data?.data ?? []).length === 0 ? <EmptyRow cols={7} message="No cashier data. Click Refresh." /> : (data?.data ?? []).map((r, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell className="font-medium">{r.cashierName}</TableCell>
                    <TableCell className="text-right">{r.salesCount}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">{fmt(r.totalSales)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmt(r.totalDiscount)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.totalTax)}</TableCell>
                    <TableCell className="text-right">{fmt(r.avgBasket)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(r.paymentBreakdown).map(([method, amt]) => (
                          <Badge key={method} variant="outline" className="text-xs capitalize">{method}: {fmt(amt)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
    { header: "Exp #", key: "expenseNumber" },
    { header: "Date", key: "date", format: "date" },
    { header: "Description", key: "description", width: 30 },
    { header: "Category", key: "category" },
    { header: "Amount", key: "amount", format: "currency" },
    { header: "GST", key: "gstAmount", format: "currency" },
    { header: "Total", key: "totalAmount", format: "currency" },
    { header: "Status", key: "status" },
    { header: "Paid By", key: "paidBy" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Expenses" value={fmt(data?.totals.total)} sub={`${data?.count ?? 0} entries`} icon={Receipt} color="red" />
        <SummaryCard title="GST on Expenses" value={fmt(data?.totals.gst)} icon={Receipt} color="orange" />
        <SummaryCard title="Approved" value={fmt(data?.totals.approved)} icon={TrendingDown} color="green" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Expense Entries</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm w-[200px]" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`expenses-${range.dateFrom}`} title="Expense Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} summaryRows={[{ label: "Total", value: fmt(data?.totals.total) }]} count={rows.length} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Exp #</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead>
                  <TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST</TableHead><TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} message="No expenses. Click Refresh." /> : rows.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-mono text-xs">{r.expenseNumber}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.date}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.amount)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.gstAmount)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(r.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="text-xs">{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-gray-50 font-bold text-sm">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right">{fmt(data?.totals.total)}</TableCell>
                    <TableCell className="text-right">{fmt(data?.totals.gst)}</TableCell>
                    <TableCell className="text-right">{fmt((data?.totals.total ?? 0) + (data?.totals.gst ?? 0))}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DAILY CLOSING ────────────────────────────────────────────────────────────

function DailyClosingReport() {
  const [range, setRange] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const [filters, setFilters] = useState<DateRange>({ dateFrom: firstOfMonth(), dateTo: today() });
  const { data, isLoading } = useDailyClosingReport(filters);

  const rows = data?.data ?? [];

  const totals = rows.reduce((acc, r) => ({
    sales: acc.sales + r.totalSales,
    expenses: acc.expenses + r.totalExpenses,
    net: acc.net + r.netCash,
  }), { sales: 0, expenses: 0, net: 0 });

  const cols: ExportColumn[] = [
    { header: "Date", key: "date", format: "date" },
    { header: "Sales Count", key: "salesCount", format: "number" },
    { header: "Total Sales", key: "totalSales", format: "currency" },
    { header: "Total Tax", key: "totalTax", format: "currency" },
    { header: "Total Discount", key: "totalDiscount", format: "currency" },
    { header: "Expenses", key: "totalExpenses", format: "currency" },
    { header: "Net Cash", key: "netCash", format: "currency" },
  ];

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} onRefresh={() => setFilters(range)} isLoading={isLoading} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard title="Total Sales" value={fmt(totals.sales)} sub={`${rows.length} days`} icon={ShoppingCart} color="blue" />
        <SummaryCard title="Total Expenses" value={fmt(totals.expenses)} icon={Receipt} color="red" />
        <SummaryCard title="Net Cash" value={fmt(totals.net)} icon={TrendingUp} color="green" />
      </div>
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Daily Sales Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rows.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="totalSales" fill="#4472C4" name="Sales" radius={[3, 3, 0, 0]} />
                <Bar dataKey="totalExpenses" fill="#ED7D31" name="Expenses" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Daily Closing Summary</CardTitle>
            <ExportToolbar data={rows as unknown as Record<string, unknown>[]} columns={cols} filename={`daily-closing-${range.dateFrom}`} title="Daily Closing Report" subtitle={`${range.dateFrom} to ${range.dateTo}`} summaryRows={[{ label: "Total Net Cash", value: fmt(totals.net) }]} count={rows.length} landscape />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow className="text-xs">
                  <TableHead>Date</TableHead><TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Discount</TableHead><TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right font-bold">Net Cash</TableHead><TableHead>Payment Mix</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <LoadingRows cols={8} /> : rows.length === 0 ? <EmptyRow cols={8} message="No data. Click Refresh." /> : rows.map((r) => (
                  <TableRow key={r.date} className="text-sm">
                    <TableCell className="font-medium whitespace-nowrap">{new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-right">{r.salesCount}</TableCell>
                    <TableCell className="text-right">{fmt(r.totalSales)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.totalTax)}</TableCell>
                    <TableCell className="text-right text-red-500">-{fmt(r.totalDiscount)}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(r.totalExpenses)}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{fmt(r.netCash)}</TableCell>
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
                  <TableRow className="bg-blue-50 font-bold text-sm">
                    <TableCell colSpan={2}>Period Total</TableCell>
                    <TableCell className="text-right">{fmt(totals.sales)}</TableCell>
                    <TableCell /><TableCell />
                    <TableCell className="text-right text-red-600">{fmt(totals.expenses)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(totals.net)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "purchases", label: "Purchases", icon: Truck },
  { id: "gst", label: "GST", icon: Receipt },
  { id: "payment-collection", label: "Payments", icon: CreditCard },
  { id: "stock-valuation", label: "Stock Value", icon: Package },
  { id: "low-stock", label: "Low Stock", icon: AlertTriangle },
  { id: "dead-stock", label: "Dead Stock", icon: Package },
  { id: "customer-ledger", label: "Customers", icon: Users },
  { id: "supplier-ledger", label: "Suppliers", icon: Truck },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "cashier-shift", label: "Cashiers", icon: Users },
  { id: "daily-closing", label: "Daily", icon: Calendar },
];

export default function ReportsPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate, filter, export, and print business reports</p>
      </div>
      <Tabs defaultValue="sales">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-9 flex-nowrap min-w-max gap-0.5">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-7 text-xs px-3 gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="mt-4">
          <TabsContent value="sales"><SalesReport /></TabsContent>
          <TabsContent value="purchases"><PurchaseReport /></TabsContent>
          <TabsContent value="gst"><GstReport /></TabsContent>
          <TabsContent value="payment-collection"><PaymentCollectionReport /></TabsContent>
          <TabsContent value="stock-valuation"><StockValuationReport /></TabsContent>
          <TabsContent value="low-stock"><LowStockReport /></TabsContent>
          <TabsContent value="dead-stock"><DeadStockReport /></TabsContent>
          <TabsContent value="customer-ledger"><CustomerLedgerReport /></TabsContent>
          <TabsContent value="supplier-ledger"><SupplierLedgerReport /></TabsContent>
          <TabsContent value="expenses"><ExpensesReport /></TabsContent>
          <TabsContent value="cashier-shift"><CashierShiftReport /></TabsContent>
          <TabsContent value="daily-closing"><DailyClosingReport /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
