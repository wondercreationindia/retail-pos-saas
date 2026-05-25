import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useListCustomers,
  useCreateSale,
  useListHeldBills,
  useCreateHeldBill,
  useDeleteHeldBill,
  getListHeldBillsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice?: number | null;
  mrp?: number | null;
  gstRate?: number | null;
  stockQuantity?: number | null;
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

type PaymentLine = { method: "cash" | "card" | "upi" | "credit"; amount: number; reference?: string };

function calcItem(item: Omit<CartItem, "discountAmount" | "gstAmount" | "subtotal" | "total">): CartItem {
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

function ThermalReceipt({
  sale,
  items,
  payments,
  customer,
  onClose,
}: {
  sale: { saleNumber: string; total: number; paidAmount: number; changeAmount: number; createdAt?: string };
  items: CartItem[];
  payments: PaymentLine[];
  customer?: Customer | null;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; width: 300px; }
        .center { text-align: center; }
        .right { text-align: right; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .bold { font-weight: bold; }
        .total-row td { font-weight: bold; border-top: 1px solid #000; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const { subtotal, discountAmount, taxAmount, total } = cartTotals(items);
  const now = new Date();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Receipt Preview</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="font-mono text-xs border p-4 bg-white rounded">
          <div className="text-center font-bold text-sm mb-1">RETAIL POS</div>
          <div className="text-center text-xs mb-2">{now.toLocaleString()}</div>
          <hr className="border-dashed border-gray-400 my-1" />
          <div className="text-xs">Receipt#: {sale.saleNumber}</div>
          {customer && <div className="text-xs">Customer: {customer.name}</div>}
          <hr className="border-dashed border-gray-400 my-1" />
          <table className="w-full text-xs">
            <thead>
              <tr><td className="font-bold">Item</td><td className="text-right font-bold">Qty</td><td className="text-right font-bold">Price</td><td className="text-right font-bold">Amt</td></tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{item.productName}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">₹{item.unitPrice.toFixed(2)}</td>
                  <td className="text-right">₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed border-gray-400 my-1" />
          <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
          {discountAmount > 0 && <div className="flex justify-between"><span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
          {taxAmount > 0 && <div className="flex justify-between"><span>GST</span><span>₹{taxAmount.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold border-t border-dashed border-gray-400 pt-1 mt-1">
            <span>TOTAL</span><span>₹{total.toFixed(2)}</span>
          </div>
          <hr className="border-dashed border-gray-400 my-1" />
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between text-xs capitalize">
              <span>{p.method}</span><span>₹{p.amount.toFixed(2)}</span>
            </div>
          ))}
          {sale.changeAmount > 0 && (
            <div className="flex justify-between text-xs"><span>Change</span><span>₹{sale.changeAmount.toFixed(2)}</span></div>
          )}
          <hr className="border-dashed border-gray-400 my-1" />
          <div className="text-center text-xs mt-2">Thank you for shopping!</div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button className="flex-1" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: "cash", amount: total, reference: "" }]);
  const [cashGiven, setCashGiven] = useState(total.toFixed(2));

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const change = Math.max(0, totalPaid - total);
  const remaining = Math.max(0, total - totalPaid);

  const addPayment = (method: PaymentLine["method"]) => {
    setPayments((prev) => [...prev, { method, amount: remaining, reference: "" }]);
  };

  const updatePayment = (idx: number, field: keyof PaymentLine, value: string | number) => {
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: field === "amount" ? parseFloat(String(value)) || 0 : value } : p)));
  };

  const removePayment = (idx: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  };

  const methodIcons: Record<string, React.ReactNode> = {
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
          {payments.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex items-center gap-1 capitalize w-28 text-sm font-medium">
                {methodIcons[p.method]} {p.method}
              </div>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={p.amount}
                onChange={(e) => updatePayment(idx, "amount", e.target.value)}
                className="w-32"
              />
              {(p.method === "card" || p.method === "upi") && (
                <Input
                  placeholder="Ref / UTR"
                  value={p.reference ?? ""}
                  onChange={(e) => updatePayment(idx, "reference", e.target.value)}
                  className="flex-1"
                />
              )}
              {payments.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removePayment(idx)}><X className="h-4 w-4" /></Button>
              )}
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {(["card", "upi", "credit"] as PaymentLine["method"][]).map((m) => (
              <Button key={m} variant="outline" size="sm" onClick={() => addPayment(m)} className="capitalize">
                {methodIcons[m]} <span className="ml-1">{m}</span>
              </Button>
            ))}
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total Due</span><span className="font-bold">₹{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total Paid</span><span>₹{totalPaid.toFixed(2)}</span></div>
            {remaining > 0.001 && <div className="flex justify-between text-red-600"><span>Remaining</span><span>₹{remaining.toFixed(2)}</span></div>}
            {change > 0.001 && <div className="flex justify-between text-green-600"><span>Change</span><span>₹{change.toFixed(2)}</span></div>}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={remaining > 0.001 || loading}
              onClick={() => onConfirm(payments, change)}
            >
              {loading ? "Processing..." : "Confirm Payment"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[100, 200, 500, 1000].map((amt) => (
              <Button key={amt} variant="secondary" size="sm" onClick={() => setPayments([{ method: "cash", amount: amt, reference: "" }])}>
                ₹{amt}
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setPayments([{ method: "cash", amount: total, reference: "" }])}>
              Exact
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function POS() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{ saleNumber: string; total: number; paidAmount: number; changeAmount: number } | null>(null);
  const [lastPayments, setLastPayments] = useState<PaymentLine[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [billLabel, setBillLabel] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useListProducts({ search: search || undefined });
  const { data: customers = [] } = useListCustomers({ search: customerSearch || undefined, limit: 20 });
  const { data: heldBills = [] } = useListHeldBills();
  const createSale = useCreateSale();
  const createHeldBill = useCreateHeldBill();
  const deleteHeldBill = useDeleteHeldBill();

  const totals = cartTotals(cart);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addToCart = useCallback((product: Product) => {
    const unitPrice = product.salePrice ?? 0;
    const gstRate = product.gstRate ?? 0;
    setCart((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = calcItem({ ...updated[existing], quantity: updated[existing].quantity + 1 });
        return updated;
      }
      return [...prev, calcItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        unitPrice,
        mrp: product.mrp ? parseFloat(String(product.mrp)) : null,
        discountPct: 0,
        gstRate,
      })];
    });
    setSearch("");
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
      updated[idx] = calcItem({ ...updated[idx], discountPct: Math.min(100, Math.max(0, pct)) });
      return updated;
    });
  };

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setSearch("");
    searchRef.current?.focus();
  };

  const handleBarcodeSearch = (val: string) => {
    setSearch(val);
    const found = (products as unknown as Product[]).find((p) => p.barcode === val || p.sku === val);
    if (found) {
      addToCart(found);
    }
  };

  const holdBill = async () => {
    if (cart.length === 0) return;
    await createHeldBill.mutateAsync({
      data: { label: billLabel || `Bill ${new Date().toLocaleTimeString()}`, cartData: { cart, customer: selectedCustomer } },
    });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    clearCart();
    setBillLabel("");
    toast({ title: "Bill held", description: "You can resume it anytime." });
  };

  const resumeBill = (bill: { id: number; cartData: Record<string, unknown> }) => {
    const data = bill.cartData as { cart: CartItem[]; customer?: Customer | null };
    setCart(data.cart ?? []);
    setSelectedCustomer(data.customer ?? null);
    deleteHeldBill.mutate({ id: bill.id });
    qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() });
    setShowHeldBills(false);
    toast({ title: "Bill resumed" });
  };

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
      setLastSale({ saleNumber: sale.saleNumber, total: totals.total, paidAmount, changeAmount: change });
      setLastPayments(payments);
      setShowPayment(false);
      setShowReceipt(true);
      clearCart();
      toast({ title: "Sale completed!", description: `${sale.saleNumber} — ₹${totals.total.toFixed(2)}` });
    } catch {
      toast({ title: "Sale failed", variant: "destructive" });
    }
  };

  const filteredProducts = search
    ? (products as unknown as Product[]).filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku?.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.includes(search)
      )
    : (products as unknown as Product[]);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 -m-8 overflow-hidden">
      {/* ── LEFT: Product Search ─────────────────────────────────── */}
      <div className="flex flex-col w-[55%] border-r bg-background overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search by name, SKU or scan barcode..."
              className="pl-9"
              value={search}
              onChange={(e) => handleBarcodeSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredProducts.length === 1) {
                  addToCart(filteredProducts[0]);
                }
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHeldBills(true)} className="relative">
            <Pause className="h-4 w-4 mr-1" /> Held
            {heldBills.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{heldBills.length}</span>
            )}
          </Button>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(filteredProducts as Product[]).map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary hover:shadow-md transition-all select-none"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-3">
                  <div className="font-medium text-sm leading-tight line-clamp-2">{product.name}</div>
                  {product.sku && <div className="text-xs text-muted-foreground mt-0.5">{product.sku}</div>}
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-primary">₹{(product.salePrice ?? 0).toFixed(2)}</span>
                    <span className={`text-xs ${(product.stockQuantity ?? 0) < 5 ? "text-red-500" : "text-muted-foreground"}`}>
                      Qty: {product.stockQuantity ?? 0}
                    </span>
                  </div>
                  {product.gstRate && parseFloat(String(product.gstRate)) > 0 && (
                    <div className="text-xs text-muted-foreground">GST: {product.gstRate}%</div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && search && (
              <div className="col-span-3 text-center text-muted-foreground py-12 text-sm">No products found for "{search}"</div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Cart ──────────────────────────────────────────── */}
      <div className="flex flex-col w-[45%] bg-muted/20 overflow-hidden">
        {/* Customer bar */}
        <div className="p-3 border-b bg-background">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-sm">{selectedCustomer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCustomer.phone} · {selectedCustomer.loyaltyPoints ?? 0} pts
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowCustomerPicker(true)}>
              <User className="h-4 w-4 mr-2" /> Select Customer (Walk-in)
            </Button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Search or scan a product</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm flex-1 leading-tight">{item.productName}</div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(idx, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span>₹{item.unitPrice.toFixed(2)}</span>
                      {item.gstRate > 0 && <span className="ml-1 text-blue-500">+{item.gstRate}% GST</span>}
                    </div>
                    <div className="font-bold text-sm">₹{item.total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Disc%:</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discountPct}
                    onChange={(e) => updateDiscount(idx, parseFloat(e.target.value) || 0)}
                    className="h-6 w-16 text-xs px-1"
                  />
                  {item.discountAmount > 0 && (
                    <span className="text-xs text-green-600">-₹{item.discountAmount.toFixed(2)}</span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Totals + actions */}
        <div className="border-t bg-background p-3 space-y-2">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-₹{totals.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GST</span><span>₹{totals.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-1">
              <span>Total</span><span>₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={clearCart} disabled={cart.length === 0}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={holdBill} disabled={cart.length === 0}>
              <Pause className="h-4 w-4 mr-1" /> Hold
            </Button>
            <Button className="flex-1" size="sm" disabled={cart.length === 0} onClick={() => setShowPayment(true)}>
              <Receipt className="h-4 w-4 mr-1" /> Pay ₹{totals.total.toFixed(2)}
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">Press Enter to add top result · F2 = Hold · F3 = Pay</p>
        </div>
      </div>

      {/* ── CUSTOMER PICKER ────────────────────────────────────── */}
      {showCustomerPicker && (
        <Dialog open onOpenChange={() => setShowCustomerPicker(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Select Customer</DialogTitle></DialogHeader>
            <Input
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="mb-3"
              autoFocus
            />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <div
                className="p-2 rounded cursor-pointer hover:bg-muted text-sm font-medium"
                onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(false); }}
              >
                Walk-in Customer
              </div>
              {(customers as Customer[]).map((c) => (
                <div
                  key={c.id}
                  className="p-2 rounded cursor-pointer hover:bg-muted"
                  onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                >
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone} · {c.loyaltyPoints ?? 0} pts</div>
                </div>
              ))}
              {customers.length === 0 && customerSearch && (
                <div className="text-center text-muted-foreground py-4 text-sm">No customers found</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── HELD BILLS ─────────────────────────────────────────── */}
      {showHeldBills && (
        <Dialog open onOpenChange={() => setShowHeldBills(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle><Play className="h-4 w-4 inline mr-2" />Held Bills</DialogTitle></DialogHeader>
            {cart.length > 0 && (
              <div className="mb-2 flex gap-2">
                <Input placeholder="Label (optional)" value={billLabel} onChange={(e) => setBillLabel(e.target.value)} />
                <Button onClick={holdBill} disabled={createHeldBill.isPending}>Hold Current</Button>
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {heldBills.length === 0 && <div className="text-center text-muted-foreground py-6 text-sm">No held bills</div>}
              {(heldBills as { id: number; label: string | null; cartData: Record<string, unknown>; createdAt: string }[]).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium text-sm">{bill.label ?? "Unnamed bill"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(bill.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => resumeBill(bill)}><Play className="h-4 w-4 mr-1" />Resume</Button>
                    <Button size="sm" variant="destructive" onClick={() => { deleteHeldBill.mutate({ id: bill.id }); qc.invalidateQueries({ queryKey: getListHeldBillsQueryKey() }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── PAYMENT MODAL ──────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          total={totals.total}
          onConfirm={handlePaymentConfirm}
          onClose={() => setShowPayment(false)}
          loading={createSale.isPending}
        />
      )}

      {/* ── RECEIPT ─────────────────────────────────────────────── */}
      {showReceipt && lastSale && (
        <ThermalReceipt
          sale={lastSale}
          items={cart.length > 0 ? cart : []}
          payments={lastPayments}
          customer={selectedCustomer}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}
