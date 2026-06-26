import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/r/$slug")({
  component: () => (
    <>
      <Outlet />
      <BottomNav />
    </>
  ),
});
