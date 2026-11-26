# AI Assistant (Orders & Purchases)

DeepSeek-powered assistant for the admin portal. It answers questions about orders,
purchases, customers, products, stock, and sales, and prepares write actions that the
user must explicitly confirm.

## Setup

1. Add the key to `backend/.env` (never commit it):

   ```env
   DEEPSEEK_API_KEY=your-key-here
   DEEPSEEK_MODEL=deepseek-flash
   DEEPSEEK_REASONER_MODEL=deepseek-v4-pro
   DEEPSEEK_THINKING=disabled
   ```

2. Restart the backend (`npm run dev`). The frontend reads no AI secrets.

3. Log in as `ADMIN`, `SUPER_ADMIN`, or `MIS`. The **AI** button appears in the admin
   header, the order-grid toolbar, and the purchase-forecast toolbar.

If `DEEPSEEK_API_KEY` is missing, chat returns 503 and the panel shows a configuration
notice. Invoice parsing and natural-language line matching still work deterministically.

## Endpoints

All routes require an admin-portal JWT and are rate-limited per user.

| Endpoint | Purpose |
|---|---|
| `GET /api/ai/status` | Configuration, model, capabilities, limits |
| `POST /api/ai/chat` | SSE chat with tool calling; `mode:"json"` for tests |
| `POST /api/ai/invoice-parse` | Excel/CSV rows → purchase draft |
| `POST /api/ai/line-items` | Natural language → resolved product lines |
| `POST /api/ai/insights` | Sales, low stock, reorder, slow movers, open orders/purchases |

## Safety model

- The AI module has **no write path**. It reads Prisma directly (capped fields and row
  limits) and emits `propose_*` results as confirmation cards.
- Confirming a card calls the existing REST endpoint through the existing axios client,
  so auth, Zod validation, FIFO stock logic, price snapshots, and audit records remain
  authoritative.
- Only one proposal is allowed per turn. Deletes, full replacements, discounts, and
  narration edits are intentionally unavailable.
- Draft orders created by AI use `isVerifiedByAdmin: false` and reserve no stock.
  Verifying stock is a separate, high-risk confirmed action.
- Marking a purchase `COMPLETED` also transfers planned batches into live stock. The
  confirmation card warns about this explicitly.
- No Prisma models or migrations were added. Chats live in browser `sessionStorage` and
  are capped; pending proposals are not persisted across reloads.

## Query optimization

The assistant is designed to use few tool rounds, not a low tool-round cap:

- The product catalog (names, codes, pricing, packet/carton data) is cached in
  process for 5 minutes, so resolving many product names/codes is in-memory.
- Proposal tools resolve customer/transporter names, product names/codes, order
  codes, GRNs, invoice numbers, and vehicle numbers server-side. The model does
  not need separate `search_*` calls before preparing an action.
- `search_products`, `search_customers`, and `search_transporters` accept arrays,
  resolving many values in one database query.
- `business_overview` returns sales, low stock, reorder suggestions, open orders,
  and in-transit purchases in one call, running those queries in parallel.
- Tool rounds are not capped. `AI_TOTAL_TIMEOUT_MS` is the only request-level
  guard; the default is 180 seconds.

## Repeat / reorder evaluation

Asking the assistant to "add the usual items for <customer>", "reorder for
<customer>", or "repeat the last order" must never produce guessed products or
quantities. The model is required to call `customer_order_history` first:

- Resolves the customer from a name, dbName, or `"Name (Area)"`; ambiguous or
  missing names return candidates instead of a guess.
- Reads the last N orders (default 10) with full line items, with no 30-day
  cutoff and completed orders included. Default scope is completed-or-verified;
  `all` is available if the default has too few orders.
- Aggregates each product: appearances, frequency, total/average/min/max cartons,
  last-order quantity, and the order dates.
- Applies the requested rules. Defaults are `majority` inclusion (appears in at
  least half the evaluated orders) and `average` quantity (rounded cartons across
  the orders where the product appeared). `any`/`latest` inclusion and
  `latest`/`max`/`min` quantity are available.
- Returns the real orders and line items plus the suggested draft lines, with
  anomaly notes (latest order much smaller/larger than earlier ones, one-off
  products, volatile quantities, stale history, discontinued products) and
  data-quality notes (few orders, unverified/open orders, scope counts).

The assistant must show the orders used, the rule labels, and the evidence before
preparing a draft. The server also guards against ungrounded answers: a
repeat/reorder request that reaches the model's final answer without a
`customer_order_history` tool result is retried once with a system guard instead
of being shown to the user, and a `propose_create_order_draft` call in that turn
is rejected until the history lookup has run.

## Invoice parsing

The frontend reads `.xlsx`/`.csv` into rows with ExcelJS and sends them to the backend.
The backend detects header rows, resolves product codes/names and transporters with
exact/fuzzy matching, and only calls DeepSeek for unresolved rows using server-provided
candidate lists. Ambiguous rows stay unresolved until the user picks a product or
transporter. The result pre-fills the existing purchase form; the user still clicks
Create.

PDF extraction is not supported in v1.

## DeepSeek notes

- Default endpoint: `https://api.deepseek.com/chat/completions`.
- Default model: `deepseek-flash` (1M context, tool calling). `deepseek-chat` and
  `deepseek-reasoner` are legacy aliases and are not defaults.
- Thinking is disabled by default for tool-loop latency. If the current API rejects the
  `thinking` parameter, the client retries without optional parameters; set
  `DEEPSEEK_THINKING=enabled` only after checking the account's API behavior, because
  thinking-mode tool loops require replaying `reasoning_content`.
- Tool rounds are not capped. `AI_REQUEST_TIMEOUT_MS` (per provider call) and
  `AI_TOTAL_TIMEOUT_MS` (whole request) are configurable in `.env.example`.

## Example prompts

- “Show pending orders and summarize them by status.”
- “Which products are low on stock?”
- “Suggest reorders based on the last 60 days of sales.”
- “Add the usual items for Pasari Traders (Bankura) based on the last 10 orders.”
- “Repeat Bankura Pasari's last order, but use the latest quantities.”
- “Create a draft order for ABC Traders with 20 cartons of SKU-001.”
- “Verify stock for order <order code>.”
- “Create a purchase from <transporter>, invoice INV-101, 20 cartons of SKU-001.”
- “Add purchase <id> to stock.”
