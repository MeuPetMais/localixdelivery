import type { NavigationItem, WorkspaceDefinition } from "./types";

export const WORKSPACES: WorkspaceDefinition[] = [
  { id: "operation", label: "Operação" },
  { id: "financial", label: "Financeiro", requiredRoles: ["OWNER", "MANAGER", "CASHIER"] },
  { id: "products", label: "Produtos", requiredRoles: ["OWNER", "MANAGER"] },
  { id: "customers", label: "Clientes", requiredRoles: ["OWNER", "MANAGER", "STAFF"] },
  { id: "marketing", label: "Marketing", requiredRoles: ["OWNER", "MANAGER"] },
  { id: "analytics", label: "Analytics", requiredRoles: ["OWNER", "MANAGER"] },
  { id: "settings", label: "Configurações", requiredRoles: ["OWNER"] },
];

/**
 * Navegação agrupada por domínio de negócio (usada pelo menu lateral).
 * Cada seção é um NavigationItem sem `to`, com filhos navegáveis.
 * RBAC preservado via `requiredRoles`.
 */
export const NAVIGATION: NavigationItem[] = [
  {
    id: "panel",
    label: "Painel",
    workspace: "operation",
    children: [
      { id: "dashboard", label: "Dashboard", to: "/dashboard", workspace: "operation" },
    ],
  },
  {
    id: "operation",
    label: "Operação",
    workspace: "operation",
    children: [
      { id: "orders", label: "Pedidos", to: "/orders", workspace: "operation" },
      { id: "kitchen", label: "Painel da Cozinha", to: "/kitchen", workspace: "operation", requiredRoles: ["OWNER", "MANAGER", "KITCHEN"] },
      { id: "delivery", label: "Delivery", to: "/entregas", workspace: "operation", requiredRoles: ["OWNER", "MANAGER", "DELIVERY", "STAFF"] },
      { id: "central", label: "Central Operacional", to: "/central", workspace: "operation", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "drivers", label: "Motoboys", to: "/motoboys", workspace: "operation", requiredRoles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    id: "catalog",
    label: "Cardápio",
    workspace: "products",
    requiredRoles: ["OWNER", "MANAGER"],
    children: [
      { id: "menu", label: "Cardápio", to: "/menu", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "categories", label: "Categorias", to: "/menu", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "promotions", label: "Promoções", to: "/promotions", workspace: "marketing", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "featured", label: "Produtos em Destaque", to: "/featured", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "builders", label: "Construtores de Produtos", to: "/builders", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    id: "inventory",
    label: "Estoque",
    workspace: "products",
    requiredRoles: ["OWNER", "MANAGER"],
    children: [
      { id: "inventory", label: "Estoque", to: "/inventory", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "suppliers", label: "Fornecedores", to: "/suppliers", workspace: "products", requiredRoles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    id: "customers",
    label: "Clientes",
    workspace: "customers",
    children: [
      { id: "customers", label: "Clientes", to: "/customers", workspace: "customers" },
      { id: "loyalty", label: "Fidelidade", to: "/loyalty", workspace: "marketing", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "reviews", label: "Avaliações", to: "/reviews", workspace: "customers", requiredRoles: ["OWNER", "MANAGER", "STAFF"] },
    ],
  },
  {
    id: "financial",
    label: "Financeiro",
    workspace: "financial",
    requiredRoles: ["OWNER", "MANAGER", "CASHIER"],
    children: [
      { id: "payments", label: "Pagamentos", to: "/pagamentos", workspace: "financial", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "financial-center", label: "Central Financeira", to: "/financial-center", workspace: "financial", requiredRoles: ["OWNER", "MANAGER", "CASHIER"] },
      { id: "finance", label: "Finance", to: "/finance", workspace: "financial", requiredRoles: ["OWNER", "MANAGER", "CASHIER"] },
      { id: "finance-ai", label: "Finance AI", to: "/finance-ai", workspace: "financial", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "financeiro-motoboys", label: "Fechamento Entregadores", to: "/financeiro-motoboys", workspace: "financial", requiredRoles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    id: "intelligence",
    label: "Inteligência",
    workspace: "analytics",
    requiredRoles: ["OWNER", "MANAGER"],
    children: [
      { id: "analytics", label: "Analytics", to: "/finance", workspace: "analytics", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "consultor", label: "Consultor IA", to: "/consultor", workspace: "analytics", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "ai", label: "Assistente IA", to: "/ai", workspace: "analytics", requiredRoles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    id: "settings",
    label: "Configurações",
    workspace: "settings",
    children: [
      { id: "settings", label: "Configurações", to: "/settings", workspace: "settings", requiredRoles: ["OWNER"] },
      { id: "print-settings", label: "Impressão", to: "/print-settings", workspace: "settings", requiredRoles: ["OWNER", "MANAGER"] },
      { id: "units", label: "Unidades", to: "/units", workspace: "settings", requiredRoles: ["OWNER"] },
      { id: "perfil", label: "Perfil", to: "/perfil", workspace: "settings" },
      { id: "support", label: "Ajuda", to: "/support", workspace: "operation" },
    ],
  },
];
