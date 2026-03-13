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
// 6. Click Deploy, copy the Web App URL.
// 7. Add it to Coolify env vars: GOOGLE_SHEETS_WEBHOOK_URL=<paste URL here>
// 8. In Supabase Dashboard → Database → Webhooks:
//    - Name: order_sync
//    - Table: orders
//    - Events: INSERT, UPDATE
//    - Method: POST
//    - URL: https://your-site.com/api/webhooks/order-created
//    - HTTP Headers: x-webhook-secret: <same value as WEBHOOK_SECRET in your .env>
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_NAME = "Orders";

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
  "Items",
  "Total (NT$)",
  "Last Updated",
];

// ── Entry point ───────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Accept a single order object or an array (bulk sync)
    var orders = Array.isArray(payload) ? payload : [payload];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create sheet + header row if it doesn't exist yet
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(COLUMNS);
      formatHeaderRow(sheet);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
      formatHeaderRow(sheet);
    }

    orders.forEach(function (order) {
      upsertOrder(sheet, order);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: orders.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Upsert a single order row ─────────────────────────────────────────────────

function upsertOrder(sheet, order) {
  var shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";

  // Format items as readable text
  var itemsText = "";
  if (order.items && order.items.length) {
    itemsText = order.items.map(function (i) {
      var opts = i.selectedOptions && i.selectedOptions.length
        ? " [" + i.selectedOptions.map(function (o) { return o.choice; }).join(", ") + "]"
        : "";
      return i.productName + " — " + i.color + " / " + i.size + " ×" + i.quantity + opts;
    }).join("\n");
  }

  var bankLastFive = "";
  if (order.paymentRef && order.paymentRef.indexOf("bank_last5:") === 0) {
    bankLastFive = order.paymentRef.replace("bank_last5:", "");
  }

  var row = [
    shortId,
    order.createdAt ? new Date(order.createdAt).toLocaleString("zh-TW") : "",
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
    order.paymentMethod ? order.paymentMethod.replace(/_/g, " ") : "",
    bankLastFive,
    itemsText,
    order.totalAmount || 0,
    new Date().toLocaleString("zh-TW"),
  ];

  // Check if row with this Order ID already exists
  var data = sheet.getDataRange().getValues();
  var existingRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === shortId) {
      existingRow = i + 1; // 1-indexed
      break;
    }
  }

  if (existingRow > 0) {
    // Update existing row
    sheet.getRange(existingRow, 1, 1, COLUMNS.length).setValues([row]);
  } else {
    // Append new row
    sheet.appendRow(row);
    // Colour status cell
    colorStatusCell(sheet, sheet.getLastRow(), order.status);
  }

  // Always refresh status colour on update too
  if (existingRow > 0) {
    colorStatusCell(sheet, existingRow, order.status);
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatHeaderRow(sheet) {
  var header = sheet.getRange(1, 1, 1, COLUMNS.length);
  header.setFontWeight("bold");
  header.setBackground("#1a1a2e");
  header.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  // Column widths
  sheet.setColumnWidth(1,  100);  // Order ID
  sheet.setColumnWidth(2,  150);  // Date
  sheet.setColumnWidth(3,  130);  // Status
  sheet.setColumnWidth(4,  90);   // Is Preorder
  sheet.setColumnWidth(5,  140);  // Customer Name
  sheet.setColumnWidth(6,  200);  // Email
  sheet.setColumnWidth(7,  120);  // Phone
  sheet.setColumnWidth(8,  120);  // LINE ID
  sheet.setColumnWidth(9,  140);  // Academy
  sheet.setColumnWidth(10, 200);  // Address
  sheet.setColumnWidth(11, 100);  // City
  sheet.setColumnWidth(12, 80);   // ZIP
  sheet.setColumnWidth(13, 150);  // Payment Method
  sheet.setColumnWidth(14, 100);  // Bank Last 5
  sheet.setColumnWidth(15, 280);  // Items
  sheet.setColumnWidth(16, 100);  // Total
  sheet.setColumnWidth(17, 150);  // Last Updated
}

function colorStatusCell(sheet, rowNum, status) {
  var cell = sheet.getRange(rowNum, 3); // Status is column 3
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
