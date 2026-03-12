import crypto from "crypto";

const NEWEBPAY_URL_TEST = "https://ccore.newebpay.com/MPG/mpg_gateway";
const NEWEBPAY_URL_PROD = "https://core.newebpay.com/MPG/mpg_gateway";
const NEWEBPAY_VERSION = "2.0";

function getGatewayUrl(): string {
  return process.env.NODE_ENV === "production" ? NEWEBPAY_URL_PROD : NEWEBPAY_URL_TEST;
}

interface TradeInfoParams {
  merchantOrderNo: string;
  amt: number;
  itemDesc: string;
  email: string;
  returnUrl: string;
  notifyUrl: string;
  loginType?: 0 | 1;
}

function buildQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function aesEncrypt(plainText: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv, "utf8")
  );
  return cipher.update(plainText, "utf8", "hex") + cipher.final("hex");
}

function sha256Hash(tradeInfo: string, key: string, iv: string): string {
  const hashStr = `HashKey=${key}&${tradeInfo}&HashIV=${iv}`;
  return crypto.createHash("sha256").update(hashStr).digest("hex").toUpperCase();
}

export function aesDecrypt(encryptedHex: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv, "utf8")
  );
  decipher.setAutoPadding(false);
  const decrypted = decipher.update(encryptedHex, "hex", "utf8") + decipher.final("utf8");
  return decrypted.replace(/\x00+$/g, "").trim();
}

export interface NewebPayFormData {
  MerchantID: string;
  TradeInfo: string;
  TradeSha: string;
  Version: string;
  action: string;
}

export function buildNewebPayForm(params: TradeInfoParams): NewebPayFormData {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID!;
  const hashKey = process.env.NEWEBPAY_HASH_KEY!;
  const hashIv = process.env.NEWEBPAY_HASH_IV!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const tradeInfoPlain = buildQueryString({
    MerchantID: merchantId,
    RespondType: "JSON",
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: NEWEBPAY_VERSION,
    MerchantOrderNo: params.merchantOrderNo,
    Amt: params.amt,
    ItemDesc: params.itemDesc.slice(0, 50),
    Email: params.email,
    LoginType: params.loginType ?? 0,
    ReturnURL: params.returnUrl || `${siteUrl}/api/payments/newebpay/return`,
    NotifyURL: params.notifyUrl || `${siteUrl}/api/payments/newebpay/callback`,
    ClientBackURL: `${siteUrl}/shop`,
  });

  const tradeInfo = aesEncrypt(tradeInfoPlain, hashKey, hashIv);
  const tradeSha = sha256Hash(tradeInfo, hashKey, hashIv);

  return {
    MerchantID: merchantId,
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
    Version: NEWEBPAY_VERSION,
    action: getGatewayUrl(),
  };
}

export function buildNewebPayHtmlForm(formData: NewebPayFormData): string {
  return `
    <form id="newebpay-form" method="POST" action="${formData.action}">
      <input type="hidden" name="MerchantID" value="${formData.MerchantID}" />
      <input type="hidden" name="TradeInfo" value="${formData.TradeInfo}" />
      <input type="hidden" name="TradeSha" value="${formData.TradeSha}" />
      <input type="hidden" name="Version" value="${formData.Version}" />
    </form>
    <script>document.getElementById('newebpay-form').submit();</script>
  `;
}

export function verifyNewebPayCallback(
  tradeInfo: string,
  tradeSha: string
): boolean {
  const hashKey = process.env.NEWEBPAY_HASH_KEY!;
  const hashIv = process.env.NEWEBPAY_HASH_IV!;
  const expected = sha256Hash(tradeInfo, hashKey, hashIv);
  return expected === tradeSha;
}
