import {
  parseReorderActionViewFilters,
  REORDER_ACTION_VIEW_PAGE,
  type ReorderActionViewFilters,
} from "@/lib/reorder/view-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type SavedViewRecord = {
  id: string;
  page: string;
  name: string;
  filters: ReorderActionViewFilters;
  isDefault: boolean;
  updatedAt: string;
};

type SavedViewRow = {
  id: string;
  page: string;
  name: string;
  filters: unknown;
  is_default: boolean;
  updated_at: string;
};

function mapRow(row: SavedViewRow): SavedViewRecord {
  return {
    id: row.id,
    page: row.page,
    name: row.name,
    filters: parseReorderActionViewFilters(row.filters),
    isDefault: row.is_default,
    updatedAt: row.updated_at,
  };
}

export async function listSavedViews(
  email: string,
  page: string = REORDER_ACTION_VIEW_PAGE
): Promise<SavedViewRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_saved_views")
    .select("id, page, name, filters, is_default, updated_at")
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", email)
    .eq("page", page)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list saved views: ${error.message}`);
  }

  return ((data ?? []) as SavedViewRow[]).map(mapRow);
}

export async function createSavedView(input: {
  email: string;
  page: string;
  name: string;
  filters: ReorderActionViewFilters;
  isDefault: boolean;
}): Promise<SavedViewRecord> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (input.isDefault) {
    await clearDefaultViews(input.email, input.page);
  }

  const { data, error } = await supabase
    .from("user_saved_views")
    .insert({
      tenant_id: TENANT_ID,
      created_by: input.email,
      page: input.page,
      name: input.name,
      filters: input.filters,
      is_default: input.isDefault,
      updated_at: now,
    })
    .select("id, page, name, filters, is_default, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`A view named "${input.name}" already exists`);
    }
    throw new Error(`Failed to create saved view: ${error.message}`);
  }

  return mapRow(data as SavedViewRow);
}

export async function updateSavedView(input: {
  email: string;
  id: string;
  name?: string;
  filters?: ReorderActionViewFilters;
  isDefault?: boolean;
}): Promise<SavedViewRecord> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("user_saved_views")
    .select("id, page, name, filters, is_default, updated_at")
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", input.email)
    .eq("id", input.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load saved view: ${existingError.message}`);
  }

  if (!existing) {
    throw new Error("Saved view not found");
  }

  const row = existing as SavedViewRow;

  if (input.isDefault === true) {
    await clearDefaultViews(input.email, row.page);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.filters !== undefined) {
    patch.filters = input.filters;
  }
  if (input.isDefault !== undefined) {
    patch.is_default = input.isDefault;
  }

  const { data, error } = await supabase
    .from("user_saved_views")
    .update(patch)
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", input.email)
    .eq("id", input.id)
    .select("id, page, name, filters, is_default, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        input.name
          ? `A view named "${input.name}" already exists`
          : "That view name is already taken"
      );
    }
    throw new Error(`Failed to update saved view: ${error.message}`);
  }

  return mapRow(data as SavedViewRow);
}

export async function deleteSavedView(
  email: string,
  id: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_saved_views")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", email)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete saved view: ${error.message}`);
  }
}

async function clearDefaultViews(email: string, page: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_saved_views")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", TENANT_ID)
    .eq("created_by", email)
    .eq("page", page)
    .eq("is_default", true);

  if (error) {
    throw new Error(`Failed to clear default view: ${error.message}`);
  }
}
