import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListSales,
  useGetSale,
  useVoidSale,
  useEditSale,
  useLogSalePrint,
  useLogSaleWhatsapp,
  useGetSaleEdits,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, LayoutDashboard, ChevronRight, Receipt, Printer, MessageCircle,
  Edit2, Ban, History, X, Eye, AlertTriangle, ChevronDown, ChevronUp,
  FileText, Smartphone, Clock, ArrowLeft,
} from "lucide-react";

type Sale = {
  id: number;
  saleNumber: string;
  customerId?: number | null;
  customerName?: string | null;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  paymentStatus: string;
  notes?: string | null;
  loyaltyPointsEarned?: number;
  createdAt: string;
  items?: SaleItem[];
  payments?: Payment[];
};

type SaleItem = {
  id: number;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
};

type Payment = {
  id: number;
  method: string;
  amount: number;
  reference?: string | null;
};

function fmt(n: number) {
  return `₹${n.toFixed(2)}`;
}

function statusColor(status: string) {
  if (status === "voided") return "bg-red-100 text-red-700 border-red-200";
  if (status === "completed") return "bg-green-100 text-green-700 border-green-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

// ─── Print Helper ─────────────────────────────────────────────────────────────
function printInvoice(sale: Sale, type: "thermal" | "a4" | "gst", isDuplicate = false) {
  const items = sale.items ?? [];
  const payments = sale.payments ?? [];
  const date = new Date(sale.createdAt).toLocaleString("en-IN");
  const dupWatermark = isDuplicate ? `<div style="text-align:center;font-size:18px;color:#ccc;border:2px dashed #ccc;padding:4px;margin:6px 0;letter-spacing:4px;font-weight:bold">DUPLICATE COPY</div>` : "";

  const thermalHtml = `
    <html><head><title>Receipt #${sale.saleNumber}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 12px; padding: 12px; width: 302px; }
      .center { text-align: center; } .right { text-align: right; }
      hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; font-size: 11px; vertical-align: top; }
      @media print { @page { margin: 0; size: 80mm auto; } body { padding: 4px; } }
    </style></head>
    <body>
      <div class="center" style="font-weight:bold;font-size:14px">RETAIL POS</div>
      <div class="center" style="font-size:11px">${date}</div>
      ${dupWatermark}
      <hr/>
      <div><strong>Bill: ${sale.saleNumber}</strong></div>
      ${sale.customerName ? `<div>Customer: ${sale.customerName}</div>` : ""}
      <hr/>
      <table>
        ${items.map(i => `<tr><td>${i.productName}<br/><span style="font-size:10px">${i.quantity} × ₹${i.unitPrice.toFixed(2)}</span></td><td class="right">₹${i.total.toFixed(2)}</td></tr>`).join("")}
      </table>
      <hr/>
      <table>
        <tr><td>Subtotal</td><td class="right">₹${sale.subtotal.toFixed(2)}</td></tr>
        ${sale.discountAmount > 0 ? `<tr><td>Discount</td><td class="right">-₹${sale.discountAmount.toFixed(2)}</td></tr>` : ""}
        ${sale.taxAmount > 0 ? `<tr><td>GST</td><td class="right">₹${sale.taxAmount.toFixed(2)}</td></tr>` : ""}
        <tr><td><strong>TOTAL</strong></td><td class="right"><strong>₹${sale.total.toFixed(2)}</strong></td></tr>
      </table>
      <hr/>
      ${payments.map(p => `<div>${p.method.toUpperCase()}: ₹${p.amount.toFixed(2)}${p.reference ? ` (${p.reference})` : ""}</div>`).join("")}
      <hr/>
      <div class="center" style="font-size:11px">Thank you! Come again 🙏</div>
    </body></html>`;

  const a4Html = `
    <html><head><title>Invoice #${sale.saleNumber}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 13px; padding: 32px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 4px; } h2 { font-size: 14px; color: #555; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 12px; border: 1px solid #e5e7eb; }
      td { padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 12px; }
      .totals-row { background: #f9fafb; }
      .grand-total { font-weight: bold; font-size: 14px; background: #111; color: #fff; }
      .watermark { text-align:center; font-size:24px; color:#ddd; border:3px dashed #ddd; padding:6px; margin:12px 0; letter-spacing:6px; font-weight:bold; }
    </style></head>
    <body>
      <div class="header">
        <div><h1>RETAIL POS</h1><h2>Tax Invoice</h2></div>
        <div style="text-align:right">
          <div><strong>Invoice #${sale.saleNumber}</strong></div>
          <div style="color:#666;font-size:12px">${date}</div>
          ${sale.customerName ? `<div style="margin-top:8px"><strong>Bill To:</strong><br/>${sale.customerName}</div>` : ""}
        </div>
      </div>
      ${isDuplicate ? `<div class="watermark">DUPLICATE COPY</div>` : ""}
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>GST%</th><th>GST Amt</th><th>Amount</th></tr></thead>
        <tbody>
          ${items.map((i, idx) => `
            <tr>
              <td>${idx + 1}</td><td>${i.productName}${i.sku ? `<br/><span style="font-size:10px;color:#888">${i.sku}</span>` : ""}</td>
              <td>${i.quantity}</td><td>₹${i.unitPrice.toFixed(2)}</td>
              <td>${i.gstRate}%</td><td>₹${i.gstAmount.toFixed(2)}</td><td>₹${i.total.toFixed(2)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end">
        <table style="width:280px">
          <tr class="totals-row"><td>Subtotal</td><td style="text-align:right">₹${sale.subtotal.toFixed(2)}</td></tr>
          ${sale.discountAmount > 0 ? `<tr class="totals-row"><td>Discount</td><td style="text-align:right">-₹${sale.discountAmount.toFixed(2)}</td></tr>` : ""}
          ${sale.taxAmount > 0 ? `<tr class="totals-row"><td>Total GST</td><td style="text-align:right">₹${sale.taxAmount.toFixed(2)}</td></tr>` : ""}
          <tr class="grand-total"><td>TOTAL</td><td style="text-align:right">₹${sale.total.toFixed(2)}</td></tr>
        </table>
      </div>
      <div style="margin-top:24px;color:#888;font-size:11px;text-align:center">Payment: ${payments.map(p => `${p.method.toUpperCase()} ₹${p.amount.toFixed(2)}`).join(", ")} · Thank you for your business!</div>
    </body></html>`;

  const html = type === "thermal" ? thermalHtml : a4Html;
  const win = window.open("", "_blank", "width=700,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── WhatsApp Helper ──────────────────────────────────────────────────────────
function shareWhatsApp(sale: Sale, phone: string) {
  const items = sale.items ?? [];
  const lines = [
    `*RETAIL POS — Invoice #${sale.saleNumber}*`,
    `Date: ${new Date(sale.createdAt).toLocaleString("en-IN")}`,
    sale.customerName ? `Customer: ${sale.customerName}` : "",
    ``,
    ...items.map((i) => `${i.productName} × ${i.quantity} = ₹${i.total.toFixed(2)}`),
    ``,
    `Subtotal: ₹${sale.subtotal.toFixed(2)}`,
    sale.discountAmount > 0 ? `Discount: -₹${sale.discountAmount.toFixed(2)}` : "",
    sale.taxAmount > 0 ? `GST: ₹${sale.taxAmount.toFixed(2)}` : "",
    `*TOTAL: ₹${sale.total.toFixed(2)}*`,
    ``,
    `Thank you for shopping! 🙏`,
  ].filter(Boolean).join("\n");
  const clean = phone.replace(/\D/g, "");
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(lines)}`, "_blank");
}

// ─── Sale Detail Drawer ───────────────────────────────────────────────────────
function SaleDetail({ saleId, onClose, onEdit, onVoid, isManager }: {
  saleId: number;
  onClose: () => void;
  onEdit: (sale: Sale) => void;
  onVoid: (sale: Sale) => void;
  isManager: boolean;
}) {
  const { data: sale } = useGetSale(saleId) as { data: Sale | undefined };
  const { data: edits = [] } = useGetSaleEdits(saleId);
  const logPrint = useLogSalePrint();
  const logWA = useLogSaleWhatsapp();
  const [whatsappPhone, setWhatsappPhone] = useState(sale?.customerName ? "" : "");
  const [showEdits, setShowEdits] = useState(false);

  if (!sale) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent><div className="py-8 text-center text-muted-foreground">Loading…</div></DialogContent>
    </Dialog>
  );

  const handlePrint = async (type: "thermal" | "a4" | "gst", isDup = false) => {
    printInvoice(sale, type, isDup);
    await logPrint.mutateAsync({ id: saleId, data: { printType: type, isDuplicate: isDup } });
  };

  const handleWhatsApp = async (ph: string) => {
    shareWhatsApp(sale, ph);
    await logWA.mutateAsync({ id: saleId, data: { phone: ph } });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice {sale.saleNumber}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(sale.status)}`}>
              {sale.status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Date:</span> {new Date(sale.createdAt).toLocaleString("en-IN")}</div>
            {sale.customerName && <div><span className="text-muted-foreground">Customer:</span> {sale.customerName}</div>}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-medium text-sm mb-2">Items</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Rate</th>
                    <th className="text-right px-3 py-2">GST</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.productName}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{fmt(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{item.gstRate > 0 ? `${item.gstRate}%` : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
              {sale.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(sale.discountAmount)}</span></div>}
              {sale.taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>GST</span><span>{fmt(sale.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span className="text-primary">{fmt(sale.total)}</span></div>
            </div>
          </div>

          {/* Payments */}
          {(sale.payments ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(sale.payments ?? []).map((p) => (
                <span key={p.id} className="text-xs bg-muted px-2 py-1 rounded-md font-medium">
                  {p.method.toUpperCase()}: {fmt(p.amount)}
                  {p.reference && <span className="text-muted-foreground ml-1">({p.reference})</span>}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 space-y-3">
            {/* Print */}
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">Print Invoice</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handlePrint("thermal")}>
                  <Printer className="h-3.5 w-3.5" />Thermal
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handlePrint("a4")}>
                  <FileText className="h-3.5 w-3.5" />A4
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handlePrint("gst")}>
                  <FileText className="h-3.5 w-3.5" />GST Invoice
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-muted-foreground" onClick={() => handlePrint("thermal", true)}>
                  <Printer className="h-3.5 w-3.5" />Duplicate
                </Button>
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">Share via WhatsApp</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter mobile number"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button size="sm" className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleWhatsApp(whatsappPhone)}
                  disabled={!whatsappPhone.trim()}>
                  <Smartphone className="h-3.5 w-3.5" />Send
                </Button>
              </div>
            </div>

            {/* Manager actions */}
            {isManager && sale.status !== "voided" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => onEdit(sale)}>
                  <Edit2 className="h-3.5 w-3.5" />Edit Invoice
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onVoid(sale)}>
                  <Ban className="h-3.5 w-3.5" />Void Invoice
                </Button>
              </div>
            )}

            {/* Audit log */}
            {(edits as unknown[]).length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowEdits((v) => !v)}
                >
                  <History className="h-3.5 w-3.5" />
                  Audit Log ({(edits as unknown[]).length})
                  {showEdits ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showEdits && (
                  <div className="mt-2 space-y-1.5">
                    {(edits as { id: number; reason: string; editedBy: number | null; createdAt: string }[]).map((e) => (
                      <div key={e.id} className="text-xs border rounded-md px-2.5 py-2 bg-muted/30">
                        <div className="font-medium">{e.reason}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {new Date(e.createdAt).toLocaleString("en-IN")}
                          {e.editedBy && ` · User #${e.editedBy}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Void Modal ───────────────────────────────────────────────────────────────
function VoidModal({ sale, onConfirm, onClose }: { sale: Sale; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-4 w-4" />Void Invoice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Voiding <strong>{sale.saleNumber}</strong> will reverse the inventory deduction and mark it as cancelled. This cannot be undone.
          </p>
          <div>
            <label className="text-xs font-medium">Reason *</label>
            <Input className="mt-1" placeholder="e.g. Customer request, billing error" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" className="flex-1" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Void Invoice</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InvoiceHistory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [voidSale, setVoidSale] = useState<Sale | null>(null);

  const { data: salesRaw = [], isLoading } = useListSales({
    limit: 200,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const sales = useMemo(() => {
    let list = salesRaw as unknown as Sale[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.saleNumber.toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [salesRaw, search, statusFilter]);

  const voidMutation = useVoidSale();

  const handleVoid = async (reason: string) => {
    if (!voidSale) return;
    try {
      await voidMutation.mutateAsync({ id: voidSale.id, data: { reason } });
      qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
      toast({ title: `Invoice ${voidSale.saleNumber} voided` });
      setVoidSale(null);
      setSelectedId(null);
    } catch {
      toast({ title: "Failed to void invoice", variant: "destructive" });
    }
  };

  const handlePrintDirect = (sale: Sale, type: "thermal" | "a4" | "gst") => {
    printInvoice(sale, type);
  };

  const handleWhatsAppDirect = (sale: Sale) => {
    const phone = prompt("Enter customer's WhatsApp number:");
    if (phone) shareWhatsApp(sale, phone);
  };

  const totalRevenue = useMemo(() =>
    sales.filter((s) => s.status !== "voided").reduce((acc, s) => acc + s.total, 0),
    [sales]
  );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0 z-10 gap-3">
        <div className="flex items-center gap-2">
          <Link href="/pos">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">POS</span>
            </Button>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-8 px-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Dashboard</span>
            </Button>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
          <span className="font-bold text-sm flex items-center gap-1.5">
            <History className="h-4 w-4 text-primary" />Invoice History
          </span>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          {sales.length} invoices · Revenue: <strong>₹{totalRevenue.toFixed(2)}</strong>
        </div>
      </header>

      {/* Filters */}
      <div className="shrink-0 px-4 py-3 border-b bg-background flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoice or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 text-xs border rounded-md px-2 bg-background"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
        </select>
        {(search || dateFrom || dateTo || statusFilter) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); }}>
            <X className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Loading invoices…</div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-muted/70 backdrop-blur-sm border-b z-10">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Invoice #</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-2.5">
                    <button
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                      onClick={() => setSelectedId(sale.id)}
                    >
                      {sale.saleNumber}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(sale.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs hidden md:table-cell">
                    {sale.customerName ?? <span className="text-muted-foreground">Walk-in</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusColor(sale.status)}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-sm font-bold ${sale.status === "voided" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {fmt(sale.total)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="View"
                        onClick={() => setSelectedId(sale.id)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Thermal Print"
                        onClick={() => handlePrintDirect(sale, "thermal")}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="A4 Print"
                        onClick={() => handlePrintDirect(sale, "a4")}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="WhatsApp"
                        onClick={() => handleWhatsAppDirect(sale)}
                        className="p-1.5 rounded hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                      {isManager && sale.status !== "voided" && (
                        <button
                          title="Void"
                          onClick={() => setVoidSale(sale)}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {selectedId && (
        <SaleDetail
          saleId={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={(s) => { setEditSale(s); setSelectedId(null); }}
          onVoid={(s) => { setVoidSale(s); setSelectedId(null); }}
          isManager={isManager}
        />
      )}

      {voidSale && (
        <VoidModal
          sale={voidSale}
          onConfirm={handleVoid}
          onClose={() => setVoidSale(null)}
        />
      )}
    </div>
  );
}
