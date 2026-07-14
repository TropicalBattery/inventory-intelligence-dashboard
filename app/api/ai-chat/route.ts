import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import {
  FORCE_ANSWER_MESSAGE,
  HISTORY_TRIMMED_NOTE,
  MAX_TOOL_ITERATIONS,
  OMITTED_TOOL_RESULT,
  formatQueryRowsForTool,
  sanitizeChatHistory,
} from "@/lib/ai/chat-history";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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
- total_amount, memo, sent_at, created_by
- tenant_id, source_system
status includes draft, pending_approval, approved,
sent, and suppressed (approval workflow). created_by
is the authenticated user email when the PO was
created from the dashboard cart.
To answer "is there already a PO for SKU X?", join
purchase_orders to purchase_order_lines on
po_external_id = purchase_orders.external_id (or
matching po_number). Treat draft, pending_approval,
approved, and sent as open platform POs (not yet in
GP qty-on-order). Suppressed is not open.

TABLE: user_roles
- id, tenant_id, email, role, created_at
role is buyer or approver. Used for PO approval:
only approvers can approve; creators cannot
self-approve. Unknown emails default to buyer.

TABLE: purchase_order_lines
- id, external_id, po_external_id, po_number
- product_external_id, sku
- quantity_ordered, quantity_received
- unit_cost, line_total
- tenant_id, source_system
Join to purchase_orders on po_number (or
po_external_id = purchase_orders.external_id).
Use for PO line detail / qty ordered questions.

TABLE: po_cart_items
- id, tenant_id, created_by, sku, product_name
- quantity, supplier_external_id, unit_price
- currency (USD), source_status, added_at, updated_at
Per-user PO cart before submit. One row per SKU per
user (created_by = user email).
supplier_external_id null = unassigned supplier.

TABLE: po_audit_log
- id, tenant_id, po_id, po_number
- action, from_status, to_status, actor, note
- created_at
Append-only PO approval / status transition trail.
actor is the user email. Use for "who approved" /
status history questions.

TABLE: sales_transactions
- id, external_id, transaction_number
- transaction_date, sku, product_external_id
- location_code, quantity_sold
- unit_price, discount_amount, net_amount
- customer_reference
- tenant_id, source_system
~13 months of invoice line detail (~178k rows).
Use for: sales history, day-level/amount questions,
customer_reference lookups. Prefer the monthly view
below for month/trend questions.

VIEW: vw_monthly_sales_by_sku
- tenant_id, sku, sales_month, units
Calendar-month units sold per SKU (pre-aggregated
from sales_transactions). PREFER this over raw
sales_transactions for any monthly or trend question
-- it is cheap. Example monthly sales for one SKU:
SELECT sales_month, units
FROM vw_monthly_sales_by_sku
WHERE tenant_id = 'tropical-battery' AND sku = 'X'
ORDER BY sales_month DESC.

TABLE: active_inventory_whitelist
- tenant_id, sku, buyer_rank (1 = highest buyer
  priority)
Lists SKUs in the active reorder workflow (473 items
curated by the buyers). For questions about reorder,
low stock, critical items, buying decisions, or
recommendations, JOIN to this table and include only
whitelisted SKUs unless the user explicitly asks about
the full catalogue. If the table is empty, query
without the join. buyer_rank can be used when the user
asks about buyer priorities.

TABLE: item_purchase_rules
- tenant_id, sku, rule_type, locked_vendor_id, source
rule_type is one of: discontinue, do_not_buy,
vendor_lock. Never recommend ordering a discontinue or
do_not_buy SKU. When discussing suppliers for a
vendor_lock SKU, mention that buying is locked to
locked_vendor_id (matches suppliers.external_id /
item_supplier_reference.supplier_external_id).

RULES:
- Always include WHERE tenant_id = 'tropical-battery'
- SELECT only -- never INSERT, UPDATE, DELETE, DROP, TRUNCATE
- Limit results to 50 rows unless user asks for more
- Join tables on sku or supplier_external_id as appropriate
- For location questions, use inventory_balances.location_code
- For supplier questions, join item_supplier_reference with 
  suppliers on supplier_external_id = external_id.
  Prefer suppliers.name in answers; join 
  supplier_external_id = suppliers.external_id. Use the 
  external_id / supplier_code only as a secondary 
  identifier when the name is missing.
- Currency: current_cost_local and retail_price are JMD. 
  unit_price in item_supplier_reference is USD.
  sales_transactions.unit_price / net_amount are JMD.
  po_cart_items.unit_price and purchase_order_lines
  unit_cost are typically USD.
- Sales history EXISTS in sales_transactions and
  vw_monthly_sales_by_sku. Never claim the database
  has no sales history. Prefer vw_monthly_sales_by_sku
  for monthly/trend questions; use sales_transactions
  for day-level detail, invoice amounts, or location.
- Demand used by the reorder app is stockout-adjusted
  over the last 6 complete calendar months
  (DEMAND_WINDOW_MONTHS = 6): average daily demand is
  computed only from months with sales
  (vw_monthly_sales_by_sku), then annualized. Months
  with zero sales in that window are excluded.
  item_costing.annual_demand_units /
  avg_daily_demand_units are the stored GP figures and
  may differ from the app-adjusted values.
- Status bands are lead-time-relative per item when an
  effective supplier lead time is known. Effective lead
  time resolves in order: vendor_lock locked vendor's
  lead_time_days from item_supplier_reference; else the
  is_priority_vendor row; else the minimum positive
  lead_time_days across that SKU's reference rows.
  Bands (months of cover): Critical = cover < 1.0x lead
  months; Watch = cover < 1.5x; Reorder Needed = cover
  < max(3.0x lead months, 6); OK above that. When no
  positive lead time is on file, fall back to the
  global bands: critical (< 1 month), watch (1-2),
  reorder_needed (2-6), ok (6+). Stockouts with demand
  are always critical. no_demand = no positive annual
  demand / no sales activity.
- ABC class is relative ranking by annual sales value 
  (annual_demand_units * current_cost_local from item_costing): 
  A items are roughly the top cumulative 80% of value, B up 
  to 95%, C the remainder. Classification is computed in the 
  app over recommendations, not stored in a table -- when asked 
  about A/B/C items, approximate by ranking SKUs on that product 
  of demand and cost.
- Inventory turnover ratio ≈ annual_demand_units / 
  quantity_on_hand (join item_costing to inventory_balances, 
  sum quantity_on_hand across locations per SKU). Lower 
  ratios mean slower stock turns / more cash tied up. Null 
  when stock or demand is zero. Ask "worst turnover" by 
  ranking ascending on that ratio for SKUs with positive 
  demand and on-hand.
- Overstock means months of cover above 6 (more than six 
  months of stock at the current sales rate). When asked 
  what to put on clearance, identify SKUs with high cover 
  using stock position / (annual_demand_units / 12) and 
  flag excess units above six months of demand.
- Data exceptions (data quality): negative_stock =
  inventory_balances with quantity_on_hand < 0 or
  quantity_available < 0; missing_supplier_data =
  whitelist + demand but no usable supplier lead/price
  (ROP/EOQ gaps); stale_demand = whitelist holding stock
  with last_sales_date older than 90 days;
  conflicting_rules = whitelist SKU also marked
  discontinue/do_not_buy in item_purchase_rules. Use
  these definitions when asked about data problems.
- Seasonality is computed in-app from
  vw_monthly_sales_by_sku: a calendar month is a peak
  candidate if its average units are >= 1.4x the overall
  selling-month average (complete months only; current
  incomplete month excluded). Seasonal items have 1-4
  candidate months forming at most 2 contiguous calendar
  runs (e.g. Nov-Jan). To approximate "which items are
  seasonal?" in SQL, compare each month's units to 1.4
  times that SKU's average over months with sales > 0.
- Respond in plain English with a brief explanation before 
  any data table
- Format numbers with commas. Format currency as J$ (JMD) 
  or US$ (USD) as appropriate.
- Format for a narrow chat panel: use short paragraphs, 
  bold for SKU codes and key figures, and small tables 
  with at most 4-5 columns. Avoid deep heading hierarchies; 
  one heading level is enough. Never use horizontal rules.
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

function toClaudeMessages(
  messages: { role: "user" | "assistant"; content: string }[]
): MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function isToolResultBlock(
  block: unknown
): block is ToolResultBlockParam {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    (block as { type: string }).type === "tool_result"
  );
}

/**
 * After more than 2 tool-loop iterations, omit tool_result payloads from
 * iterations before the previous one (keep the last two full results).
 */
function omitOlderToolResults(messages: MessageParam[]): void {
  const toolResultIndexes: number[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.role !== "user" || !Array.isArray(message.content)) {
      continue;
    }

    if (message.content.some((block) => isToolResultBlock(block))) {
      toolResultIndexes.push(i);
    }
  }

  if (toolResultIndexes.length <= 2) {
    return;
  }

  const keep = new Set(toolResultIndexes.slice(-2));

  for (const index of toolResultIndexes) {
    if (keep.has(index)) {
      continue;
    }

    const message = messages[index];
    if (message.role !== "user" || !Array.isArray(message.content)) {
      continue;
    }

    messages[index] = {
      role: "user",
      content: message.content.map((block) => {
        if (!isToolResultBlock(block)) {
          return block as ContentBlock;
        }

        return {
          ...block,
          content: OMITTED_TOOL_RESULT,
        };
      }),
    };
  }
}

function extractTextReply(content: ContentBlock[]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: unknown };
    const { messages, wasTrimmed } = sanitizeChatHistory(body.messages);

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

    const systemPrompt = wasTrimmed
      ? `${SYSTEM_PROMPT}\n\n${HISTORY_TRIMMED_NOTE}`
      : SYSTEM_PROMPT;

    const anthropic = new Anthropic({ apiKey });
    const claudeMessages = toClaudeMessages(messages);

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    let toolIterations = 0;

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        break;
      }

      toolIterations += toolUseBlocks.length;

      claudeMessages.push({
        role: "assistant" as const,
        content: response.content,
      });

      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUseBlock of toolUseBlocks) {
        const { sql, explanation } = toolUseBlock.input as RunQueryInput;

        console.log("AI executing query:", explanation);

        const queryResult = await executeQuery(sql);

        const resultContent = queryResult.error
          ? `Error executing query: ${queryResult.error}`
          : formatQueryRowsForTool(queryResult.rows, queryResult.rowCount);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: resultContent,
        });
      }

      claudeMessages.push({
        role: "user" as const,
        content:
          toolIterations >= MAX_TOOL_ITERATIONS
            ? [
                ...toolResults,
                { type: "text" as const, text: FORCE_ANSWER_MESSAGE },
              ]
            : toolResults,
      });

      if (toolIterations > 2) {
        omitOlderToolResults(claudeMessages);
      }

      if (toolIterations >= MAX_TOOL_ITERATIONS) {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: claudeMessages,
        });
        break;
      }

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });
    }

    const finalText = extractTextReply(response.content);

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
