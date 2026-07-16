import { requireUserEmail } from "@/lib/po/cart-auth";
import { normalizeViewName } from "@/lib/reorder/view-filters";
import { coerceSavedViewPage } from "@/lib/saved-views/pages";
import { createSavedView, listSavedViews } from "@/lib/saved-views/store";
import { NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const page = coerceSavedViewPage(searchParams.get("page"));
    const views = await listSavedViews(auth.email, page);

    return NextResponse.json({ views });
  } catch (error) {
    console.error("GET /api/saved-views failed:", error);
    return NextResponse.json(
      { error: "Failed to load saved views" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = normalizeViewName(
      typeof body.name === "string" ? body.name : ""
    );
    if (!name) {
      return NextResponse.json(
        { error: "name is required (max 80 characters)" },
        { status: 400 }
      );
    }

    const page = coerceSavedViewPage(body.page);
    const filters = isRecord(body.filters) ? body.filters : {};
    const isDefault = body.isDefault === true;

    const view = await createSavedView({
      email: auth.email,
      page,
      name,
      filters,
      isDefault,
    });

    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    console.error("POST /api/saved-views failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save view";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
