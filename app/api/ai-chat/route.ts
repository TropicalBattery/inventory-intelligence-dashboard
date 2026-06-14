import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

type RunQueryInput = {
  sql: string;
  explanation: string;
};

type QueryExecutionResult = {
  rows: Record<string, unknown>[];
  error: string | null;
  rowCount: number;
};

const SYSTEM_PROMPT = `
You are an inventory intelligence assistant for Tropical Battery 
Company Limited, a battery distributor in Jamaica.

You have access to a run_query tool that executes read-only SQL 
against their Supabase PostgreSQL database.

Always filter by tenant_id = 'tropical-battery' in every query.

DATABASE SCHEMA:

TABLE: products
- id, external_id, sku, name, description, category, brand
- unit_of_measure, cost_price, selling_price, is_active
- item_class, vendor_item_number, uom_schedule, major_uom
- tenant_id, source_system, created_at, updated_at

TABLE: inventory_balances
- id, external_id, sku, location_code, location_name
- quantity_on_hand, quantity_available, quantity_reserved
- quantity_on_order, quantity_in_transit, quantity_in_bond
- quantity_at_port, quantity_in_clearing
- reorder_level, maximum_stock_level
- last_receipt_date, last_receipt_qty, last_sales_date
- supplier_external_id
- tenant_id, source_system

TABLE: item_costing
- id, external_id, sku
- current_cost_usd, current_cost_local, retail_price
- ordering_cost_per_order, holding_cost_per_unit_year
- annual_demand_units, avg_daily_demand_units
- tenant_id, source_system

TABLE: item_supplier_reference
- id, sku, supplier_external_id
- unit_price (USD), currency, lead_time_days
- pallet_qty, container_qty
- is_priority_vendor, vendor_item_number
- ordering_cost_per_order, holding_cost_per_unit_year
- tenant_id

TABLE: suppliers
- id, external_id, supplier_code, name
- contact_name, email, phone, address
- is_active, lead_time_days, lead_time_months
- pallet_qty, container_qty, is_priority_vendor
- tenant_id, source_system

TABLE: purchase_orders
- id, external_id, po_number
- supplier_external_id, supplier_code
- po_date, expected_delivery_date, status
- total_amount, memo, sent_at
- tenant_id, source_system

RULES:
- Always include WHERE tenant_id = 'tropical-battery'
- SELECT only -- never INSERT, UPDATE, DELETE, DROP, TRUNCATE
- Limit results to 50 rows unless user asks for more
- Join tables on sku or supplier_external_id as appropriate
- For location questions, use inventory_balances.location_code
- For supplier questions, join item_supplier_reference with 
  suppliers on supplier_external_id = external_id
- Currency: current_cost_local and retail_price are JMD. 
  unit_price in item_supplier_reference is USD.
- Respond in plain English with a brief explanation before 
  any data table
- Format numbers with commas. Format currency as J$ (JMD) 
  or US$ (USD) as appropriate.
- If a query returns no results, say so clearly
- If the question cannot be answered from the schema, say so
  and suggest what data would be needed
- Never use em-dashes in your responses. Use commas, 
  colons, or new sentences instead.
`.trim();

const tools: Tool[] = [
  {
    name: "run_query",
    description:
      "Execute a read-only SQL SELECT query against the Tropical Battery Supabase database",
    input_schema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description:
            "Valid PostgreSQL SELECT statement. Must include WHERE tenant_id = 'tropical-battery'. No INSERT/UPDATE/DELETE/DROP allowed.",
        },
        explanation: {
          type: "string",
          description: "One sentence explaining what this query retrieves",
        },
      },
      required: ["sql", "explanation"],
    },
  },
];

async function executeQuery(sql: string): Promise<QueryExecutionResult> {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { rows: [], error: "Query is empty", rowCount: 0 };
  }

  const normalizedStart = trimmed.replace(/\s+/g, " ").slice(0, 10).toUpperCase();
  if (!normalizedStart.startsWith("SELECT") && !normalizedStart.startsWith("WITH")) {
    return {
      rows: [],
      error: "Only SELECT queries are permitted",
      rowCount: 0,
    };
  }

  const forbidden = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "GRANT",
    "REVOKE",
  ];
  const upperSql = trimmed.toUpperCase();

  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`);
    if (regex.test(upperSql)) {
      return {
        rows: [],
        error: `Query contains disallowed operation: ${word}`,
        rowCount: 0,
      };
    }
  }

  if (!upperSql.includes("TENANT_ID")) {
    return {
      rows: [],
      error: "Query must filter by tenant_id",
      rowCount: 0,
    };
  }

  if (/;\s*\S/.test(trimmed)) {
    return {
      rows: [],
      error: "Multiple statements are not permitted",
      rowCount: 0,
    };
  }

  const limitedSql = /\bLIMIT\s+\d+/i.test(trimmed)
    ? trimmed.replace(/;+\s*$/, "")
    : `${trimmed.replace(/;+\s*$/, "")} LIMIT 50`;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("execute_ai_query", {
      query: limitedSql,
    });

    if (error) {
      if (
        error.code === "PGRST202" ||
        error.message.includes("execute_ai_query")
      ) {
        return {
          rows: [],
          error:
            "The execute_ai_query database function is not installed. Run supabase/migrations/20260614000000_execute_ai_query_fn.sql in the Supabase SQL editor, then retry.",
          rowCount: 0,
        };
      }

      return { rows: [], error: error.message, rowCount: 0 };
    }

    const rows = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : data === null || data === undefined
        ? []
        : [data as Record<string, unknown>];

    return { rows, error: null, rowCount: rows.length };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Query execution failed";
    return { rows: [], error: message, rowCount: 0 };
  }
}

function toClaudeMessages(messages: ChatRequestMessage[]): MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatRequestMessage[] };
    const messages = body.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json(
        { reply: "Please ask a question about your inventory." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { reply: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const claudeMessages = toClaudeMessages(messages);

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages: claudeMessages,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (!toolUseBlock) break;

      const { sql, explanation } = toolUseBlock.input as {
        sql: string;
        explanation: string;
      };

      console.log("AI executing query:", explanation);

      const queryResult = await executeQuery(sql);

      const resultContent = queryResult.error
        ? `Error executing query: ${queryResult.error}`
        : queryResult.rowCount === 0
          ? "Query returned no results."
          : `Query returned ${queryResult.rowCount} rows:\n${JSON.stringify(
              queryResult.rows,
              null,
              2
            )}`;

      claudeMessages.push({
        role: "assistant" as const,
        content: response.content,
      });

      claudeMessages.push({
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: toolUseBlock.id,
            content: resultContent,
          },
        ],
      });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages: claudeMessages,
      });
    }

    const finalText = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: finalText || "I could not generate a response. Please try again.",
    });
  } catch (error) {
    console.error("AI chat route failed:", error);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
