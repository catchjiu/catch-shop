export interface OrderEmailItem {
  productNameEn: string;
  productNameZh: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  selectedOptions?: Array<{ name: string; choice: string }>;
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string | null;
  shippingPhone: string | null;
  paymentMethod: "manual_bank_transfer" | "newebpay";
  bankLastFive: string | null;
  totalAmount: number;
  isPreorder: boolean;
  items: OrderEmailItem[];
}

function formatNTD(amount: number): string {
  return `NT$ ${amount.toLocaleString("en")}`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function buildOrderConfirmationHtml(data: OrderEmailData): string {
  const {
    orderId, customerName, customerEmail,
    shippingAddress, shippingCity, shippingZip, shippingPhone,
    paymentMethod, bankLastFive, totalAmount, isPreorder, items,
  } = data;

  const isBankTransfer = paymentMethod === "manual_bank_transfer";
  const shortOrderId = shortId(orderId);

  const itemRowsHtml = items.map((item) => {
    const opts = item.selectedOptions?.length
      ? `<br/><span style="font-size:12px;color:#94a3b8;">${item.selectedOptions.map((o) => `${o.name}: ${o.choice}`).join(" · ")}</span>`
      : "";
    return `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #1e293b;vertical-align:top;">
          <div style="font-weight:600;color:#f1f5f9;">${item.productNameEn}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${item.productNameZh}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">${item.color} · ${item.size}${opts}</div>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #1e293b;text-align:center;color:#94a3b8;vertical-align:top;">×${item.quantity}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #1e293b;text-align:right;font-weight:600;color:#f1f5f9;vertical-align:top;white-space:nowrap;">${formatNTD(item.price * item.quantity)}</td>
      </tr>`;
  }).join("");

  const bankDetailsHtml = isBankTransfer ? `
    <div style="margin:28px 0;background:#1e3a2e;border:1px solid #166534;border-radius:10px;padding:20px 24px;">
      <div style="font-size:13px;font-weight:700;color:#4ade80;letter-spacing:0.05em;margin-bottom:14px;text-transform:uppercase;">
        Payment Instructions &nbsp;·&nbsp; 付款說明
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="color:#86efac;padding:4px 0;width:130px;">Bank / 銀行</td>
          <td style="color:#f1f5f9;font-weight:600;">China Trust (CTBC) 中信銀行 822</td>
        </tr>
        <tr>
          <td style="color:#86efac;padding:4px 0;">Account / 帳號</td>
          <td style="color:#f1f5f9;font-weight:600;letter-spacing:0.05em;">037540606649</td>
        </tr>
        <tr>
          <td style="color:#86efac;padding:4px 0;">Amount / 金額</td>
          <td style="color:#4ade80;font-weight:700;font-size:16px;">${formatNTD(totalAmount)}</td>
        </tr>
        ${bankLastFive ? `<tr><td style="color:#86efac;padding:4px 0;">Your last 5 digits / 您的帳號末五碼</td><td style="color:#f1f5f9;font-weight:600;letter-spacing:0.1em;">${bankLastFive}</td></tr>` : ""}
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#86efac;line-height:1.6;">
        Please transfer the exact amount and keep your transfer receipt. Your order will be processed once payment is confirmed.<br/>
        請轉帳確切金額並保留轉帳收據，付款確認後我們將處理您的訂單。
      </p>
    </div>` : `
    <div style="margin:28px 0;background:#1e2a3a;border:1px solid #1d4ed8;border-radius:10px;padding:16px 24px;">
      <div style="font-size:13px;color:#93c5fd;">Payment processed via NewebPay · 透過藍新金流付款</div>
    </div>`;

  const preorderBannerHtml = isPreorder ? `
    <div style="margin:0 0 24px;background:#312e0a;border:1px solid #854d0e;border-radius:10px;padding:14px 20px;font-size:13px;color:#fde047;line-height:1.6;">
      <strong>⏳ Preorder Item / 預購商品</strong><br/>
      This is a preorder. Estimated shipping will be communicated separately.<br/>
      此為預購商品，預計出貨日期將另行通知。
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmation — Matside</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 32px 24px;border-bottom:1px solid #1e293b;text-align:center;">
              <div style="font-size:28px;font-weight:900;letter-spacing:-0.03em;color:#ffffff;">MATSIDE</div>
              <div style="font-size:12px;color:#475569;margin-top:4px;letter-spacing:0.1em;text-transform:uppercase;">Premium Jiu Jitsu Gear · 頂級柔術裝備</div>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:#0f172a;padding:28px 32px 20px;text-align:center;">
              <div style="display:inline-block;background:#166534;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:16px;">✓</div>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;">Order Confirmed!</h1>
              <p style="margin:0;font-size:16px;color:#64748b;">訂單已確認</p>
              <div style="display:inline-block;margin-top:16px;background:#1e293b;border-radius:8px;padding:8px 20px;">
                <span style="font-size:12px;color:#64748b;">Order ID · 訂單編號</span>
                <span style="margin-left:10px;font-size:16px;font-weight:700;color:#f1f5f9;letter-spacing:0.05em;">#${shortOrderId}</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#0f172a;padding:0 32px 32px;border-radius:0 0 16px 16px;">

              ${preorderBannerHtml}

              <!-- Greeting -->
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.7;">
                Hi <strong style="color:#f1f5f9;">${customerName}</strong>, thank you for your order!
                We've received your purchase and will keep you updated.<br/>
                <span style="font-size:13px;color:#64748b;">您好 ${customerName}，感謝您的訂購！我們已收到您的訂單，後續進度將通知您。</span>
              </p>

              <!-- Order items -->
              <div style="font-size:13px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:10px;">
                Order Summary · 訂單明細
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0a0f1a;border-radius:10px;overflow:hidden;border:1px solid #1e293b;">
                <thead>
                  <tr style="background:#1e293b;">
                    <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Item</th>
                    <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Qty</th>
                    <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Price</th>
                  </tr>
                </thead>
                <tbody>${itemRowsHtml}</tbody>
                <tfoot>
                  <tr style="background:#1e293b;">
                    <td colspan="2" style="padding:14px 8px;font-size:14px;font-weight:700;color:#94a3b8;">Total · 總計</td>
                    <td style="padding:14px 8px;text-align:right;font-size:18px;font-weight:800;color:#ffffff;">${formatNTD(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>

              ${bankDetailsHtml}

              <!-- Shipping info -->
              <div style="margin-top:24px;">
                <div style="font-size:13px;font-weight:700;color:#475569;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:10px;">
                  Shipping Details · 寄送資訊
                </div>
                <div style="background:#0a0f1a;border:1px solid #1e293b;border-radius:10px;padding:16px 20px;font-size:14px;line-height:1.8;color:#94a3b8;">
                  <strong style="color:#f1f5f9;">${customerName}</strong><br/>
                  ${shippingAddress}<br/>
                  ${shippingCity}${shippingZip ? ` ${shippingZip}` : ""}<br/>
                  ${customerEmail}<br/>
                  ${shippingPhone ? shippingPhone : ""}
                </div>
              </div>

              <!-- Footer note -->
              <p style="margin:28px 0 0;font-size:12px;color:#334155;line-height:1.7;text-align:center;">
                Questions? Reply to this email or contact us at <a href="mailto:sales@mat-side.com" style="color:#60a5fa;text-decoration:none;">sales@mat-side.com</a><br/>
                有任何問題？請回覆此郵件或聯絡 <a href="mailto:sales@mat-side.com" style="color:#60a5fa;text-decoration:none;">sales@mat-side.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#1e293b;">
                © ${new Date().getFullYear()} Matside Co., Ltd. · <a href="https://mat-side.com" style="color:#334155;text-decoration:none;">mat-side.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOrderConfirmationText(data: OrderEmailData): string {
  const shortOrderId = shortId(data.orderId);
  const isBankTransfer = data.paymentMethod === "manual_bank_transfer";

  const itemLines = data.items.map((item) => {
    const opts = item.selectedOptions?.length
      ? ` (${item.selectedOptions.map((o) => `${o.name}: ${o.choice}`).join(", ")})`
      : "";
    return `  • ${item.productNameEn} — ${item.color} / ${item.size} ×${item.quantity}${opts}  ${formatNTD(item.price * item.quantity)}`;
  }).join("\n");

  return `
Order Confirmed — Matside
Order #${shortOrderId}

Hi ${data.customerName}, thank you for your order!

ITEMS:
${itemLines}

TOTAL: ${formatNTD(data.totalAmount)}

${isBankTransfer ? `PAYMENT (Bank Transfer):
  Bank: China Trust (CTBC) 822
  Account: 037540606649
  Amount: ${formatNTD(data.totalAmount)}
  ${data.bankLastFive ? `Your last 5 digits: ${data.bankLastFive}` : ""}

Please transfer the exact amount and keep your receipt.` : "Payment: NewebPay"}

SHIPPING TO:
  ${data.customerName}
  ${data.shippingAddress}, ${data.shippingCity}${data.shippingZip ? ` ${data.shippingZip}` : ""}
  ${data.customerEmail}

Questions? Email sales@mat-side.com
mat-side.com
`.trim();
}
