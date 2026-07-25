import {
  coerceOptionalString,
  requireUserEmail,
} from "@/lib/po/cart-auth";
import {
  mapInboundContainerRow,
  type InboundContainerRow,
} from "@/lib/queries/inbound-containers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Reorder inbound chips/relief derive from this table — refresh both pages. */
function revalidateInboundConsumers(): void {
  revalidatePath("/reorder");
  revalidatePath("/inbound-containers");
}

export const runtime = "nodejs";

const EDITABLE_FIELDS = [
  "supplier",
  "supplier_invoice",
  "quote_ref",
  "container_count",
  "container_size",
  "eta_port",
  "eta_warehouse",
  "bl_number",
  "container_numbers",
  "source_month",
] as const;

function coerceNullableText(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return coerceOptionalString(value);
}

function coerceContainerCount(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "number" || typeof value === "string") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return null;
    }
    return n;
  }
  return null;
}

function readEditablePatch(
  body: Record<string, unknown>
): { updates: Record<string, unknown> } | { error: string } {
  const updates: Record<string, unknown> = {};
  let touched = false;

  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      continue;
    }
    touched = true;
    const raw = body[field];

    if (field === "container_count") {
      const count = coerceContainerCount(raw, null);
      if (count === null && raw !== null) {
        return { error: "container_count must be a non-negative number" };
      }
      updates.container_count = count;
      continue;
    }

    if (field === "supplier") {
      const supplier = coerceOptionalString(raw);
      if (!supplier) {
        return { error: "supplier cannot be empty" };
      }
      updates.supplier = supplier;
      continue;
    }

    updates[field] = coerceNullableText(raw);
  }

  if (!touched) {
    return {
      error: `Provide at least one of: ${EDITABLE_FIELDS.join(", ")}`,
    };
  }

  return { updates };
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const supplier = coerceOptionalString(body.supplier);
    if (!supplier) {
      return NextResponse.json(
        { error: "supplier is required" },
        { status: 400 }
      );
    }

    const containerCount = coerceContainerCount(body.container_count, 1);
    if (containerCount === null) {
      return NextResponse.json(
        { error: "container_count must be a non-negative number" },
        { status: 400 }
      );
    }

    // Default blank count to 1 (already applied via fallback above).
    const now = new Date().toISOString();
    const insertRow = {
      tenant_id: TENANT_ID,
      supplier,
      supplier_invoice: coerceNullableText(body.supplier_invoice),
      quote_ref: coerceNullableText(body.quote_ref),
      container_count: containerCount,
      container_size: coerceNullableText(body.container_size),
      eta_port: coerceNullableText(body.eta_port),
      eta_warehouse: coerceNullableText(body.eta_warehouse),
      bl_number: coerceNullableText(body.bl_number),
      container_numbers: coerceNullableText(body.container_numbers),
      source_month: coerceNullableText(body.source_month),
      loaded_at: now,
      entry_source: "manual" as const,
      status: "inbound" as const,
      arrived_at: null,
      created_by: auth.email,
      updated_by: auth.email,
      updated_at: now,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inbound_containers")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create container" },
        { status: 500 }
      );
    }

    revalidateInboundConsumers();

    return NextResponse.json({
      row: mapInboundContainerRow(data as InboundContainerRow),
    });
  } catch (error) {
    console.error("POST /api/inbound-containers/item failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create inbound container",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = coerceOptionalString(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const parsed = readEditablePatch(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Never allow entry_source changes via this route.
    const updates: Record<string, unknown> = {
      ...parsed.updates,
      updated_by: auth.email,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inbound_containers")
      .update(updates)
      .eq("tenant_id", TENANT_ID)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    revalidateInboundConsumers();

    return NextResponse.json({
      row: mapInboundContainerRow(data as InboundContainerRow),
    });
  } catch (error) {
    console.error("PATCH /api/inbound-containers/item failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update inbound container",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = coerceOptionalString(body.id);
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inbound_containers")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    revalidateInboundConsumers();

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("DELETE /api/inbound-containers/item failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete inbound container",
      },
      { status: 400 }
    );
  }
}
