import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users, Phone, Mail, MapPin, CreditCard } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  isCredit: boolean;
  creditLimit?: number | null;
  outstandingDues: number;
  loyaltyPoints: number;
  totalPurchases: number;
  notes?: string | null;
};

const EMPTY: Omit<Customer, "id" | "outstandingDues" | "loyaltyPoints" | "totalPurchases"> = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  isCredit: false,
  creditLimit: null,
  notes: "",
};

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });

  const { data: customers = [], isLoading } = useListCustomers({ search: search || undefined });
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      gstin: c.gstin ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      pincode: c.pincode ?? "",
      isCredit: c.isCredit,
      creditLimit: c.creditLimit ?? null,
      notes: c.notes ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        ...form,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
      };
      if (editing) {
        await updateCustomer.mutateAsync({ id: editing.id, data: payload });
        toast({ title: "Customer updated" });
      } else {
        await createCustomer.mutateAsync({ data: payload });
        toast({ title: "Customer created" });
      }
      invalidate();
      setShowForm(false);
    } catch {
      toast({ title: "Failed to save customer", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this customer?")) return;
    await deleteCustomer.mutateAsync({ id });
    invalidate();
    toast({ title: "Customer deleted" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm">{(customers as Customer[]).length} customers</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, phone, email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (customers as Customer[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No customers yet. Add your first customer.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(customers as Customer[]).map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {c.isCredit && <Badge variant="secondary"><CreditCard className="h-3 w-3 mr-1" />Credit</Badge>}
                  {c.loyaltyPoints > 0 && <Badge variant="outline">{c.loyaltyPoints} pts</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" />{c.email}</div>}
                {(c.city || c.state) && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3 w-3" />{[c.city, c.state].filter(Boolean).join(", ")}</div>}
                {c.gstin && <div className="text-xs text-muted-foreground">GSTIN: {c.gstin}</div>}
                <div className="pt-1 border-t flex justify-between text-xs">
                  <div>Total Purchases: <span className="font-medium">₹{c.totalPurchases.toFixed(2)}</span></div>
                  {c.outstandingDues > 0 && <div className="text-red-600">Due: ₹{c.outstandingDues.toFixed(2)}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Customer name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="col-span-2">
              <Label>GSTIN</Label>
              <Input value={form.gstin ?? ""} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Street address" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input value={form.pincode ?? ""} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <Label>Credit Customer</Label>
              <Switch checked={form.isCredit} onCheckedChange={(v) => setForm((f) => ({ ...f, isCredit: v }))} />
            </div>
            {form.isCredit && (
              <div className="col-span-2">
                <Label>Credit Limit (₹)</Label>
                <Input type="number" value={form.creditLimit ?? ""} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="0" />
              </div>
            )}
            <div className="col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this customer" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createCustomer.isPending || updateCustomer.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
