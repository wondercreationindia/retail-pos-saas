import { useQuery } from "@tanstack/react-query";

const API_BASE = "/api";

function getToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem("pos_token") : null;
}

async function reportFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );
  const qs = new URLSearchParams(filtered as Record<string, string>).toString();
  const url = `${API_BASE}${path}${qs ? "?" + qs : ""}`;
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type DateFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type ReportFilters = DateFilters & {
  customerId?: string;
  supplierId?: string;
  cashierId?: string;
  categoryId?: string;
  paymentMethod?: string;
  status?: string;
  paymentStatus?: string;
  search?: string;
  days?: string;
  limit?: string;
};

// ── Shared row types ─────────────────────────────────────────────────────────

export type SalesReportRow = {
  id: number;
  saleNumber: string;
  date: string;
  customerName: string | null;
  cashierName: string | null;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  paymentStatus: string;
};

export type PurchaseReportRow = {
  id: number;
  purchaseNumber: string;
  invoiceNumber: string | null;
  date: string;
  supplierName: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
};

export type GstRow = { gstRate: number; taxableAmount: number; gstAmount: number; invoiceCount: number };

export type StockValuationRow = {
  id: number;
  name: string;
  sku: string | null;
  categoryName: string | null;
  unit: string | null;
  stock: number;
  costPrice: number;
  price: number;
  mrp: number;
  costValue: number;
  retailValue: number;
};

export type LowStockRow = {
  id: number;
  name: string;
  sku: string | null;
  categoryName: string | null;
  unit: string | null;
  stock: number;
  minStockAlert: number;
  price: number;
  shortage: number;
};

export type DeadStockRow = {
  id: number;
  name: string;
  sku: string | null;
  categoryName: string | null;
  stock: number;
  price: number;
  costPrice: number;
  stockValue: number;
};

export type CustomerLedgerRow = {
  customerId: number | null;
  customerName: string;
  totalSales: number;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
};

export type SupplierLedgerRow = {
  supplierId: number | null;
  supplierName: string;
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
};

export type PaymentCollectionRow = {
  method: string;
  count: number;
  total: number;
  percentage: number;
};

export type CashierShiftRow = {
  cashierId: number | null;
  cashierName: string;
  salesCount: number;
  totalSales: number;
  totalDiscount: number;
  totalTax: number;
  avgBasket: number;
  paymentBreakdown: Record<string, number>;
};

export type ExpenseReportRow = {
  id: number;
  date: string;
  expenseNumber: string;
  description: string;
  category: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  status: string;
  paidBy: string | null;
};

export type DailyClosingRow = {
  date: string;
  salesCount: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
  totalExpenses: number;
  paymentBreakdown: Record<string, number>;
  netCash: number;
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSalesReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-sales", filters],
    queryFn: () => reportFetch<{ data: SalesReportRow[]; totals: Record<string, number>; count: number }>("/reports/sales", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function usePurchaseReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-purchases", filters],
    queryFn: () => reportFetch<{ data: PurchaseReportRow[]; totals: Record<string, number>; count: number }>("/reports/purchases", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useGstReport(filters: DateFilters) {
  return useQuery({
    queryKey: ["report-gst", filters],
    queryFn: () => reportFetch<{
      dateFrom: string; dateTo: string;
      outputGst: { rows: GstRow[]; total: number };
      inputGst: { rows: GstRow[]; total: number };
      netPayable: number;
    }>("/reports/gst", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useStockValuationReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-stock-valuation", filters],
    queryFn: () => reportFetch<{ data: StockValuationRow[]; totals: Record<string, number>; count: number }>("/reports/stock-valuation", filters as Record<string, string>),
    enabled: true,
  });
}

export function useLowStockReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-low-stock", filters],
    queryFn: () => reportFetch<{ data: LowStockRow[]; count: number }>("/reports/low-stock", filters as Record<string, string>),
    enabled: true,
  });
}

export function useDeadStockReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-dead-stock", filters],
    queryFn: () => reportFetch<{ data: DeadStockRow[]; count: number; noSaleDays: number }>("/reports/dead-stock", filters as Record<string, string>),
    enabled: true,
  });
}

export function useCustomerLedgerReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-customer-ledger", filters],
    queryFn: () => reportFetch<{ data: CustomerLedgerRow[]; count: number }>("/reports/customer-ledger", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useSupplierLedgerReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-supplier-ledger", filters],
    queryFn: () => reportFetch<{ data: SupplierLedgerRow[]; count: number }>("/reports/supplier-ledger", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function usePaymentCollectionReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-payment-collection", filters],
    queryFn: () => reportFetch<{
      byMethod: PaymentCollectionRow[];
      daily: { date: string; total: number; count: number }[];
      grandTotal: number;
    }>("/reports/payment-collection", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useCashierShiftReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-cashier-shift", filters],
    queryFn: () => reportFetch<{ data: CashierShiftRow[]; count: number }>("/reports/cashier-shift", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useExpenseReport(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-expenses", filters],
    queryFn: () => reportFetch<{
      data: ExpenseReportRow[];
      byCategory: { category: string; count: number; total: number }[];
      totals: Record<string, number>;
      count: number;
    }>("/reports/expenses", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}

export function useDailyClosingReport(filters: DateFilters) {
  return useQuery({
    queryKey: ["report-daily-closing", filters],
    queryFn: () => reportFetch<{ data: DailyClosingRow[]; count: number }>("/reports/daily-closing", filters as Record<string, string>),
    enabled: !!filters.dateFrom,
  });
}
