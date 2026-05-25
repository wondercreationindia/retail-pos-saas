import React, { useState } from "react";
import {
  useListSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, MoreHorizontal, Search, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@workspace/api-client-react";

const EMPTY_FORM = {
  name: "", code: "", contactName: "", phone: "", email: "",
  address: "", city: "", state: "", pincode: "", country: "India",
  gstNumber: "", panNumber: "", paymentTerms: "30", creditLimit: "", notes: "",
};

export default function Suppliers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: suppliers, isLoading } = useListSuppliers(
    { search: search || undefined },
    { query: { queryKey: getListSuppliersQueryKey({ search: search || undefined }) } },
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: getListSuppliersQueryKey({}) });

  const create = useCreateSupplier({
    mutation: {
      onSuccess: () => { invalidate(); closeModal(); toast({ title: "Supplier created" }); },
      onError: () => toast({ title: "Error creating supplier", variant: "destructive" }),
    },
  });

  const update = useUpdateSupplier({
    mutation: {
      onSuccess: () => { invalidate(); closeModal(); toast({ title: "Supplier updated" }); },
      onError: () => toast({ title: "Error updating supplier", variant: "destructive" }),
    },
  });

  const remove = useDeleteSupplier({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Supplier deactivated" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({
      name: s.name, code: s.code ?? "", contactName: s.contactName ?? "",
      phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "",
      city: s.city ?? "", state: s.state ?? "", pincode: s.pincode ?? "",
      country: s.country ?? "India", gstNumber: s.gstNumber ?? "",
      panNumber: s.panNumber ?? "", paymentTerms: String(s.paymentTerms ?? 30),
      creditLimit: s.creditLimit != null ? String(s.creditLimit) : "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const closeModal = () => { setOpen(false); setEditId(null); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name, code: form.code || undefined, contactName: form.contactName || undefined,
      phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined,
      city: form.city || undefined, state: form.state || undefined, pincode: form.pincode || undefined,
      country: form.country || undefined, gstNumber: form.gstNumber || undefined,
      panNumber: form.panNumber || undefined, paymentTerms: form.paymentTerms ? Number(form.paymentTerms) : undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      update.mutate({ id: editId, data: payload });
    } else {
      create.mutate({ data: payload });
    }
  };

  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground">Manage your supplier directory</p>
        </div>
        <Button onClick={openCreate}><PlusCircle className="mr-2 h-4 w-4" /> Add Supplier</Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{suppliers?.length ?? 0} suppliers</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : !suppliers?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No suppliers yet</p>
              <p className="text-sm">Add your first supplier to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST No.</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{[s.city, s.state].filter(Boolean).join(", ") || s.code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{s.contactName}</div>
                      <div className="text-xs text-muted-foreground">{s.phone}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{s.gstNumber ?? "—"}</TableCell>
                    <TableCell>₹{Number(s.creditLimit ?? 0).toLocaleString()}</TableCell>
                    <TableCell>₹{Number(s.currentBalance ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate({ id: s.id })}>Deactivate</DropdownMenuItem>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <Label>Supplier Name *</Label>
                <Input {...f("name")} placeholder="ABC Traders" />
              </div>
              <div>
                <Label>Code</Label>
                <Input {...f("code")} placeholder="SUP001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input {...f("contactName")} placeholder="Rajesh Kumar" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input {...f("phone")} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...f("email")} placeholder="abc@traders.com" />
              </div>
              <div>
                <Label>Payment Terms (days)</Label>
                <Input type="number" {...f("paymentTerms")} placeholder="30" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input {...f("address")} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City</Label>
                <Input {...f("city")} placeholder="Mumbai" />
              </div>
              <div>
                <Label>State</Label>
                <Input {...f("state")} placeholder="Maharashtra" />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input {...f("pincode")} placeholder="400001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>GST Number</Label>
                <Input {...f("gstNumber")} placeholder="27AABCU9603R1ZX" className="uppercase" />
              </div>
              <div>
                <Label>PAN Number</Label>
                <Input {...f("panNumber")} placeholder="AABCU9603R" className="uppercase" />
              </div>
              <div>
                <Label>Credit Limit (₹)</Label>
                <Input type="number" {...f("creditLimit")} placeholder="100000" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea {...f("notes")} placeholder="Additional notes about this supplier" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) ? "Saving…" : editId ? "Update" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
