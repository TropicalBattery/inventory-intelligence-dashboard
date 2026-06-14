import { Suspense } from "react";
import { ReorderRecommendations } from "@/components/reorder/reorder-recommendations";
import { classifyRecommendationsByTab } from "@/lib/reorder-tab-classification";
import { getReorderRecommendations } from "@/lib/queries/reorder";
import {
  buildVelocityDiagnosticMap,
  getVelocityRowsBySku,
} from "@/lib/queries/velocity";

function ReorderPageFallback() {
  return (
    <div className="rounded-2xl border border-transparent shadow-card bg-white px-6 py-10 text-sm text-slate-600">
      Loading reorder recommendations...
    </div>
  );
}

export default async function ReorderPage() {
  const [recommendations, velocityBySku] = await Promise.all([
    getReorderRecommendations(),
    getVelocityRowsBySku(),
  ]);

  const classified = classifyRecommendationsByTab(recommendations);
  const diagnosticsBySku = buildVelocityDiagnosticMap(
    recommendations,
    velocityBySku
  );

  return (
    <Suspense fallback={<ReorderPageFallback />}>
      <ReorderRecommendations
        classified={classified}
        diagnosticsBySku={Object.fromEntries(diagnosticsBySku.entries())}
        velocityBySku={Object.fromEntries(velocityBySku.entries())}
      />
    </Suspense>
  );
}
