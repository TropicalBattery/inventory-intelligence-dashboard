import { NextResponse } from "next/server";
import { getLatestSeasonalIntelligence, runSeasonalIntelligenceAnalysis } from "@/lib/seasonality/service";
import { TENANT_ID } from "@/lib/tenant";

export async function GET() {
  try {
    const record = await getLatestSeasonalIntelligence(TENANT_ID);
    return NextResponse.json({ record });
  } catch (error) {
    console.error("Seasonality GET error:", error);
    return NextResponse.json(
      { error: "Failed to load seasonal intelligence" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await runSeasonalIntelligenceAnalysis(TENANT_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Seasonality POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to refresh seasonal analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
