import React, { useState, useEffect, useRef, useCallback } from "react";
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
  getListHeldBillsQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  Pause,
  Play,
  Receipt,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  LayoutDashboard,
  Clock,
  ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  loyaltyPoints?: number;
  outstandingDues?: number;
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

function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountAmount = items.reduce((s, i) => s + i.discountAmount, 0);
  const taxAmount = items.reduce((s, i) => s + i.gstAmount, 0);
  const total = items.reduce((s, i) => s + i.total, 0);
  return { subtotal, discountAmount, taxAmount, total };
}

// ─── Thermal Receipt ─────────────────────────────────────────────────────────

function ThermalReceipt({
  sale,
  items,
  payments,
  customer,
  onClose,
}: {
  sale: { saleNumber: string; total: number; paidAmount: number; changeAmount: number };
  items: CartItem[];
  payments: PaymentLine[];
  customer?: Customer | null;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=380,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 12px; width: 302px; }
        .center { text-align: center; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; font-size: 11px; }
        .bold { font-weight: bold; }
        @media print { @page { margin: 0; size: 80mm auto; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  const { subtotal, discountAmount, taxAmount, total } = cartTotals(items);
  const now = new Date();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Receipt Preview
          </DialogTitle>
        </DialogHeader>
        <div
          ref={printRef}
          className="font-mono text-xs border rounded p-4 bg-white max-h-80 overflow-y-auto"
        >
          <div className="center bold text-sm">RETAIL POS</div>
          <div className="center text-xs mb-1">{now.toLocaleString()}</div>
          <hr />
          <div>Receipt: <strong>{sale.saleNumber}</strong></div>
          {customer && <div>Customer: {customer.name}</div>}
          <hr />
          <table>
            <thead>
              <tr>
                <td className="bold">Item</td>
                <td align="right" className="bold">Qty</td>
                <td align="right" className="bold">Rate</td>
                <td align="right" className="bold">Amt</td>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 100 }}>{item.productName}</td>
                  <td align="right">{item.quantity}</td>
                  <td align="right">₹{item.unitPrice.toFixed(2)}</td>
                  <td align="right">₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>GST</span><span>₹{taxAmount.toFixed(2)}</span>
            </div>
          )}
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between" }} className="bold">
            <span>TOTAL</span><span>₹{total.toFixed(2)}</span>
          </div>
          <hr />
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ textTransform: "capitalize" }}>{p.method}</span>
              <span>₹{p.amount.toFixed(2)}</span>
            </div>
          ))}
          {sale.changeAmount > 0.001 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Change</span><span>₹{sale.changeAmount.toFixed(2)}</span>
            </div>
          )}
          <hr />
          <div className="center" style={{ marginTop: 8 }}>Thank you for shopping!</div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  total,
  onConfirm,
  onClose,
  loading,
}: {
  total: number;
  onConfirm: (payments: PaymentLine[], change: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [payments, setPayments] = useState<PaymentLine[]>([
    { method: "cash", amount: total, reference: "" },
  ]);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const change = Math.max(0, totalPaid - total);
  const remaining = Math.max(0, total - totalPaid);

  const addPayment = (method: PaymentLine["method"]) => {
    setPayments((prev) => [...prev, { method, amount: remaining, reference: "" }]);
  };

  const updatePayment = (
    idx: number,
    field: keyof PaymentLine,
    value: string | number
  ) => {
    setPayments((prev) =>
      prev.map((p, i) =>
        i === idx
          ? { ...p, [field]: field === "amount" ? parseFloat(String(value)) || 0 : value }
          : p
      )
    );
  };

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
          <DialogTitle>Payment — ₹{total.toFixed(2)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Quick amount buttons */}
          <div className="flex gap-2 flex-wrap">
            {[100, 200, 500, 1000, 2000].map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                onClick={() => setPayments([{ method: "cash", amount: amt, reference: "" }])}
              >
                ₹{amt}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPayments([{ method: "cash", amount: total, reference: "" }])}
            >
              Exact
            </Button>
          </div>

          {/* Payment lines */}
          {payments.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 w-24 text-sm font-medium capitalize shrink-0">
                {methodIcon[p.method]}
                <span>{p.method}</span>
              </div>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={p.amount || ""}
                onChange={(e) => updatePayment(idx, "amount", e.target.value)}
                className="w-28 shrink-0"
              />
              {(p.method === "card" || p.method === "upi") && (
                <Input
                  placeholder="Ref / UTR"
                  value={p.reference ?? ""}
                  onChange={(e) => updatePayment(idx, "reference", e.target.value)}
                  className="flex-1 min-w-0"
                />
              )}
              {payments.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removePayment(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {/* Add split payment */}
          <div className="flex gap-2">
            {(["card", "upi", "credit"] as PaymentLine["method"][]).map((m) => (
              <Button
                key={m}
                variant="outline"
                size="sm"
                onClick={() => addPayment(m)}
                className="capitalize text-xs"
              >
                {methodIcon[m]}
                <span className="ml-1">+ {m}</span>
              </Button>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Due</span>
              <span className="font-bold">₹{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid</span>
              <span>₹{totalPaid.toFixed(2)}</span>
            </div>
            {remaining > 0.001 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>Remaining</span>
                <span>₹{remaining.toFixed(2)}</span>
              </div>
            )}
            {change > 0.001 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Change to Return</span>
                <span>₹{change.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 h-11 text-base font-bold"
              disabled={remaining > 0.001 || loading}
              onClick={() => onConfirm(payments, change)}
            >
              {loading ? "Processing…" : `Confirm ₹${total.toFixed(2)}`}
            </Button>
            <Button variant="outline" className="h-11" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Component ──────────────────────────────────────────────────────

export default function POS() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    saleNumber: string;
    total: number;
    paidAmount: number;
    changeAmount: number;
  } | null>(null);
  const [lastPayments, setLastPayments] = useState<PaymentLine[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [billLabel, setBillLabel] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const searchRef = useRef<HTMLInputElement>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setShowHeldBills(true); }
      if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) setShowPayment(true); }
      if (e.key === "Escape") {
        setShowPayment(false);
        setShowCustomerPicker(false);
        setShowHeldBills(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length]);

  const { data: products = [] } = useListProducts({
    search: search || undefined,
    categoryId: activeCategoryId ?? undefined,
  });
  const { data: categories = [] } = useListCategories();
  const { data: customers = [] } = useListCustomers({
    search: customerSearch || undefined,
  });
  const { data: heldBills = [] } = useListHeldBills();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const createSale = useCreateSale();
  const createHeldBill = useCreateHeldBill();
  const deleteHeldBill = useDeleteHeldBill();

  const totals = cartTotals(cart);

  // ── Cart actions ────────────────────────────────────────────────────────────

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
      return [
        ...prev,
        calcItem({
          productId: product.id,
          productName: product.name,
          sku: product.sku ?? null,
          barcode: product.barcode ?? null,
          quantity: 1,
          unitPrice,
          mrp: product.mrp ?? null,
          discountPct: 0,
          gstRate,
        }),
      ];
    });
    setSearch("");
    setActiveCategoryId(null);
    searchRef.current?.focus();
  }, []);

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) return updated.filter((_, i) => i !== idx);
      updated[idx] = calcItem({ ...updated[idx], quantity: newQty });
      return updated;
    });
  };

  const updateDiscount = (idx: number, pct: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[idx] = calcItem({
        ...updated[idx],
        discountPct: Math.min(100, Math.max(0, pct)),
      });
      return updated;
    });
  };

  const removeItem = (idx: number) =>
    setCart((prev) => prev.filter((_, i) => i !== idx));

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSearch("");
    searchRef.current?.focus();
  };

  // Barcode / SKU auto-match on Enter
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = search.trim();
      // Try exact barcode / SKU match first
      const exact = (products as unknown as Product[]).find(
        (p) => p.barcode === val || p.sku === val
      );
      if (exact) {
        addToCart(exact);
        return;
      }
      // Fall back: add first visible result
      const first = (products as unknown as Product[])[0];
      if (first) addToCart(first);
    }
  };

  // ── Hold / Resume ───────────────────────────────────────────────────────────

  const holdBill = async () => {
    if (cart.length === 0) return;
    await createHeldBill.mutateAsync({
      data: {
        label: billLabel || `Bill ${currentTime.toLocaleTimeString()}`,
        cartData: { cart, customer: selectedCustomer },
      },
    });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    clearCart();
    setBillLabel("");
    toast({ title: "Bill held", description: "Resume it anytime from Held Bills." });
  };

  const resumeBill = (bill: {
    id: number;
    cartData: Record<string, unknown>;
  }) => {
    const data = bill.cartData as { cart: CartItem[]; customer?: Customer | null };
    setCart(data.cart ?? []);
    setSelectedCustomer(data.customer ?? null);
    deleteHeldBill.mutate({ id: bill.id });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    setShowHeldBills(false);
    toast({ title: "Bill resumed" });
  };

  // ── Complete Sale ───────────────────────────────────────────────────────────

  const handlePaymentConfirm = async (payments: PaymentLine[], change: number) => {
    const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
    try {
      const sale = await createSale.mutateAsync({
        data: {
          customerId: selectedCustomer?.id ?? null,
          customerName: selectedCustomer?.name ?? null,
          items: cart,
          payments,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          total: totals.total,
          paidAmount,
          changeAmount: change,
          loyaltyPointsRedeemed: 0,
        },
      });
      const completedCart = [...cart];
      const completedPayments = [...payments];
      setLastSale({
        saleNumber: sale.saleNumber,
        total: totals.total,
        paidAmount,
        changeAmount: change,
      });
      setLastPayments(completedPayments);
      setShowPayment(false);
      clearCart();
      // Show receipt with the completed items
      setCart(completedCart); // temporarily restore for receipt
      setShowReceipt(true);
      toast({
        title: "Sale completed!",
        description: `${sale.saleNumber} — ₹${totals.total.toFixed(2)}`,
      });
    } catch {
      toast({ title: "Sale failed", variant: "destructive" });
    }
  };

  const handleReceiptClose = () => {
    setShowReceipt(false);
    clearCart();
  };

  // ── Filtered products ───────────────────────────────────────────────────────

  const filteredProducts = (products as unknown as Product[]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">

      {/* ═══ TOP BAR ═══════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-4 h-12 border-b bg-card shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Dashboard</span>
            </Button>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
          <span className="font-bold text-sm text-foreground">POS Billing</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Live clock */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden sm:flex">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            <span className="opacity-60">{currentTime.toLocaleDateString()}</span>
          </div>

          {/* Cashier */}
          {me && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden md:flex">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                {me.name?.charAt(0) ?? "U"}
              </div>
              <span>{me.name}</span>
            </div>
          )}

          {/* Held bills badge */}
          <Button
            variant="outline"
            size="sm"
            className="relative h-8 gap-1.5 text-xs"
            onClick={() => setShowHeldBills(true)}
          >
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Held</span>
            {heldBills.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {heldBills.length}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL: Products ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r overflow-hidden">

          {/* Search bar */}
          <div className="shrink-0 px-3 pt-3 pb-2 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="Search by name, SKU or scan barcode…"
                className="pl-9 h-10 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
              />
            </div>
          </div>

          {/* Category filter pills */}
          <div className="shrink-0 flex gap-1.5 px-3 py-2 overflow-x-auto border-b bg-background">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategoryId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {(categories as { id: number; name: string }[]).map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setActiveCategoryId((c) => (c === cat.id ? null : cat.id))
                }
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid — scrollable */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredProducts.map((product) => {
                const price = product.salePrice ?? product.price ?? 0;
                const lowStock = (product.stock ?? 0) < 5;
                const outOfStock = (product.stock ?? 0) <= 0;
                return (
                  <button
                    key={product.id}
                    disabled={outOfStock}
                    onClick={() => addToCart(product)}
                    className={`text-left rounded-lg border p-3 transition-all select-none focus:outline-none focus:ring-2 focus:ring-primary ${
                      outOfStock
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : "bg-card hover:border-primary hover:shadow-md active:scale-95 cursor-pointer"
                    }`}
                  >
                    <div className="font-medium text-sm leading-tight line-clamp-2 mb-1">
                      {product.name}
                    </div>
                    {product.sku && (
                      <div className="text-[10px] text-muted-foreground">{product.sku}</div>
                    )}
                    <div className="mt-2 flex items-end justify-between gap-1">
                      <span className="font-bold text-primary text-sm">
                        ₹{price.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${
                          outOfStock
                            ? "text-red-600"
                            : lowStock
                            ? "text-orange-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {outOfStock ? "Out" : `${product.stock ?? 0} left`}
                      </span>
                    </div>
                    {product.gstRate ? (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        GST {product.gstRate}%
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-4 text-center text-muted-foreground py-16 text-sm">
                  {search
                    ? `No products match "${search}"`
                    : "No products found"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Cart ─────────────────────────────────────────── */}
        <div className="flex flex-col w-80 lg:w-96 shrink-0 overflow-hidden bg-muted/10">

          {/* Customer selector */}
          <div className="shrink-0 px-3 pt-3 pb-2 border-b bg-background">
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{selectedCustomer.name}</div>
                    {selectedCustomer.loyaltyPoints ? (
                      <div className="text-[10px] text-muted-foreground">
                        {selectedCustomer.loyaltyPoints} pts
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs gap-1.5 text-muted-foreground"
                onClick={() => setShowCustomerPicker(true)}
              >
                <User className="h-3.5 w-3.5" />
                Walk-in Customer
              </Button>
            )}
          </div>

          {/* Cart items — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1 opacity-70">Search or click a product</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border bg-card p-2.5"
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <div className="font-medium text-sm leading-tight flex-1 min-w-0">
                      {item.productName}
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        ₹{item.unitPrice.toFixed(2)}
                        {item.gstRate > 0 && (
                          <span className="ml-1 text-blue-500">+{item.gstRate}%</span>
                        )}
                      </div>
                      <div className="font-bold text-sm">₹{item.total.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Disc%</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountPct || ""}
                      placeholder="0"
                      onChange={(e) =>
                        updateDiscount(idx, parseFloat(e.target.value) || 0)
                      }
                      className="w-14 h-5 rounded border text-xs px-1.5 text-center bg-background"
                    />
                    {item.discountAmount > 0 && (
                      <span className="text-[10px] text-green-600 font-medium">
                        -₹{item.discountAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Fixed Totals + Actions ───────────────────────────────────── */}
          <div className="shrink-0 border-t bg-background">
            {/* Totals */}
            <div className="px-3 py-2.5 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Discount</span>
                  <span>-₹{totals.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST</span>
                  <span>₹{totals.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg border-t pt-1.5 mt-1">
                <span>Total</span>
                <span className="text-primary">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-3 pb-3 grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9"
                onClick={() => setShowHeldBills(true)}
                disabled={cart.length === 0}
              >
                <Pause className="h-3.5 w-3.5 mr-1" />
                Hold
              </Button>
              <Button
                size="sm"
                className="h-9 font-bold text-xs"
                disabled={cart.length === 0}
                onClick={() => setShowPayment(true)}
              >
                <Receipt className="h-3.5 w-3.5 mr-1" />
                Pay
              </Button>
            </div>

            {/* Keyboard hint */}
            <div className="px-3 pb-2 text-[10px] text-center text-muted-foreground/70">
              F2 = Hold · F3 = Pay · Enter = Add top result
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════════ */}

      {/* Customer Picker */}
      {showCustomerPicker && (
        <Dialog open onOpenChange={() => setShowCustomerPicker(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Select Customer</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Search by name or phone…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="mb-2"
              autoFocus
            />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              <button
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm font-medium transition-colors"
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowCustomerPicker(false);
                }}
              >
                Walk-in Customer
              </button>
              {(customers as Customer[]).map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setShowCustomerPicker(false);
                    setCustomerSearch("");
                  }}
                >
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone}
                    {c.loyaltyPoints ? ` · ${c.loyaltyPoints} pts` : ""}
                  </div>
                </button>
              ))}
              {(customers as Customer[]).length === 0 && customerSearch && (
                <div className="text-center text-muted-foreground py-6 text-sm">
                  No customers found
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Label (optional)"
                  value={billLabel}
                  onChange={(e) => setBillLabel(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={holdBill}
                  disabled={createHeldBill.isPending}
                >
                  Hold Current
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {heldBills.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No held bills
                </div>
              ) : (
                (
                  heldBills as {
                    id: number;
                    label: string | null;
                    cartData: Record<string, unknown>;
                    createdAt: string;
                  }[]
                ).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {bill.label ?? "Unnamed bill"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(bill.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => resumeBill(bill)}>
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          deleteHeldBill.mutate({ id: bill.id });
                          qc.invalidateQueries({
                            queryKey: getListHeldBillsQueryKey(),
                          });
                        }}
                      >
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
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPayment(false)}
          loading={createSale.isPending}
        />
      )}

      {/* Receipt */}
      {showReceipt && lastSale && (
        <ThermalReceipt
          sale={lastSale}
          items={cart}
          payments={lastPayments}
          customer={selectedCustomer}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
}
