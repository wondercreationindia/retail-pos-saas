import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar";
import { Home, Package, ShoppingCart, Tags, Users, Settings, LogOut, Warehouse, Truck, ShoppingBag, MonitorSmartphone, UserRound, BookOpen, Receipt, FileText, CreditCard, BarChart3, Landmark, LineChart } from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();

  const { data: user } = useGetMe({ query: { enabled: isAuthenticated, queryKey: getGetMeQueryKey() } });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="font-bold tracking-tight">Retail POS</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Sales</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/pos"><MonitorSmartphone /> POS Billing</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/dashboard"><Home /> Dashboard</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/orders"><ShoppingCart /> Orders</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/customers"><UserRound /> Customers</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/products"><Package /> Products</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/categories"><Tags /> Categories</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Inventory</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/inventory"><Warehouse /> Stock</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/purchases"><ShoppingBag /> Purchases</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/suppliers"><Truck /> Suppliers</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Accounting</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/accounts"><Landmark /> Chart of Accounts</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/journals"><BookOpen /> Journal Entries</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/vouchers"><CreditCard /> Vouchers</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/expenses"><Receipt /> Expenses</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/ledger"><FileText /> Ledger</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/accounting/reports"><BarChart3 /> Reports</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Reports</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/reports"><LineChart /> Reports & Analytics</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/users"><Users /> Users</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/settings"><Settings /> Settings</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-4 text-sm text-sidebar-foreground">
              <div className="w-8 h-8 rounded bg-sidebar-accent flex items-center justify-center font-bold">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{user?.name}</span>
                <span className="text-xs opacity-70">{user?.role}</span>
              </div>
            </div>
            <SidebarMenuButton onClick={logout} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </SidebarMenuButton>
          </div>
        </Sidebar>
        <main className="flex-1 overflow-auto bg-muted/20">
          <div className="h-full p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
