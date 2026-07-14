import { requireUserEmail } from "@/lib/po/cart-auth";
import {
  normalizeViewName,
  parseReorderActionViewFilters,
} from "@/lib/reorder/view-filters";
import { deleteSavedView, updateSavedView } from "@/lib/saved-views/store";
import { NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const id = context.params.id;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const patch: {
      name?: string;
      filters?: ReturnType<typeof parseReorderActionViewFilters>;
      isDefault?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = normalizeViewName(
        typeof body.name === "string" ? body.name : ""
      );
      if (!name) {
        return NextResponse.json(
          { error: "name is required (max 80 characters)" },
          { status: 400 }
        );
      }
      patch.name = name;
    }

    if (body.filters !== undefined) {
      patch.filters = parseReorderActionViewFilters(body.filters);
    }

    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== "boolean") {
        return NextResponse.json(
          { error: "isDefault must be a boolean" },
          { status: 400 }
        );
      }
      patch.isDefault = body.isDefault;
    }

    if (
      patch.name === undefined &&
      patch.filters === undefined &&
      patch.isDefault === undefined
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const view = await updateSavedView({
      email: auth.email,
      id: id.trim(),
      ...patch,
    });

    return NextResponse.json({ view });
  } catch (error) {
    console.error("PATCH /api/saved-views/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update view";
    if (message === "Saved view not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    const status =
      message.includes("already exists") || message.includes("already taken")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const id = context.params.id;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteSavedView(auth.email, id.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/saved-views/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to delete view" },
      { status: 500 }
    );
  }
}
