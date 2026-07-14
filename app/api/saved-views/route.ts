import { requireUserEmail } from "@/lib/po/cart-auth";
import {
  normalizeViewName,
  parseReorderActionViewFilters,
  REORDER_ACTION_VIEW_PAGE,
} from "@/lib/reorder/view-filters";
import { createSavedView, listSavedViews } from "@/lib/saved-views/store";
import { NextResponse } from "next/server";

function coercePage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return REORDER_ACTION_VIEW_PAGE;
  }
  return value.trim();
}

export async function GET(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const page = coercePage(searchParams.get("page"));
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

    const page = coercePage(body.page);
    const filters = parseReorderActionViewFilters(body.filters);
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
