import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyNewebPayCallback, aesDecrypt } from "@/lib/payments/newebpay";

interface NewebPayResult {
  Status: string;
  Message: string;
  Result?: {
    MerchantID: string;
    Amt: number;
    TradeNo: string;
    MerchantOrderNo: string;
    PaymentType: string;
    RespondType: string;
    PayTime: string;
    IP: string;
    EscrowBank: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const tradeInfo = formData.get("TradeInfo") as string;
    const tradeSha = formData.get("TradeSha") as string;

    if (!tradeInfo || !tradeSha) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Verify hash signature
    if (!verifyNewebPayCallback(tradeInfo, tradeSha)) {
      console.error("NewebPay hash verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Decrypt trade info
    const hashKey = process.env.NEWEBPAY_HASH_KEY!;
    const hashIv = process.env.NEWEBPAY_HASH_IV!;
    const decrypted = aesDecrypt(tradeInfo, hashKey, hashIv);

    let result: NewebPayResult;
    try {
      result = JSON.parse(decrypted) as NewebPayResult;
    } catch {
      // Try querystring parse fallback
      const params = new URLSearchParams(decrypted);
      result = {
        Status: params.get("Status") ?? "FAILED",
        Message: params.get("Message") ?? "",
        Result: params.get("MerchantOrderNo")
          ? {
              MerchantID: params.get("MerchantID") ?? "",
              Amt: parseInt(params.get("Amt") ?? "0"),
              TradeNo: params.get("TradeNo") ?? "",
              MerchantOrderNo: params.get("MerchantOrderNo") ?? "",
              PaymentType: params.get("PaymentType") ?? "",
              RespondType: "String",
              PayTime: params.get("PayTime") ?? "",
              IP: params.get("IP") ?? "",
              EscrowBank: params.get("EscrowBank") ?? "",
            }
          : undefined,
      };
    }

    if (result.Status !== "SUCCESS" || !result.Result) {
      console.log("NewebPay payment not successful:", result.Status, result.Message);
      return new NextResponse("OK");
    }

    const { MerchantOrderNo, TradeNo, Amt } = result.Result;

    const serviceClient = await createServiceClient();

    // Find order by reconstructed merchant order no
    // MerchantOrderNo is order.id without dashes (first 20 chars)
    const { data: orders } = await serviceClient
      .from("orders")
      .select("id, total_amount, status, order_items(variant_id, quantity, product_variants(products(is_preorder)))")
      .eq("status", "pending_payment")
      .limit(100);

    const order = orders?.find((o) => {
      const derivedNo = o.id.replace(/-/g, "").slice(0, 20);
      return derivedNo === MerchantOrderNo;
    });

    if (!order) {
      console.error("Order not found for MerchantOrderNo:", MerchantOrderNo);
      return new NextResponse("OK");
    }

    // Verify amount matches
    if (order.total_amount !== Amt) {
      console.error("Amount mismatch:", order.total_amount, "vs", Amt);
      return new NextResponse("OK");
    }

    // Decrement stock for non-preorder items atomically
    const orderItems = order.order_items as Array<{
      variant_id: string;
      quantity: number;
      product_variants: { products: { is_preorder: boolean } | null } | null;
    }>;

    for (const item of orderItems) {
      const isPreorder = item.product_variants?.products?.is_preorder;
      if (!isPreorder) {
        const { error } = await serviceClient.rpc("decrement_stock", {
          p_variant_id: item.variant_id,
          p_quantity: item.quantity,
        });
        if (error) {
          console.error("Stock decrement failed for variant", item.variant_id, error);
        }
      }
    }

    // Update order status to processing
    await serviceClient
      .from("orders")
      .update({
        status: "processing",
        payment_ref: TradeNo,
        newebpay_trade_no: TradeNo,
      })
      .eq("id", order.id);

    return new NextResponse("OK");
  } catch (err) {
    console.error("NewebPay callback error:", err);
    return new NextResponse("ERROR", { status: 500 });
  }
}
