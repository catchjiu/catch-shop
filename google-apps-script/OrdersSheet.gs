// ─────────────────────────────────────────────────────────────────────────────
// Matside — Orders Google Sheet Sync
//
// SETUP INSTRUCTIONS
// 1. Go to https://sheets.google.com and create a new spreadsheet.
// 2. Rename "Sheet1" to "Orders".
// 3. In the menu bar: Extensions → Apps Script
// 4. Delete any existing code and paste this entire file.
// 5. Click Save (Ctrl+S), then Deploy → New Deployment.
//    - Type: Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Click Deploy → authorize when prompted → copy the Web App URL.
// 7. Add to Coolify env vars:
//      GOOGLE_SHEETS_WEBHOOK_URL=<paste URL here>
//      WEBHOOK_SECRET=<your secret>
// 8. In Supabase Dashboard → Database → Webhooks:
//    - Name: order_sync
//    - Table: orders, Events: INSERT, UPDATE
//    - URL: https://your-site.com/api/webhooks/order-created
//    - HTTP Headers: x-webhook-secret: <WEBHOOK_SECRET value>
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_NAME = "Orders";

// ── Columns definition ────────────────────────────────────────────────────────
var COLUMNS = [
  "Order ID",
  "Date",
  "Status",
  "Is Preorder",
  "Customer Name",
  "Email",
  "Phone",
  "LINE ID",
  "Academy",
  "Address",
  "City",
  "ZIP",
  "Payment Method",
  "Bank Last 5",
  "Product Name",
  "Color",
  "Size",
  "Qty",
  "Options",
  "Order Total (NT$)",
  "Last Updated",
];

// ── doGet: handles all sync requests (GET has no redirect issues) ─────────────
//
// Modes:
//   ?action=sync&apiUrl=...&secret=...   → pull ALL orders and write to sheet
//   ?action=single&apiUrl=...&secret=... → pull ONE order (orderId required)
//   (no action)                          → health-check / authorization test
//
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action || "";

  if (action === "sync" || action === "single") {
    var apiUrl = params.apiUrl || "";
    var secret = params.secret || "";
    if (!apiUrl || !secret) {
      return json({ error: "Missing apiUrl or secret" });
    }
    var fetchUrl = apiUrl + "?secret=" + encodeURIComponent(secret);
    if (params.orderId) {
      fetchUrl += "&orderId=" + encodeURIComponent(params.orderId);
    }
    return syncFromUrl(fetchUrl);
  }

  // Health check — also triggers authorization for Google Sheets
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService
      .createTextOutput("✅ Script is authorized and connected to: " + ss.getName())
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService
      .createTextOutput("❌ Error: " + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ── doPost: kept for backward-compatibility / direct pushes ──────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var orders = Array.isArray(payload) ? payload : [payload];
    var sheet = getOrCreateSheet();
    orders.forEach(function(order) { upsertOrder(sheet, order); });
    return json({ success: true, count: orders.length });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── Core: fetch orders from our API and write to sheet ────────────────────────
function syncFromUrl(fetchUrl) {
  try {
    var response = UrlFetchApp.fetch(fetchUrl, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    if (code !== 200) {
      return json({ error: "API returned " + code + ": " + response.getContentText() });
    }

    var orders = JSON.parse(response.getContentText());
    if (!Array.isArray(orders)) {
      return json({ error: "Unexpected API response", raw: response.getContentText() });
    }

    var sheet = getOrCreateSheet();
    orders.forEach(function(order) { upsertOrder(sheet, order); });
    return json({ success: true, count: orders.length });

  } catch (err) {
    return json({ error: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    formatHeaderRow(sheet);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    formatHeaderRow(sheet);
  }
  return sheet;
}

// ── Upsert an order — one row per item ───────────────────────────────────────
function upsertOrder(sheet, order) {
  var shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";

  var bankLastFive = "";
  if (order.paymentRef && order.paymentRef.indexOf("bank_last5:") === 0) {
    bankLastFive = order.paymentRef.replace("bank_last5:", "");
  }

  var dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString("zh-TW") : "";
  var now = new Date().toLocaleString("zh-TW");
  var paymentMethod = order.paymentMethod ? order.paymentMethod.replace(/_/g, " ") : "";

  // Delete all existing rows for this order (column 1 matches shortId)
  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === shortId) {
      rowsToDelete.push(i + 1); // 1-indexed
    }
  }
  for (var d = 0; d < rowsToDelete.length; d++) {
    sheet.deleteRow(rowsToDelete[d]);
  }

  // Build one row per item
  var items = (order.items && order.items.length) ? order.items : [null];
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var productName = item ? (item.productName || "") : "";
    var color       = item ? (item.color || "")       : "";
    var size        = item ? (item.size || "")        : "";
    var qty         = item ? (item.quantity || 1)     : "";
    var opts        = "";
    if (item && item.selectedOptions && item.selectedOptions.length) {
      opts = item.selectedOptions.map(function(o) { return o.group + ": " + o.choice; }).join(", ");
    }

    var row = [
      shortId,
      dateStr,
      order.status || "",
      order.isPreorder ? "Yes" : "No",
      order.customerName || "",
      order.email || "",
      order.phone || "",
      order.lineId || "",
      order.academy || "",
      order.address || "",
      order.city || "",
      order.zip || "",
      paymentMethod,
      bankLastFive,
      productName,
      color,
      size,
      qty,
      opts,
      j === 0 ? (order.totalAmount || 0) : "", // total only on first item row
      now,
    ];

    sheet.appendRow(row);
    colorStatusCell(sheet, sheet.getLastRow(), order.status);
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function formatHeaderRow(sheet) {
  var header = sheet.getRange(1, 1, 1, COLUMNS.length);
  header.setFontWeight("bold");
  header.setBackground("#1a1a2e");
  header.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1,  100); // Order ID
  sheet.setColumnWidth(2,  150); // Date
  sheet.setColumnWidth(3,  130); // Status
  sheet.setColumnWidth(4,   90); // Is Preorder
  sheet.setColumnWidth(5,  150); // Customer Name
  sheet.setColumnWidth(6,  200); // Email
  sheet.setColumnWidth(7,  120); // Phone
  sheet.setColumnWidth(8,  120); // LINE ID
  sheet.setColumnWidth(9,  140); // Academy
  sheet.setColumnWidth(10, 200); // Address
  sheet.setColumnWidth(11, 100); // City
  sheet.setColumnWidth(12,  80); // ZIP
  sheet.setColumnWidth(13, 150); // Payment Method
  sheet.setColumnWidth(14, 100); // Bank Last 5
  sheet.setColumnWidth(15, 180); // Product Name
  sheet.setColumnWidth(16, 120); // Color
  sheet.setColumnWidth(17,  80); // Size
  sheet.setColumnWidth(18,  50); // Qty
  sheet.setColumnWidth(19, 180); // Options
  sheet.setColumnWidth(20, 120); // Order Total
  sheet.setColumnWidth(21, 150); // Last Updated
}

function colorStatusCell(sheet, rowNum, status) {
  var cell = sheet.getRange(rowNum, 3);
  var colors = {
    "pending_payment":  ["#7c5100", "#fff3cd"],
    "processing":       ["#0d3b6e", "#cce5ff"],
    "shipped":          ["#4a1a8d", "#e8d5ff"],
    "ready_for_pickup": ["#0a4d4d", "#ccf5f5"],
    "completed":        ["#145214", "#ccffcc"],
    "cancelled":        ["#6b1a1a", "#ffcccc"],
  };
  var c = colors[status];
  if (c) {
    cell.setFontColor(c[0]).setBackground(c[1]).setFontWeight("bold");
  }
}
