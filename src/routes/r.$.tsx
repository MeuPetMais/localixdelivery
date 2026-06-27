import { createFileRoute, redirect } from "@tanstack/react-router";

// Compatibilidade: /r/{slug} e /r/{slug}/* → 301 → /{slug}/*
export const Route = createFileRoute("/r/$")({
  beforeLoad: ({ params, location }) => {
    const splat = (params as { _splat?: string })._splat ?? "";
    throw redirect({
      href: `/${splat}${location.searchStr ?? ""}`,
      statusCode: 301,
    });
  },
});
