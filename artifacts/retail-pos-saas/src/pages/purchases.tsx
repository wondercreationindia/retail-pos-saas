import React, { useState } from "react";
import {
  useListPurchases, useCreatePurchase, useUpdatePurchase, useDeletePurchase, useGetPurchase,
  useListSuppliers, useListProducts,
  getListPurchasesQueryKey, getListSuppliersQueryKey, getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Trash2, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Purchase } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ordered: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
};

type LineItem = {
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  gstRate: string;
  gstAmount: string;
  subtotal: string;
  total: string;
  batchNumber: string;
  expiryDate: string;
};

const EMPTY_LINE: LineItem = {
  productId: "", productName: "", quantity: "1", unitPrice: "", gstRate: "0",
  gstAmount: "0", subtotal: "0", total: "0", batchNumber: "", expiryDate: "",
};

export default function Purchases() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [receiveId, setReceiveId] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [form, setForm] = useState({
    supplierId: "", invoiceNumber: "", invoiceDate: "", dueDate: "", notes: "",
  });
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_LINE }]);

  const { data: purchases, isLoading } = useListPurchases(
    { status: statusFilter === "all" ? undefined : statusFilter, limit: 50, offset: 0 },
    { query: { queryKey: getListPurchasesQueryKey({ status: statusFilter === "all" ? undefined : statusFilter }) } },
  );
  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });
  const { data: products } = useListProducts({}, { query: { queryKey: getListProductsQueryKey({}) } });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListPurchasesQueryKey({}) });

  const create = useCreatePurchase({
    mutation: {
      onSuccess: () => { invalidate(); setCreateOpen(false); resetForm(); toast({ title: "Purchase order created" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const update = useUpdatePurchase({
    mutation: {
      onSuccess: () => { invalidate(); setReceiveId(null); toast({ title: "Purchase updated" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const remove = useDeletePurchase({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Purchase deleted" }); },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Cannot delete";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const resetForm = () => {
    setForm({ supplierId: "", invoiceNumber: "", invoiceDate: "", dueDate: "", notes: "" });
    setLines([{ ...EMPTY_LINE }]);
  };

  const calcLine = (line: LineItem): LineItem => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unitPrice) || 0;
    const gstRate = parseFloat(line.gstRate) || 0;
    const subtotal = qty * price;
    const gstAmount = subtotal * gstRate / 100;
    const total = subtotal + gstAmount;
    return { ...line, subtotal: subtotal.toFixed(2), gstAmount: gstAmount.toFixed(2), total: total.toFixed(2) };
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? calcLine({ ...l, ...patch }) : l));
  };

  const selectProduct = (i: number, productId: string) => {
    const prod = products?.find((p) => String(p.id) === productId);
    if (prod) {
      updateLine(i, {
        productId, productName: prod.name,
        unitPrice: prod.price != null ? String(prod.price) : "",
        gstRate: prod.gstRate != null ? String(prod.gstRate) : "0",
      });
    }
  };

  const grandTotal = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
  const grandTax = lines.reduce((s, l) => s + (parseFloat(l.gstAmount) || 0), 0);

  const handleCreate = () => {
    const validLines = lines.filter((l) => l.productName && l.quantity && l.unitPrice);
    create.mutate({
      data: {
        supplierId: form.supplierId ? Number(form.supplierId) : undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        invoiceDate: form.invoiceDate || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
        items: validLines.map((l) => ({
          productId: l.productId ? Number(l.productId) : undefined,
          productName: l.productName,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          gstRate: parseFloat(l.gstRate) || 0,
          gstAmount: parseFloat(l.gstAmount) || 0,
          subtotal: parseFloat(l.subtotal),
          total: parseFloat(l.total),
          batchNumber: l.batchNumber || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      },
    });
  };

  const handleReceive = (p: Purchase) => { setReceiveId(p.id); setPaidAmount(String(p.total)); setPaymentMethod("cash"); };

  const handleConfirmReceive = () => {
    if (!receiveId) return;
    update.mutate({ id: receiveId, data: { status: "received", paidAmount: parseFloat(paidAmount), paymentMethod } });
  };

  const statusOpts = ["all", "draft", "ordered", "received", "partial", "cancelled"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchases</h1>
          <p className="text-muted-foreground">Purchase orders and supplier invoices</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> New Purchase Order</Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusOpts.map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="capitalize"
            onClick={() => setStatusFilter(s)}>{s}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : !purchases?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No purchase orders</p>
              <p className="text-sm">Create your first purchase order to track stock inflows</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-semibold">{p.purchaseNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{p.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.invoiceDate ?? new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-semibold">₹{p.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[p.status] ?? ""} hover:opacity-90 capitalize`}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${PAYMENT_COLORS[p.paymentStatus] ?? ""} hover:opacity-90 capitalize`}>{p.paymentStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(p.status === "draft" || p.status === "ordered") && (
                            <DropdownMenuItem onClick={() => handleReceive(p)}>Receive Stock</DropdownMenuItem>
                          )}
                          {p.status === "draft" && (
                            <DropdownMenuItem onClick={() => update.mutate({ id: p.id, data: { status: "ordered" } })}>
                              Mark as Ordered
                            </DropdownMenuItem>
                          )}
                          {p.status === "draft" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate({ id: p.id })}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Purchase Modal */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <Label>Supplier</Label>
                <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="INV-001" />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Items</Label>
                <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { ...EMPTY_LINE }])}>
                  + Add Item
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-28">Unit Price</TableHead>
                      <TableHead className="w-20">GST %</TableHead>
                      <TableHead className="w-28">Total</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-2">
                          <Select value={line.productId || "none"} onValueChange={(v) => selectProduct(i, v === "none" ? "" : v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Pick product" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Pick product…</SelectItem>
                              {products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {!line.productId && (
                            <Input className="h-8 mt-1" placeholder="Or type name" value={line.productName}
                              onChange={(e) => updateLine(i, { productName: e.target.value })} />
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Input className="h-8 w-20" type="number" min="0" value={line.quantity}
                            onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input className="h-8 w-28" type="number" min="0" step="0.01" value={line.unitPrice}
                            onChange={(e) => updateLine(i, { unitPrice: e.target.value })} placeholder="0.00" />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input className="h-8 w-20" type="number" min="0" value={line.gstRate}
                            onChange={(e) => updateLine(i, { gstRate: e.target.value })} />
                        </TableCell>
                        <TableCell className="py-2 font-medium">₹{parseFloat(line.total || "0").toFixed(2)}</TableCell>
                        <TableCell className="py-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-8 mt-3 text-sm px-2">
                <span className="text-muted-foreground">Tax: <strong>₹{grandTax.toFixed(2)}</strong></span>
                <span className="font-bold text-base">Total: ₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Stock Modal */}
      <Dialog open={!!receiveId} onOpenChange={(o) => !o && setReceiveId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive Stock & Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">This will mark the purchase as received and update product stock levels.</p>
            <div>
              <Label>Amount Paid (₹)</Label>
              <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit">Credit (Pay Later)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveId(null)}>Cancel</Button>
            <Button onClick={handleConfirmReceive} disabled={update.isPending}>
              {update.isPending ? "Processing…" : "Receive & Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
