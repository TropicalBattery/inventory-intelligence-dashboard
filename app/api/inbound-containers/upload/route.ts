import { requireUserEmail } from "@/lib/po/cart-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BUCKET = "container-uploads";
const OBJECT_PATH = "latest.xlsx";
const MAX_BYTES = 10 * 1024 * 1024;

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Some clients send a generic content type for .xlsx; extension check still applies.
const ACCEPTED_CONTENT_TYPES = new Set([
  XLSX_CONTENT_TYPE,
  "application/octet-stream",
  "",
]);

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart form data with a file" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file field in upload" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are accepted" },
        { status: 400 }
      );
    }

    if (!ACCEPTED_CONTENT_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported content type: ${file.type}` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 10MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(OBJECT_PATH, buffer, {
        upsert: true,
        contentType: XLSX_CONTENT_TYPE,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/inbound-containers/upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload sheet",
      },
      { status: 500 }
    );
  }
}
