import { requireUserEmail } from "@/lib/po/cart-auth";
import { mapParsedToInsertRow } from "@/lib/inbound-containers/group";
import {
  parseInboundContainersSheet,
  pickInboundWorksheet,
} from "@/lib/inbound-containers/parse";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const BUCKET = "container-uploads";
const OBJECT_PATH = "latest.xlsx";
const PREFERRED_SHEET = "Containers Expected TBL";

export async function POST() {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const supabase = createAdminClient();
    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(OBJECT_PATH);

    if (downloadError || !file) {
      return NextResponse.json(
        {
          error:
            downloadError?.message ??
            `Could not download ${OBJECT_PATH} from ${BUCKET}`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
        raw: true,
      });
    } catch (parseError) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? `Failed to read workbook: ${parseError.message}`
              : "Failed to read workbook",
        },
        { status: 400 }
      );
    }

    let sheetName: string;
    let sheet: XLSX.WorkSheet;
    try {
      const picked = pickInboundWorksheet(workbook);
      sheetName = picked.name;
      sheet = picked.sheet as XLSX.WorkSheet;
      if (!sheet) {
        throw new Error(`Worksheet "${sheetName}" is empty`);
      }
    } catch (sheetError) {
      return NextResponse.json(
        {
          error:
            sheetError instanceof Error
              ? sheetError.message
              : `Worksheet "${PREFERRED_SHEET}" not found`,
        },
        { status: 400 }
      );
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    const parsed = parseInboundContainersSheet(matrix, sheetName);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Parse produced zero valid container rows — existing data left intact",
          skippedRows: parsed.skippedRows,
          sheetName: parsed.sheetName,
          sourceMonth: parsed.sourceMonth,
        },
        { status: 400 }
      );
    }

    const replacedMonth = parsed.sourceMonth?.trim() || null;
    if (!replacedMonth) {
      return NextResponse.json(
        {
          error:
            "Could not determine source_month from the sheet — existing data left intact",
          skippedRows: parsed.skippedRows,
          sheetName: parsed.sheetName,
        },
        { status: 400 }
      );
    }

    const loadedAt = new Date().toISOString();
    const insertRows = parsed.rows.map((row) =>
      mapParsedToInsertRow(
        { ...row, sourceMonth: replacedMonth },
        TENANT_ID,
        loadedAt
      )
    );

    // Count manual rows that will be preserved (any month).
    const { count: manualCount, error: manualCountError } = await supabase
      .from("inbound_containers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("entry_source", "manual");

    if (manualCountError) {
      return NextResponse.json(
        {
          error: `Failed to count manual rows: ${manualCountError.message}`,
        },
        { status: 500 }
      );
    }

    // Month-scoped, upload-only replace. Manual rows (any month) and upload
    // rows for other months are never deleted.
    const { data: deleted, error: deleteError } = await supabase
      .from("inbound_containers")
      .delete()
      .eq("tenant_id", TENANT_ID)
      .eq("source_month", replacedMonth)
      .eq("entry_source", "upload")
      .select("id");

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to clear previous upload rows: ${deleteError.message}` },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase
      .from("inbound_containers")
      .insert(insertRows);

    if (insertError) {
      return NextResponse.json(
        {
          error: `Failed to insert parsed rows: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    revalidatePath("/reorder");
    revalidatePath("/inbound-containers");

    return NextResponse.json({
      inserted: insertRows.length,
      replacedMonth,
      sourceMonth: replacedMonth,
      loadedAt,
      skippedRows: parsed.skippedRows,
      sheetName: parsed.sheetName,
      deleted: deleted?.length ?? 0,
      manualRowsPreserved: manualCount ?? 0,
    });
  } catch (error) {
    console.error("POST /api/inbound-containers/refresh failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh inbound containers",
      },
      { status: 400 }
    );
  }
}
