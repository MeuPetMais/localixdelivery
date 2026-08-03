import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runSupabaseRawFetch } from "@/lib/supabase-raw-fetch.functions";

export const Route = createFileRoute("/supabase-raw-fetch-temp")({
  component: SupabaseRawFetchTempPage,
});

function SupabaseRawFetchTempPage() {
  const runFetch = useServerFn(runSupabaseRawFetch);
  const { data, error, isLoading } = useQuery({
    queryKey: ["supabase-raw-fetch-temp"],
    queryFn: () => runFetch(),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const result = error ? { error: (error as Error).message } : data;

  return (
    <main className="p-6">
      <pre className="overflow-auto whitespace-pre-wrap text-sm">
        {isLoading ? "Loading..." : JSON.stringify(result, null, 2)}
      </pre>
    </main>
  );
}
