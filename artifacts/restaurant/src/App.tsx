import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";

function RoleHome() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return <Redirect to="/login" />;
  if (user.role === "ADMIN") return <Redirect to="/dashboard" />;
  if (user.role === "CASHIER") return <Redirect to="/pos" />;
  return <Redirect to="/tables" />;
}

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tables from "@/pages/tables";
import TableOrder from "@/pages/table-order";
import POS from "@/pages/pos";
import Kitchen from "@/pages/kitchen";
import Inventory from "@/pages/inventory";
import Recipes from "@/pages/recipes";
import Expenses from "@/pages/expenses";
import Reports from "@/pages/reports";
import DailyClose from "@/pages/daily-close";
import Users from "@/pages/users";
import FixedCosts from "@/pages/fixed-costs";
import InventoryPurchases from "@/pages/inventory-purchases";
import OrdersHistory from "@/pages/orders-history";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <RequireAuth roles={["ADMIN"]}><AppLayout><Dashboard /></AppLayout></RequireAuth>
      </Route>
      <Route path="/tables">
        <RequireAuth roles={["ADMIN", "WAITER", "CASHIER"]}><AppLayout><Tables /></AppLayout></RequireAuth>
      </Route>
      <Route path="/tables/:id/order">
        <RequireAuth roles={["ADMIN", "WAITER", "CASHIER"]}><AppLayout><TableOrder /></AppLayout></RequireAuth>
      </Route>
      <Route path="/pos">
        <RequireAuth roles={["ADMIN", "CASHIER"]}><AppLayout><POS /></AppLayout></RequireAuth>
      </Route>
      <Route path="/kitchen">
        <RequireAuth roles={["ADMIN", "WAITER"]}><AppLayout><Kitchen /></AppLayout></RequireAuth>
      </Route>
      <Route path="/inventory">
        <RequireAuth roles={["ADMIN"]}><AppLayout><Inventory /></AppLayout></RequireAuth>
      </Route>
      <Route path="/inventory-purchases">
        <RequireAuth roles={["ADMIN"]}><AppLayout><InventoryPurchases /></AppLayout></RequireAuth>
      </Route>
      <Route path="/recipes">
        <RequireAuth roles={["ADMIN"]}><AppLayout><Recipes /></AppLayout></RequireAuth>
      </Route>
      <Route path="/expenses">
        <RequireAuth roles={["ADMIN", "CASHIER"]}><AppLayout><Expenses /></AppLayout></RequireAuth>
      </Route>
      <Route path="/fixed-costs">
        <RequireAuth roles={["ADMIN"]}><AppLayout><FixedCosts /></AppLayout></RequireAuth>
      </Route>
      <Route path="/reports">
        <RequireAuth roles={["ADMIN"]}><AppLayout><Reports /></AppLayout></RequireAuth>
      </Route>
      <Route path="/daily-close">
        <RequireAuth roles={["ADMIN"]}><AppLayout><DailyClose /></AppLayout></RequireAuth>
      </Route>
      <Route path="/orders-history">
        <RequireAuth roles={["ADMIN"]}><AppLayout><OrdersHistory /></AppLayout></RequireAuth>
      </Route>
      <Route path="/users">
        <RequireAuth roles={["ADMIN"]}><AppLayout><Users /></AppLayout></RequireAuth>
      </Route>
      <Route path="/" component={RoleHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
