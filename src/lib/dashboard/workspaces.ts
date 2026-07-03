import type { NavigationItem, WorkspaceDefinition } from "./types";

export const WORKSPACES: WorkspaceDefinition[] = [
  { id: "operation", label: "Operação" },
  { id: "financial", label: "Financeiro", requiredRoles: ["ADMIN", "MANAGER", "CASHIER"] },
  { id: "products", label: "Produtos", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "customers", label: "Clientes", requiredRoles: ["ADMIN", "MANAGER", "ATTENDANT"] },
  { id: "marketing", label: "Marketing", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "analytics", label: "Analytics", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "settings", label: "Configurações", requiredRoles: ["ADMIN"] },
];

export const NAVIGATION: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", to: "/dashboard", workspace: "operation" },
  { id: "orders", label: "Pedidos", to: "/orders", workspace: "operation" },
  { id: "products", label: "Produtos", to: "/menu", workspace: "products", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "categories", label: "Categorias", to: "/menu", workspace: "products", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "customers", label: "Clientes", to: "/customers", workspace: "customers" },
  { id: "delivery", label: "Entregas", to: "/orders", workspace: "operation" },
  { id: "financial", label: "Financeiro", to: "/finance", workspace: "financial", requiredRoles: ["ADMIN", "MANAGER", "CASHIER"] },
  { id: "payments", label: "Pagamentos", to: "/pagamentos", workspace: "financial", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "reports", label: "Relatórios", to: "/finance", workspace: "analytics", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "notifications", label: "Notificações", to: "/dashboard", workspace: "operation" },
  { id: "marketing", label: "Marketing", to: "/promotions", workspace: "marketing", requiredRoles: ["ADMIN", "MANAGER"] },
  { id: "settings", label: "Configurações", to: "/settings", workspace: "settings", requiredRoles: ["ADMIN"] },
  { id: "help", label: "Ajuda", to: "/support", workspace: "operation" },
];
