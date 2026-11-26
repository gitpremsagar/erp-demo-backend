import type { PURCHASE_TRANSPORT_STATUS } from "@prisma/client";

export type AiChatMode = "sse" | "json";

export type AiChatRole = "user" | "assistant";

export type AiRisk = "low" | "medium" | "high";

export type AiProposalAction =
  | "create_order_draft"
  | "update_order_status"
  | "verify_order_stock"
  | "create_purchase"
  | "update_purchase_status"
  | "add_purchase_to_stock"
  | "update_purchase_grn"
  | "update_purchase_datetimes";

export interface AiClientMessage {
  role: AiChatRole;
  content: string;
}

/** A purchase the user can currently see (or has selected) on the purchase screen. */
export interface AiChatPurchaseRef {
  id: string;
  label?: string;
  status?: string;
  vehicleNumber?: string | null;
  transporter?: string | null;
}

export interface AiChatContext {
  page?: string;
  entityType?: "order" | "purchase" | "product" | string;
  entityId?: string;
  entityLabel?: string;
  assistant?: "purchase";
  filters?: {
    unloadingFrom?: string;
    unloadingTo?: string;
  };
  visiblePurchases?: AiChatPurchaseRef[];
  selectedPurchase?: AiChatPurchaseRef;
}

export interface AiActionResult {
  proposalId: string;
  action: AiProposalAction;
  ok: boolean;
  httpStatus?: number;
  entityId?: string;
  message?: string;
}

export interface AiChatRequest {
  messages: AiClientMessage[];
  context?: AiChatContext;
  actionResult?: AiActionResult;
  mode?: AiChatMode;
}

export interface AiProposalSectionRow {
  label: string;
  value: string;
}

export interface AiProposalSection {
  title: string;
  rows: AiProposalSectionRow[];
}

export interface AiProposalPreview {
  sections: AiProposalSection[];
  table?: {
    columns: string[];
    rows: string[][];
  };
  totals?: AiProposalSectionRow[];
  warnings: string[];
}

export interface AiProposalTarget {
  type: "order" | "purchase";
  id: string;
  label: string;
}

export interface AiProposal {
  id: string;
  action: AiProposalAction;
  title: string;
  summary: string;
  method: "POST" | "PATCH";
  endpoint: string;
  target: AiProposalTarget;
  payload: Record<string, unknown>;
  preview: AiProposalPreview;
  risk: AiRisk;
  requiresConfirmation: true;
  createdAt: string;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type AiChatEvent =
  | { type: "status"; step: number; message: string }
  | { type: "tool_start"; tool: string; label: string }
  | { type: "tool_result"; tool: string; ok: boolean; summary: string }
  | { type: "proposal"; proposal: AiProposal }
  | { type: "message"; content: string }
  | { type: "done"; finishReason: string; usage?: AiUsage }
  | { type: "error"; code: string; message: string; retryable?: boolean };

export interface AiChatResult {
  events: AiChatEvent[];
  message: string | null;
  proposal: AiProposal | null;
  usage?: AiUsage;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface AiStatusResponse {
  enabled: boolean;
  model: string;
  assistant?: "purchase";
  capabilities: string[];
  deterministicFallback: boolean;
  limits: {
    maxMessages: number;
    maxMessageChars: number;
    maxInvoiceRows: number;
  };
}

export interface AiInvoiceResolution {
  rowIndex: number;
  productId?: string;
  transporterId?: string;
}

export interface AiInvoiceParseRequest {
  fileName?: string;
  rows: Array<Array<string | null>>;
  resolutions?: AiInvoiceResolution[];
  allowAi?: boolean;
}

export interface AiInvoiceUnresolved {
  rowIndex: number;
  field: "product" | "transporter" | "quantity" | "invoice";
  raw: string;
  invoiceID?: string;
  candidates: Array<{
    id: string;
    name: string;
    productCode?: string;
  }>;
  reason: string;
}

export interface AiInvoiceLine {
  productId: string;
  quantity: number;
}

export interface AiInvoicePayload {
  invoiceID: string;
  invoiceDate?: string | null;
  invoiceAmount?: number;
  items: AiInvoiceLine[];
}

export interface AiVehiclePurchaseDraft {
  transporterId: string;
  transporterName?: string;
  vehicleNumber: string;
  driverContact: string;
  status: PURCHASE_TRANSPORT_STATUS;
  arrivalDate: string;
  invoices: AiInvoicePayload[];
}

export interface AiInvoiceParseResult {
  ok: boolean;
  error?: string;
  vehiclePurchases: AiVehiclePurchaseDraft[];
  warnings: string[];
  unresolved: AiInvoiceUnresolved[];
  stats: {
    dataRows: number;
    matchedLines: number;
    unresolvedLines: number;
    aiAssisted: number;
    headerRowIndex: number;
  };
  aiUsed: boolean;
}

export interface AiExtractedInvoiceLine {
  productCode: string | null;
  productName: string;
  quantity: number;
  unit: string;
  rate: number | null;
  amount: number | null;
}

export interface AiExtractedInvoice {
  invoiceID: string | null;
  invoiceDate: string | null;
  supplierName: string | null;
  vehicleNumber: string | null;
  driverContact: string | null;
  lines: AiExtractedInvoiceLine[];
}

export interface AiInvoiceExtractResult {
  ok: boolean;
  error?: string;
  imageCount: number;
  invoices: AiExtractedInvoice[];
  parse: AiInvoiceParseResult | null;
  proposals: AiProposal[];
  warnings: string[];
  stats: {
    invoices: number;
    lines: number;
    matchedLines: number;
    unresolvedLines: number;
    proposals: number;
    aiUsed: boolean;
  };
}

export interface AiLineItem {
  productId: string;
  name: string;
  productCode: string;
  quantity: number;
  confidence: "exact" | "fuzzy" | "ai";
  raw: string;
}

export interface AiUnresolvedLineItem {
  raw: string;
  reason: string;
  candidates: Array<{ id: string; name: string; productCode: string }>;
}

export interface AiLineItemsResult {
  items: AiLineItem[];
  unresolved: AiUnresolvedLineItem[];
  aiUsed: boolean;
  notes: string[];
}

export type AiInsightKind =
  | "sales_summary"
  | "low_stock"
  | "reorder_suggestions"
  | "slow_movers"
  | "pending_orders"
  | "purchases_in_transit";

export interface AiInsightResult {
  kind: AiInsightKind;
  generatedAt: string;
  facts: unknown;
  narrative: string | null;
  aiUsed: boolean;
}

export interface AiToolResult {
  content: string;
  summary: string;
  ok: boolean;
}
