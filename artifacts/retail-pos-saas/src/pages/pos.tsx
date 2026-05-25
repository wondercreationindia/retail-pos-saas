import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useListProducts,
  useListCategories,
  useListCustomers,
  useCreateSale,
  useListHeldBills,
  useCreateHeldBill,
  useDeleteHeldBill,
  useValidateCoupon,
  usePosQuickAddCustomer,
  useGetCustomerPosHistory,
  useGetActiveSession,
  useOpenCashierSession,
  useCloseCashierSession,
  getListHeldBillsQueryKey,
  getListCustomersQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Search, ShoppingCart, Trash2, Plus, Minus, User, Pause, Play,
  Receipt, X, CreditCard, Banknote, Smartphone, Printer, LayoutDashboard,
  Clock, ChevronRight, Star, Zap, Tag, Gift, RotateCcw, MessageCircle,
  UserPlus, History, Percent, DollarSign, Timer, CheckCircle2, IndianRupee,
  FileText, LogOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  salePrice?: number | null;
  mrp?: number | null;
  gstRate?: number | null;
  stock?: number | null;
  categoryId?: number | null;
};

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  loyaltyPoints?: number;
  outstandingDues?: number | null;
  creditLimit?: number | null;
  isCredit?: boolean;
};

type CartItem = {
  productId: number;
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  mrp?: number | null;
  discountPct: number;
  discountAmount: number;
  gstRate: number;
  gstAmount: number;
  subtotal: number;
  total: number;
};

type PaymentLine = {
  method: "cash" | "card" | "upi" | "credit";
  amount: number;
  reference?: string;
};

type BillDiscount = {
  type: "percentage" | "fixed";
  value: number;
  reason: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LOYALTY_RATE = 1; // 1 point per ₹100
const LOYALTY_REDEEM_VALUE = 1; // 1 point = ₹1
const LOYALTY_MIN_REDEEM = 10; // min 10 points to redeem

const FAVORITES_KEY = "pos_favorites";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcItem(
  item: Omit<CartItem, "discountAmount" | "gstAmount" | "subtotal" | "total">
): CartItem {
  const base = item.unitPrice * item.quantity;
  const discountAmount = Math.round((base * item.discountPct) / 100 * 100) / 100;
  const afterDiscount = base - discountAmount;
  const gstAmount = Math.round((afterDiscount * item.gstRate) / 100 * 100) / 100;
  const total = Math.round((afterDiscount + gstAmount) * 100) / 100;
  return { ...item, discountAmount, gstAmount, subtotal: afterDiscount, total };
}

function rawTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemDiscounts = items.reduce((s, i) => s + i.discountAmount, 0);
  const taxAmount = items.reduce((s, i) => s + i.gstAmount, 0);
  const afterItemDiscounts = subtotal - itemDiscounts;
  return { subtotal, itemDiscounts, afterItemDiscounts, taxAmount };
}

function getFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(JSON.parse(raw ?? "[]") as number[]);
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<number>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

// ─── Thermal Receipt ─────────────────────────────────────────────────────────

function ThermalReceipt({
  sale,
  items,
  payments,
  customer,
  totals,
  onClose,
}: {
  sale: { saleNumber: string; total: number; paidAmount: number; changeAmount: number; loyaltyPointsEarned?: number };
  items: CartItem[];
  payments: PaymentLine[];
  customer?: Customer | null;
  totals: { subtotal: number; discountAmount: number; taxAmount: number; total: number };
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=400,height=750");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt #${sale.saleNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 12px; width: 302px; }
        .center { text-align: center; }
        .right { text-align: right; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; font-size: 11px; vertical-align: top; }
        .bold { font-weight: bold; }
        .big { font-size: 14px; }
        @media print { @page { margin: 0; size: 80mm auto; } body { padding: 4px; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const handleWhatsApp = () => {
    if (!customer?.phone) return;
    const lines = [
      `*RETAIL POS — Receipt*`,
      `Bill No: ${sale.saleNumber}`,
      `Date: ${new Date().toLocaleString()}`,
      customer ? `Customer: ${customer.name}` : "",
      ``,
      items.map((i) => `${i.productName} x${i.quantity} = ₹${i.total.toFixed(2)}`).join("\n"),
      ``,
      `Subtotal: ₹${totals.subtotal.toFixed(2)}`,
      totals.discountAmount > 0 ? `Discount: -₹${totals.discountAmount.toFixed(2)}` : "",
      totals.taxAmount > 0 ? `GST: ₹${totals.taxAmount.toFixed(2)}` : "",
      `*TOTAL: ₹${totals.total.toFixed(2)}*`,
      sale.changeAmount > 0 ? `Change: ₹${sale.changeAmount.toFixed(2)}` : "",
      sale.loyaltyPointsEarned ? `Points Earned: +${sale.loyaltyPointsEarned}` : "",
      ``,
      `Thank you for shopping! 🙏`,
    ].filter(Boolean).join("\n");

    const phone = customer.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, "_blank");
  };

  const now = new Date();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Receipt — {sale.saleNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Thermal preview */}
        <div
          ref={printRef}
          className="font-mono text-xs border rounded-lg p-4 bg-white max-h-72 overflow-y-auto select-text"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          <div className="text-center font-bold text-sm">RETAIL POS</div>
          <div className="text-center text-xs">{now.toLocaleString()}</div>
          <hr className="my-1 border-dashed" />
          <div>Bill: <strong>{sale.saleNumber}</strong></div>
          {customer && <div>Customer: {customer.name}{customer.phone ? ` (${customer.phone})` : ""}</div>}
          <hr className="my-1 border-dashed" />
          <table>
            <thead>
              <tr>
                <td className="font-bold">Item</td>
                <td align="right" className="font-bold">Qty</td>
                <td align="right" className="font-bold">Rate</td>
                <td align="right" className="font-bold">Amt</td>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <React.Fragment key={i}>
                  <tr>
                    <td style={{ maxWidth: 110, wordBreak: "break-word" }}>{item.productName}</td>
                    <td align="right">{item.quantity}</td>
                    <td align="right">₹{item.unitPrice.toFixed(2)}</td>
                    <td align="right">₹{item.total.toFixed(2)}</td>
                  </tr>
                  {item.discountPct > 0 && (
                    <tr>
                      <td colSpan={3} style={{ paddingLeft: 8, color: "#666" }}>  Disc {item.discountPct}%</td>
                      <td align="right" style={{ color: "#666" }}>-₹{item.discountAmount.toFixed(2)}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <hr className="my-1 border-dashed" />
          <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-₹{totals.discountAmount.toFixed(2)}</span></div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between"><span>GST</span><span>₹{totals.taxAmount.toFixed(2)}</span></div>
          )}
          <hr className="my-1 border-dashed" />
          <div className="flex justify-between font-bold"><span>TOTAL</span><span>₹{totals.total.toFixed(2)}</span></div>
          <hr className="my-1 border-dashed" />
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between capitalize"><span>{p.method}</span><span>₹{p.amount.toFixed(2)}</span></div>
          ))}
          {sale.changeAmount > 0.001 && (
            <div className="flex justify-between"><span>Change</span><span>₹{sale.changeAmount.toFixed(2)}</span></div>
          )}
          {sale.loyaltyPointsEarned && sale.loyaltyPointsEarned > 0 ? (
            <div className="flex justify-between mt-1 text-green-700"><span>Points Earned</span><span>+{sale.loyaltyPointsEarned}</span></div>
          ) : null}
          <hr className="my-1 border-dashed" />
          <div className="text-center mt-2">Thank you for shopping! 🙏</div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />Print
          </Button>
          {customer?.phone && (
            <Button variant="outline" className="flex-1 text-green-600 border-green-200 hover:bg-green-50" onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="shrink-0">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  total,
  customer,
  loyaltyToRedeem,
  onLoyaltyChange,
  onConfirm,
  onClose,
  loading,
}: {
  total: number;
  customer: Customer | null;
  loyaltyToRedeem: number;
  onLoyaltyChange: (pts: number) => void;
  onConfirm: (payments: PaymentLine[], change: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const loyaltyDiscount = loyaltyToRedeem * LOYALTY_REDEEM_VALUE;
  const effectiveTotal = Math.max(0, total - loyaltyDiscount);

  const [payments, setPayments] = useState<PaymentLine[]>([
    { method: "cash", amount: effectiveTotal, reference: "" },
  ]);

  // Sync when effective total changes
  useEffect(() => {
    if (payments.length === 1) {
      setPayments([{ ...payments[0], amount: effectiveTotal }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTotal]);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const change = Math.max(0, totalPaid - effectiveTotal);
  const remaining = Math.max(0, effectiveTotal - totalPaid);

  const availablePoints = customer?.loyaltyPoints ?? 0;
  const maxRedeemable = Math.min(
    Math.floor(availablePoints),
    Math.floor(effectiveTotal / LOYALTY_REDEEM_VALUE)
  );

  const addPayment = (method: PaymentLine["method"]) =>
    setPayments((prev) => [...prev, { method, amount: remaining, reference: "" }]);

  const updatePayment = (idx: number, field: keyof PaymentLine, value: string | number) =>
    setPayments((prev) =>
      prev.map((p, i) =>
        i === idx
          ? { ...p, [field]: field === "amount" ? parseFloat(String(value)) || 0 : value }
          : p
      )
    );

  const removePayment = (idx: number) =>
    setPayments((prev) => prev.filter((_, i) => i !== idx));

  const methodIcon: Record<string, React.ReactNode> = {
    cash: <Banknote className="h-4 w-4" />,
    card: <CreditCard className="h-4 w-4" />,
    upi: <Smartphone className="h-4 w-4" />,
    credit: <User className="h-4 w-4" />,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Loyalty redeem */}
          {customer && availablePoints >= LOYALTY_MIN_REDEEM && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <Gift className="h-4 w-4" />
                  Loyalty Points: <strong>{availablePoints}</strong>
                  <span className="text-xs text-amber-600">(= ₹{availablePoints})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 shrink-0">Redeem</span>
                <input
                  type="number"
                  min={0}
                  max={maxRedeemable}
                  value={loyaltyToRedeem || ""}
                  placeholder="0"
                  onChange={(e) => onLoyaltyChange(Math.min(parseInt(e.target.value) || 0, maxRedeemable))}
                  className="w-20 h-7 rounded border text-sm px-2 bg-white text-center"
                />
                <span className="text-xs text-amber-700">pts = ₹{loyaltyToRedeem * LOYALTY_REDEEM_VALUE}</span>
                {maxRedeemable > 0 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs ml-auto"
                    onClick={() => onLoyaltyChange(maxRedeemable)}>
                    Max
                  </Button>
                )}
              </div>
              {loyaltyDiscount > 0 && (
                <div className="text-xs text-amber-700 mt-1">
                  Bill reduced: ₹{total.toFixed(2)} → ₹{effectiveTotal.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Quick cash */}
          <div className="flex gap-1.5 flex-wrap">
            {[50, 100, 200, 500, 1000, 2000].map((amt) => (
              <Button key={amt} variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setPayments([{ method: "cash", amount: amt, reference: "" }])}>
                ₹{amt}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="text-xs h-8"
              onClick={() => setPayments([{ method: "cash", amount: effectiveTotal, reference: "" }])}>
              Exact
            </Button>
          </div>

          {/* Payment lines */}
          {payments.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 w-20 text-sm font-medium capitalize shrink-0">
                {methodIcon[p.method]}<span>{p.method}</span>
              </div>
              <Input type="number" min={0} step="0.01" value={p.amount || ""} className="w-28 shrink-0"
                onChange={(e) => updatePayment(idx, "amount", e.target.value)} />
              {(p.method === "card" || p.method === "upi") && (
                <Input placeholder="Ref / UTR" value={p.reference ?? ""} className="flex-1 min-w-0"
                  onChange={(e) => updatePayment(idx, "reference", e.target.value)} />
              )}
              {payments.length > 1 && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removePayment(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {/* Add split */}
          <div className="flex gap-1.5">
            {(["card", "upi", "credit"] as PaymentLine["method"][]).map((m) => (
              <Button key={m} variant="outline" size="sm" className="capitalize text-xs" onClick={() => addPayment(m)}>
                {methodIcon[m]}<span className="ml-1">+ {m}</span>
              </Button>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bill Total</span>
              <span className="font-medium">₹{total.toFixed(2)}</span>
            </div>
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Loyalty Discount</span><span>-₹{loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>Amount Due</span><span className="text-primary">₹{effectiveTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>₹{totalPaid.toFixed(2)}</span></div>
            {remaining > 0.001 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Remaining</span><span>₹{remaining.toFixed(2)}</span>
              </div>
            )}
            {change > 0.001 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Change</span><span>₹{change.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 h-11 text-base font-bold"
              disabled={remaining > 0.001 || loading}
              onClick={() => onConfirm(payments, change)}>
              {loading ? "Processing…" : `Confirm ₹${effectiveTotal.toFixed(2)}`}
            </Button>
            <Button variant="outline" className="h-11" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Customer Picker ──────────────────────────────────────────────────────────

function CustomerPicker({
  onSelect,
  onClose,
}: {
  onSelect: (c: Customer | null) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [historyFor, setHistoryFor] = useState<number | null>(null);

  const { data: customers = [] } = useListCustomers({ search: search || undefined });
  const quickAdd = usePosQuickAddCustomer();
  const { data: history = [] } = useGetCustomerPosHistory(historyFor ?? 0, {
    query: { enabled: historyFor !== null, queryKey: ["pos-customer-history", historyFor] },
  });

  const handleQuickAdd = async () => {
    if (!newName.trim()) return;
    try {
      const c = await quickAdd.mutateAsync({ data: { name: newName.trim(), phone: newPhone.trim() || null } });
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      onSelect(c as unknown as Customer);
      toast({ title: `Customer "${c.name}" added` });
    } catch {
      toast({ title: "Failed to add customer", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Select Customer
          </DialogTitle>
        </DialogHeader>

        {showAdd ? (
          <div className="space-y-3">
            <Input placeholder="Customer name *" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <Input placeholder="Phone number" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleQuickAdd} disabled={quickAdd.isPending || !newName.trim()}>
                <UserPlus className="h-4 w-4 mr-1.5" />{quickAdd.isPending ? "Adding…" : "Add Customer"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Back</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => setShowAdd(true)} title="Add new customer">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-0.5 max-h-80 overflow-y-auto -mx-1 px-1">
              {/* Walk-in */}
              <button
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                onClick={() => onSelect(null)}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm text-muted-foreground">Walk-in Customer</span>
              </button>

              {(customers as Customer[]).map((c) => (
                <div key={c.id} className="flex items-center group">
                  <button
                    className="flex-1 text-left px-3 py-2.5 rounded-l-lg hover:bg-muted transition-colors"
                    onClick={() => onSelect(c)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {c.phone && <span>{c.phone}</span>}
                          {(c.loyaltyPoints ?? 0) > 0 && (
                            <span className="text-amber-600 flex items-center gap-0.5">
                              <Gift className="h-3 w-3" />{c.loyaltyPoints} pts
                            </span>
                          )}
                          {(c.outstandingDues ?? 0) > 0 && (
                            <span className="text-red-500">₹{Number(c.outstandingDues).toFixed(0)} due</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    className="px-2 py-2.5 rounded-r-lg hover:bg-muted transition-colors text-muted-foreground"
                    onClick={() => setHistoryFor(historyFor === c.id ? null : c.id)}
                    title="View purchase history"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {(customers as Customer[]).length === 0 && search && (
                <div className="text-center text-muted-foreground py-6 text-sm">
                  No customers found.{" "}
                  <button className="text-primary underline" onClick={() => setShowAdd(true)}>Add new?</button>
                </div>
              )}
            </div>

            {/* History panel */}
            {historyFor !== null && (
              <div className="border-t pt-3 space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-2">Last 5 purchases</div>
                {(history as { id: number; saleNumber: string; total: number; createdAt: string; loyaltyPointsEarned: number }[]).length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-3">No purchases yet</div>
                ) : (
                  (history as { id: number; saleNumber: string; total: number; createdAt: string; loyaltyPointsEarned: number }[]).map((s) => (
                    <div key={s.id} className="flex justify-between text-xs py-1 border-b border-dashed last:border-0">
                      <span className="text-muted-foreground">{s.saleNumber}</span>
                      <span className="font-medium">₹{s.total.toFixed(2)}</span>
                      <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────

export default function POS() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const qc = useQueryClient();

  // ── Tabs & Search ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"all" | "favorites" | "fast">("all");
  const [search, setSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState<BillDiscount>({ type: "percentage", value: 0, reason: "" });
  const [roundOff, setRoundOff] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{ code: string; discountAmount: number; description?: string | null } | null>(null);
  const [couponError, setCouponError] = useState("");

  // ── Customer ──────────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [loyaltyToRedeem, setLoyaltyToRedeem] = useState(0);

  // ── Cashier Shift ─────────────────────────────────────────────────────────
  const [showShift, setShowShift] = useState(false);
  const [shiftOpeningCash, setShiftOpeningCash] = useState("0");
  const [shiftClosingCash, setShiftClosingCash] = useState("0");
  const [shiftNotes, setShiftNotes] = useState("");

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [billLabel, setBillLabel] = useState("");
  const [lastSale, setLastSale] = useState<{ saleNumber: string; total: number; paidAmount: number; changeAmount: number; loyaltyPointsEarned: number } | null>(null);
  const [lastPayments, setLastPayments] = useState<PaymentLine[]>([]);
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);
  const [receiptTotals, setReceiptTotals] = useState({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });

  // ── Favorites ─────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<Set<number>>(getFavorites);

  // ── Clock ─────────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-focus ────────────────────────────────────────────────────────────
  useEffect(() => { searchRef.current?.focus(); }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); setShowHeldBills(true); }
      if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) setShowPayment(true); }
      if (e.key === "Escape") {
        setShowPayment(false); setShowCustomerPicker(false); setShowHeldBills(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length]);

  // ── API Data ──────────────────────────────────────────────────────────────
  const { data: allProducts = [] } = useListProducts({});
  const { data: categories = [] } = useListCategories();
  const { data: heldBills = [] } = useListHeldBills();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: activeSession } = useGetActiveSession({ query: { queryKey: ["pos-active-session"] } });
  const openSession = useOpenCashierSession();
  const closeSession = useCloseCashierSession();
  const validateCouponMutation = useValidateCoupon();
  const createSale = useCreateSale();
  const createHeldBill = useCreateHeldBill();
  const deleteHeldBill = useDeleteHeldBill();

  // ── Product Filtering ─────────────────────────────────────────────────────
  const products = useMemo(() => {
    let list = allProducts as unknown as Product[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q)
      );
    }
    if (activeCategoryId) list = list.filter((p) => p.categoryId === activeCategoryId);
    if (tab === "favorites") list = list.filter((p) => favorites.has(p.id));
    if (tab === "fast") {
      // Fast moving = in-stock, sorted by name (proxy; in future use sales velocity)
      list = [...list].filter((p) => (p.stock ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [allProducts, search, activeCategoryId, tab, favorites]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const raw = rawTotals(cart);

    // Bill-level discount
    let billDiscAmt = 0;
    if (billDiscount.value > 0) {
      billDiscAmt = billDiscount.type === "percentage"
        ? (raw.afterItemDiscounts * billDiscount.value) / 100
        : Math.min(billDiscount.value, raw.afterItemDiscounts);
    }

    // Coupon discount
    const couponDisc = couponResult?.discountAmount ?? 0;

    const totalDiscount = raw.itemDiscounts + billDiscAmt + couponDisc;
    const afterAllDiscounts = raw.subtotal - totalDiscount;
    const total = afterAllDiscounts + raw.taxAmount;
    const roundedTotal = roundOff ? Math.round(total) : total;
    const roundOffAmt = roundedTotal - total;

    return {
      subtotal: raw.subtotal,
      itemDiscounts: raw.itemDiscounts,
      billDiscAmt,
      couponDisc,
      totalDiscount: totalDiscount + roundOffAmt,
      taxAmount: raw.taxAmount,
      roundOff: roundOffAmt,
      total: roundedTotal,
    };
  }, [cart, billDiscount, couponResult, roundOff]);

  // ── Cart actions ──────────────────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    const unitPrice = product.salePrice ?? product.price ?? 0;
    const gstRate = product.gstRate ?? 0;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = calcItem({ ...updated[idx], quantity: updated[idx].quantity + 1 });
        return updated;
      }
      return [...prev, calcItem({
        productId: product.id, productName: product.name,
        sku: product.sku ?? null, barcode: product.barcode ?? null,
        quantity: 1, unitPrice, mrp: product.mrp ?? null,
        discountPct: 0, gstRate,
      })];
    });
    setSearch("");
    setActiveCategoryId(null);
    setTab("all");
    searchRef.current?.focus();
  }, []);

  const updateQty = (idx: number, delta: number) =>
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) return updated.filter((_, i) => i !== idx);
      updated[idx] = calcItem({ ...updated[idx], quantity: newQty });
      return updated;
    });

  const updateDiscount = (idx: number, pct: number) =>
    setCart((prev) => {
      const updated = [...prev];
      updated[idx] = calcItem({ ...updated[idx], discountPct: Math.min(100, Math.max(0, pct)) });
      return updated;
    });

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setBillDiscount({ type: "percentage", value: 0, reason: "" });
    setCouponCode("");
    setCouponResult(null);
    setCouponError("");
    setRoundOff(false);
    setLoyaltyToRedeem(0);
    setSearch("");
    searchRef.current?.focus();
  }, []);

  // Barcode/SKU enter key
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = search.trim();
      if (!val) return;
      const exact = (allProducts as unknown as Product[]).find(
        (p) => p.barcode === val || p.sku === val
      );
      if (exact) { addToCart(exact); return; }
      const first = products[0];
      if (first) {
        addToCart(first);
        if (val.length > 2) {
          setRecentSearches((prev) => [val, ...prev.filter((s) => s !== val)].slice(0, 5));
        }
      }
    }
  };

  // Toggle favorite
  const toggleFavorite = (productId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(productId) ? next.delete(productId) : next.add(productId);
      saveFavorites(next);
      return next;
    });
  };

  // ── Coupon ────────────────────────────────────────────────────────────────
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    try {
      const result = await validateCouponMutation.mutateAsync({
        data: { code: couponCode.trim(), orderAmount: totals.subtotal - totals.itemDiscounts - totals.billDiscAmt },
      });
      setCouponResult({ code: result.coupon.code, discountAmount: result.discountAmount, description: result.coupon.description });
      toast({ title: `Coupon "${result.coupon.code}" applied — ₹${result.discountAmount.toFixed(2)} off` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid coupon";
      setCouponError(msg);
      setCouponResult(null);
    }
  };

  const removeCoupon = () => {
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
  };

  // ── Hold / Resume ─────────────────────────────────────────────────────────
  const holdBill = async () => {
    if (cart.length === 0) return;
    await createHeldBill.mutateAsync({
      data: {
        label: billLabel || `Bill ${currentTime.toLocaleTimeString()}`,
        cartData: { cart, customer: selectedCustomer, billDiscount, couponResult, roundOff },
      },
    });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    clearCart();
    setBillLabel("");
    toast({ title: "Bill held", description: "Resume from Held Bills." });
  };

  const resumeBill = (bill: { id: number; cartData: Record<string, unknown> }) => {
    const data = bill.cartData as {
      cart: CartItem[];
      customer?: Customer | null;
      billDiscount?: BillDiscount;
      couponResult?: typeof couponResult;
      roundOff?: boolean;
    };
    setCart(data.cart ?? []);
    setSelectedCustomer(data.customer ?? null);
    if (data.billDiscount) setBillDiscount(data.billDiscount);
    if (data.couponResult) setCouponResult(data.couponResult);
    if (data.roundOff !== undefined) setRoundOff(data.roundOff);
    deleteHeldBill.mutate({ id: bill.id });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    setShowHeldBills(false);
    toast({ title: "Bill resumed" });
  };

  // ── Complete Sale ─────────────────────────────────────────────────────────
  const handlePaymentConfirm = async (payments: PaymentLine[], change: number) => {
    const loyaltyDiscount = loyaltyToRedeem * LOYALTY_REDEEM_VALUE;
    const effectiveTotal = Math.max(0, totals.total - loyaltyDiscount);
    const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
    const loyaltyPointsEarned = Math.floor(effectiveTotal / 100);

    try {
      const sale = await createSale.mutateAsync({
        data: {
          customerId: selectedCustomer?.id ?? null,
          customerName: selectedCustomer?.name ?? null,
          items: cart,
          payments,
          subtotal: totals.subtotal,
          discountAmount: totals.totalDiscount,
          taxAmount: totals.taxAmount,
          total: effectiveTotal,
          paidAmount,
          changeAmount: change,
          loyaltyPointsRedeemed: loyaltyToRedeem,
          notes: [
            billDiscount.reason ? `Discount reason: ${billDiscount.reason}` : "",
            couponResult ? `Coupon: ${couponResult.code}` : "",
          ].filter(Boolean).join(" | ") || null,
        },
      });

      const snapshotCart = [...cart];
      const snapshotPayments = [...payments];
      const snapshotTotals = { ...totals, discountAmount: totals.totalDiscount };

      setLastSale({
        saleNumber: sale.saleNumber,
        total: effectiveTotal,
        paidAmount,
        changeAmount: change,
        loyaltyPointsEarned,
      });
      setLastPayments(snapshotPayments);
      setReceiptItems(snapshotCart);
      setReceiptTotals(snapshotTotals);
      setShowPayment(false);
      clearCart();
      setShowReceipt(true);

      toast({ title: "Sale completed!", description: `${sale.saleNumber} — ₹${effectiveTotal.toFixed(2)}` });
    } catch {
      toast({ title: "Sale failed", variant: "destructive" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">

      {/* ═══ TOP BAR ═══════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-3 h-11 border-b bg-card shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-8 px-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Dashboard</span>
            </Button>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
          <span className="font-bold text-sm">POS Billing</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            <span className="opacity-50 hidden md:inline">· {currentTime.toLocaleDateString()}</span>
          </div>
          {me && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs">
                {me.name?.charAt(0) ?? "U"}
              </div>
              <span>{me.name}</span>
            </div>
          )}

          {/* Cashier shift indicator */}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 gap-1 text-xs hidden sm:flex ${activeSession ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100" : "text-muted-foreground"}`}
            onClick={() => setShowShift(true)}
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{activeSession ? "Shift Open" : "Open Shift"}</span>
          </Button>

          {/* Invoice History */}
          <Link href="/pos/invoices">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs hidden sm:flex text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              <span className="hidden md:inline">History</span>
            </Button>
          </Link>

          <Button variant="outline" size="sm" className="relative h-8 gap-1 text-xs" onClick={() => setShowHeldBills(true)}>
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Held</span>
            {heldBills.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {heldBills.length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hidden sm:flex" onClick={logout}>
            <LogOut className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden md:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r overflow-hidden">

          {/* Search */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="Search / scan barcode / SKU…"
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
              />
              {search && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Recent searches */}
            {recentSearches.length > 0 && !search && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSearch(s)}
                    className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full hover:bg-muted/80 transition-colors flex items-center gap-0.5"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabs + Category pills */}
          <div className="shrink-0 border-b bg-background">
            {/* Tab bar */}
            <div className="flex gap-0 px-3 pt-1.5">
              {([
                { key: "all", label: "All", icon: null },
                { key: "favorites", label: "Favorites", icon: <Star className="h-3 w-3" /> },
                { key: "fast", label: "Fast Moving", icon: <Zap className="h-3 w-3" /> },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 border-b-2 transition-colors ${
                    tab === t.key
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}{t.label}
                  {t.key === "favorites" && favorites.size > 0 && (
                    <span className="bg-amber-100 text-amber-700 rounded-full px-1 text-[9px] font-bold">{favorites.size}</span>
                  )}
                </button>
              ))}
            </div>
            {/* Category pills */}
            <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveCategoryId(null)}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategoryId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All
              </button>
              {(categories as { id: number; name: string; color?: string | null }[]).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId((c) => (c === cat.id ? null : cat.id))}
                  className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    activeCategoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid — scrollable */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {tab === "favorites" && favorites.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Star className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No favorites yet</p>
                <p className="text-xs mt-1 opacity-70">Star a product to add it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {products.map((product) => {
                  const price = product.salePrice ?? product.price ?? 0;
                  const lowStock = (product.stock ?? 0) > 0 && (product.stock ?? 0) < 5;
                  const outOfStock = (product.stock ?? 0) <= 0;
                  const isFav = favorites.has(product.id);

                  return (
                    <button
                      key={product.id}
                      disabled={outOfStock}
                      onClick={() => addToCart(product)}
                      className={`relative text-left rounded-lg border p-2.5 transition-all select-none focus:outline-none focus:ring-2 focus:ring-primary group ${
                        outOfStock
                          ? "opacity-40 cursor-not-allowed bg-muted"
                          : "bg-card hover:border-primary hover:shadow-md active:scale-[0.97] cursor-pointer"
                      }`}
                    >
                      {/* Favorite star */}
                      <button
                        className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-0.5 rounded ${
                          isFav ? "opacity-100 text-amber-400" : "text-muted-foreground hover:text-amber-400"
                        }`}
                        onClick={(e) => toggleFavorite(product.id, e)}
                        tabIndex={-1}
                      >
                        <Star className={`h-3 w-3 ${isFav ? "fill-amber-400" : ""}`} />
                      </button>

                      <div className="font-medium text-xs leading-tight line-clamp-2 pr-4">{product.name}</div>
                      {product.sku && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{product.sku}</div>
                      )}
                      <div className="mt-1.5 flex items-end justify-between gap-1">
                        <span className="font-bold text-primary text-sm leading-none">₹{price.toFixed(2)}</span>
                        <span className={`text-[10px] font-medium leading-none ${
                          outOfStock ? "text-red-600" : lowStock ? "text-orange-500" : "text-muted-foreground"
                        }`}>
                          {outOfStock ? "Out" : `${product.stock ?? 0}`}
                        </span>
                      </div>
                      {product.gstRate ? (
                        <div className="text-[10px] text-blue-500 mt-0.5">GST {product.gstRate}%</div>
                      ) : null}
                    </button>
                  );
                })}
                {products.length === 0 && (
                  <div className="col-span-4 text-center text-muted-foreground py-16 text-sm">
                    {search ? `No results for "${search}"` : "No products"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Cart ─────────────────────────────────────────── */}
        <div className="flex flex-col w-[320px] lg:w-[360px] xl:w-96 shrink-0 overflow-hidden">

          {/* Customer */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 border-b bg-background">
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{selectedCustomer.name}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                      {(selectedCustomer.loyaltyPoints ?? 0) > 0 && (
                        <span className="text-amber-600 flex items-center gap-0.5">
                          <Gift className="h-2.5 w-2.5" />{selectedCustomer.loyaltyPoints} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setSelectedCustomer(null); setLoyaltyToRedeem(0); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={() => setShowCustomerPicker(true)}>
                <User className="h-3.5 w-3.5" />Walk-in Customer (tap to select)
              </Button>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-15" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1 opacity-60">Click a product or scan barcode</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="rounded-lg border bg-card px-2.5 py-2">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="font-medium text-xs leading-tight flex-1 min-w-0 line-clamp-2">{item.productName}</div>
                    <button onClick={() => removeItem(idx)} className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors mt-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">
                        ₹{item.unitPrice.toFixed(2)}
                        {item.gstRate > 0 && <span className="ml-1 text-blue-400">+{item.gstRate}%</span>}
                      </div>
                      <div className="font-bold text-sm">₹{item.total.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
                    <input
                      type="number" min={0} max={100}
                      value={item.discountPct || ""}
                      placeholder="0"
                      onChange={(e) => updateDiscount(idx, parseFloat(e.target.value) || 0)}
                      className="w-12 h-5 rounded border text-[10px] px-1 text-center bg-background"
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                    {item.discountAmount > 0 && (
                      <span className="text-[10px] text-green-600 font-medium ml-1">-₹{item.discountAmount.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Discounts & Totals (fixed) ────────────────────────────── */}
          <div className="shrink-0 border-t bg-background">

            {/* Bill-level discount + coupon */}
            {cart.length > 0 && (
              <div className="px-3 pt-2 pb-1.5 space-y-1.5 border-b">
                {/* Coupon */}
                {couponResult ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1.5">
                    <Tag className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-green-700">{couponResult.code}</div>
                      <div className="text-[10px] text-green-600">-₹{couponResult.discountAmount.toFixed(2)}</div>
                    </div>
                    <button onClick={removeCoupon} className="text-green-600 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                        className="w-full h-8 rounded-md border text-xs pl-6 pr-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                      />
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={applyCoupon}
                      disabled={!couponCode.trim() || validateCouponMutation.isPending}>
                      Apply
                    </Button>
                  </div>
                )}
                {couponError && <div className="text-[10px] text-red-500">{couponError}</div>}

                {/* Bill discount */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground shrink-0">Bill disc</span>
                  <div className="flex rounded-md border overflow-hidden shrink-0">
                    <button
                      onClick={() => setBillDiscount((d) => ({ ...d, type: "percentage" }))}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${billDiscount.type === "percentage" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <Percent className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => setBillDiscount((d) => ({ ...d, type: "fixed" }))}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${billDiscount.type === "fixed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      <DollarSign className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <input
                    type="number" min={0}
                    value={billDiscount.value || ""}
                    placeholder="0"
                    onChange={(e) => setBillDiscount((d) => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
                    className="w-16 h-6 rounded border text-[10px] px-1.5 text-center bg-background"
                  />
                  {billDiscount.value > 0 && (
                    <span className="text-[10px] text-green-600 font-medium shrink-0">-₹{totals.billDiscAmt.toFixed(2)}</span>
                  )}
                  {/* Round off */}
                  <label className="flex items-center gap-1 ml-auto cursor-pointer shrink-0">
                    <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} className="w-3 h-3" />
                    <span className="text-[10px] text-muted-foreground">Round</span>
                  </label>
                </div>
                {billDiscount.value > 0 && (
                  <input
                    placeholder="Discount reason (optional)"
                    value={billDiscount.reason}
                    onChange={(e) => setBillDiscount((d) => ({ ...d, reason: e.target.value }))}
                    className="w-full h-6 rounded border text-[10px] px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            )}

            {/* Totals */}
            <div className="px-3 pt-2 pb-1.5 space-y-0.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.totalDiscount > 0.001 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Total Discount</span><span>-₹{totals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {totals.taxAmount > 0.001 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST</span><span>₹{totals.taxAmount.toFixed(2)}</span>
                </div>
              )}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Round Off</span><span>{totals.roundOff > 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline font-bold text-lg border-t pt-1 mt-1">
                <span>Total</span>
                <span className="text-primary">₹{totals.total.toFixed(2)}</span>
              </div>
              {cart.length > 0 && (
                <div className="text-[10px] text-muted-foreground text-right">
                  {cart.reduce((s, i) => s + i.quantity, 0)} items
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-3 pb-2.5 grid grid-cols-3 gap-1.5">
              <Button variant="outline" size="sm" className="text-xs h-9" onClick={clearCart} disabled={cart.length === 0}>
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => setShowHeldBills(true)} disabled={cart.length === 0}>
                <Pause className="h-3.5 w-3.5 mr-1" />Hold
              </Button>
              <Button size="sm" className="h-9 font-bold text-sm" disabled={cart.length === 0} onClick={() => setShowPayment(true)}>
                <Receipt className="h-3.5 w-3.5 mr-1" />Pay
              </Button>
            </div>
            <div className="px-3 pb-2 text-[10px] text-center text-muted-foreground/60">
              F2 = Hold · F3 = Pay · Enter = Add
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════════ */}

      {/* Customer Picker */}
      {showCustomerPicker && (
        <CustomerPicker
          onSelect={(c) => { setSelectedCustomer(c); setLoyaltyToRedeem(0); setShowCustomerPicker(false); }}
          onClose={() => setShowCustomerPicker(false)}
        />
      )}

      {/* Held Bills */}
      {showHeldBills && (
        <Dialog open onOpenChange={() => setShowHeldBills(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pause className="h-4 w-4" /> Held Bills
              </DialogTitle>
            </DialogHeader>
            {cart.length > 0 && (
              <div className="flex gap-2 mb-1">
                <Input placeholder="Label (optional)" value={billLabel} onChange={(e) => setBillLabel(e.target.value)} className="flex-1 h-8 text-sm" />
                <Button size="sm" className="h-8" onClick={holdBill} disabled={createHeldBill.isPending}>Hold Current</Button>
              </div>
            )}
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {heldBills.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">No held bills</div>
              ) : (
                (heldBills as { id: number; label: string | null; cartData: Record<string, unknown>; createdAt: string }[]).map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between rounded-lg border p-2.5 gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{bill.label ?? "Unnamed bill"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(bill.createdAt).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" className="h-7 text-xs" onClick={() => resumeBill(bill)}>
                        <Play className="h-3 w-3 mr-1" />Resume
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                        onClick={() => { deleteHeldBill.mutate({ id: bill.id }); qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment */}
      {showPayment && (
        <PaymentModal
          total={totals.total}
          customer={selectedCustomer}
          loyaltyToRedeem={loyaltyToRedeem}
          onLoyaltyChange={setLoyaltyToRedeem}
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPayment(false)}
          loading={createSale.isPending}
        />
      )}

      {/* Receipt */}
      {showReceipt && lastSale && (
        <ThermalReceipt
          sale={lastSale}
          items={receiptItems}
          payments={lastPayments}
          customer={selectedCustomer}
          totals={receiptTotals}
          onClose={() => { setShowReceipt(false); }}
        />
      )}

      {/* ─── Cashier Shift Modal ──────────────────────────────────────────── */}
      {showShift && (
        <Dialog open onOpenChange={() => setShowShift(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Cashier Shift
              </DialogTitle>
            </DialogHeader>

            {activeSession ? (
              <div className="space-y-4">
                {/* Active session info */}
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-green-700 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />Shift is Open
                  </div>
                  <div className="text-xs text-green-600">
                    Opened: {new Date((activeSession as { openedAt: string }).openedAt).toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs text-green-600">
                    Opening Cash: ₹{parseFloat(String((activeSession as { openingCash: number | string }).openingCash)).toFixed(2)}
                  </div>
                </div>

                {/* Close session */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Close Shift</h3>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Closing Cash (physical count)</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        value={shiftClosingCash}
                        onChange={(e) => setShiftClosingCash(e.target.value)}
                        className="pl-7 h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Notes (optional)</label>
                    <Input
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      placeholder="Any end-of-shift notes"
                      className="h-9"
                    />
                  </div>
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={closeSession.isPending}
                    onClick={async () => {
                      try {
                        await closeSession.mutateAsync({
                          id: (activeSession as { id: number }).id,
                          data: { closingCash: parseFloat(shiftClosingCash) || 0, notes: shiftNotes || undefined },
                        });
                        qc.invalidateQueries({ queryKey: ["pos-active-session"] });
                        toast({ title: "Shift closed successfully" });
                        setShowShift(false);
                        setShiftClosingCash("0");
                        setShiftNotes("");
                      } catch {
                        toast({ title: "Failed to close shift", variant: "destructive" });
                      }
                    }}
                  >
                    Close Shift
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Open a shift to start tracking your cashier session, sales, and cash flow.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Opening Cash in Drawer</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      value={shiftOpeningCash}
                      onChange={(e) => setShiftOpeningCash(e.target.value)}
                      className="pl-7 h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Notes (optional)</label>
                  <Input
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="e.g. Morning shift"
                    className="h-9"
                  />
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={openSession.isPending}
                  onClick={async () => {
                    try {
                      await openSession.mutateAsync({
                        data: { openingCash: parseFloat(shiftOpeningCash) || 0, notes: shiftNotes || undefined },
                      });
                      qc.invalidateQueries({ queryKey: ["pos-active-session"] });
                      toast({ title: "Shift opened", description: `Opening cash: ₹${parseFloat(shiftOpeningCash).toFixed(2)}` });
                      setShowShift(false);
                      setShiftNotes("");
                    } catch {
                      toast({ title: "Failed to open shift", variant: "destructive" });
                    }
                  }}
                >
                  <Timer className="h-4 w-4 mr-2" />Open Shift
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
