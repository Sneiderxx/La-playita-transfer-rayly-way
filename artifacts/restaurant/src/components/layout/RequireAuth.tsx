import { ReactNode } from "react";
import { Redirect } from "wouter";
import { Role } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

interface RequireAuthProps {
  children: ReactNode;
  roles?: Role[];
}

function homeForRole(role: Role): string {
  if (role === "ADMIN") return "/dashboard";
  if (role === "CASHIER") return "/pos";
  return "/tables";
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Redirect to={homeForRole(user.role)} />;
  }

  return <>{children}</>;
}
