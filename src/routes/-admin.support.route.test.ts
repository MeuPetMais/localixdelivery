import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldRenderAdminSupportQueue } from "./admin.support";

const supportRoute = "src/routes/admin.support.tsx";
const ticketRoute = "src/routes/admin.support.$ticketId.tsx";
const teamRoute = "src/routes/admin.support.team.tsx";
const reportsRoute = "src/routes/admin.support.reports.tsx";

describe("admin support child route rendering", () => {
  const supportSource = readFileSync(supportRoute, "utf8");
  const ticketSource = readFileSync(ticketRoute, "utf8");
  const teamSource = readFileSync(teamRoute, "utf8");
  const reportsSource = readFileSync(reportsRoute, "utf8");

  it("renders the support queue only on /admin/support", () => {
    expect(shouldRenderAdminSupportQueue("/admin/support")).toBe(true);
    expect(supportSource).toContain("Central de suporte");
  });

  it("renders the ticket detail route through the parent Outlet", () => {
    expect(shouldRenderAdminSupportQueue("/admin/support/ticket-123")).toBe(false);
    expect(supportSource).toContain("return <Outlet />");
    expect(ticketSource).toContain('createFileRoute("/admin/support/$ticketId")');
    expect(ticketSource).toContain("SupportTicketDetailPage");
  });

  it("keeps the reply box available in the ticket detail", () => {
    expect(ticketSource).toContain("Responder ao estabelecimento");
    expect(ticketSource).toContain("<Textarea");
    expect(ticketSource).toContain("sendReply.mutate");
  });

  it("renders team management through the parent Outlet", () => {
    expect(shouldRenderAdminSupportQueue("/admin/support/team")).toBe(false);
    expect(teamSource).toContain('createFileRoute("/admin/support/team")');
    expect(teamSource).toContain("Equipe de atendimento");
  });

  it("renders reports through the parent Outlet", () => {
    expect(shouldRenderAdminSupportQueue("/admin/support/reports")).toBe(false);
    expect(reportsSource).toContain('createFileRoute("/admin/support/reports")');
    expect(reportsSource).toContain("Relatorios de suporte");
  });

  it("does not render the queue simultaneously with child routes", () => {
    for (const pathname of ["/admin/support/ticket-123", "/admin/support/team", "/admin/support/reports"]) {
      expect(shouldRenderAdminSupportQueue(pathname)).toBe(false);
    }
  });
});
