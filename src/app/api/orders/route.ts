import { NextRequest, NextResponse } from "next/server";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { buildNewebPayHtmlForm, buildNewebPayForm } from "@/lib/payments/newebpay";
import { buildOrderConfirmationHtml, buildOrderConfirmationText } from "@/lib/email/orderConfirmation";
import { sendEmail } from "@/lib/email/sendEmail";
import type { PaymentMethod } from "@/lib/supabase/types";

interface OrderItem {
  variantId: string;
  quantity: number;
  price: number;
  selectedOptions?: Array<{ name: string; choice: string; priceAdd: number }>;
}

interface OrderRequestBody {
  shipping: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
    country: string;
    academy?: string;
    lineId?: string;
  };
  paymentMethod: PaymentMethod;
  bankLastFive?: string;
  items: OrderItem[];
  totalAmount: number;
  isPreorderOrder: boolean;
  locale: string;
}

// Direct service-role client — bypasses RLS unconditionally
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}


export async function POST(request: NextRequest) {
  try {
    const body: OrderRequestBody = await request.json();
    const { shipping, paymentMethod, bankLastFive: bankLastFive_, items, totalAmount, isPreorderOrder } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Read the logged-in user from the cookie-based SSR client
    const ssrClient = await createSsrClient();
    const { data: { user } } = await ssrClient.auth.getUser();

    // All database writes use the direct service-role client
    const db = getServiceClient();

    // Validate stock for non-preorder items
    const variantIds = items.map((i) => i.variantId);
    const { data: variants, error: variantsError } = await db
      .from("product_variants")
      .select("id, size, color, stock_quantity, products(is_preorder, name_en, name_zh)")
      .in("id", variantIds);

    if (variantsError || !variants) {
      console.error("Variant fetch error:", variantsError);
      return NextResponse.json({ error: "Could not validate stock" }, { status: 500 });
    }

    for (const item of items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant) {
        return NextResponse.json(
          { error: `Product variant not found: ${item.variantId}` },
          { status: 400 }
        );
      }
      const product = variant.products as { is_preorder: boolean } | null;
      if (!product?.is_preorder && variant.stock_quantity < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for variant ${item.variantId}` },
          { status: 409 }
        );
      }
    }

    // Create order
    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        user_id: user?.id ?? null,
        guest_email: user ? null : shipping.email,
        shipping_name: shipping.fullName,
        shipping_email: shipping.email,
        shipping_phone: shipping.phone || null,
        shipping_address: shipping.address,
        shipping_city: shipping.city,
        shipping_zip: shipping.zip || null,
        shipping_country: shipping.country,
        total_amount: totalAmount,
        status: "pending_payment",
        payment_method: paymentMethod,
        payment_ref: bankLastFive_ ? `bank_last5:${bankLastFive_}` : null,
        is_preorder_order: isPreorderOrder,
        academy: shipping.academy || null,
        line_id: shipping.lineId || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json(
        { error: `Failed to create order: ${orderError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    // Create order items
    const orderItemsData = items.map((item) => ({
      order_id: order.id,
      variant_id: item.variantId,
      quantity: item.quantity,
      price_at_purchase: Math.round(item.price), // includes any option price adds
      selected_options: item.selectedOptions?.length ? item.selectedOptions : null,
    }));

    const { error: itemsError } = await db
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError) {
      console.error("Order items error:", itemsError);
      await db.from("orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: `Failed to save order items: ${itemsError.message}` },
        { status: 500 }
      );
    }

    // Decrement stock for non-preorder items
    for (const item of items) {
      const variant = variants.find((v) => v.id === item.variantId);
      const product = variant?.products as { is_preorder: boolean; name_en: string; name_zh: string } | null;
      if (!product?.is_preorder) {
        await db.rpc("decrement_stock", {
          p_variant_id: item.variantId,
          p_quantity: item.quantity,
        });
      }
    }

    // Send order confirmation emails (fire-and-forget — don't fail the order)
    try {
      const adminEmail = process.env.ADMIN_EMAIL ?? "catchjiujitsu@gmail.com";
      const emailItems = items.map((item) => {
        const variant = variants!.find((v) => v.id === item.variantId);
        const prod = variant?.products as { is_preorder: boolean; name_en: string; name_zh: string } | null;
        return {
          productNameEn: prod?.name_en ?? "Product",
          productNameZh: prod?.name_zh ?? "",
          color: (variant as { color?: string })?.color ?? "",
          size: (variant as { size?: string })?.size ?? "",
          quantity: item.quantity,
          price: item.price,
          selectedOptions: item.selectedOptions?.map((o) => ({ name: o.name, choice: o.choice })),
        };
      });

      const bankLastFive = bankLastFive_
        ? bankLastFive_
        : order.payment_ref?.startsWith("bank_last5:")
          ? order.payment_ref.replace("bank_last5:", "")
          : null;

      const emailData = {
        orderId: order.id,
        customerName: shipping.fullName,
        customerEmail: shipping.email,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingZip: shipping.zip || null,
        shippingPhone: shipping.phone || null,
        paymentMethod,
        bankLastFive,
        totalAmount,
        isPreorder: isPreorderOrder,
        items: emailItems,
      };

      const shortOrderId = order.id.slice(0, 8).toUpperCase();
      const subject = `Order Confirmed #${shortOrderId} — Matside · 訂單確認`;
      const html = buildOrderConfirmationHtml(emailData);
      const text = buildOrderConfirmationText(emailData);

      // Send to customer
      await sendEmail({
        to: [{ email: shipping.email, name: shipping.fullName }],
        subject,
        html,
        text,
      });

      // Send copy to admin
      await sendEmail({
        to: [{ email: adminEmail, name: "Matside Admin" }],
        subject: `[New Order] ${subject}`,
        html,
        text,
      });
    } catch (emailErr) {
      console.error("[orders] Email send error:", emailErr);
    }

    // For NewebPay: build encrypted form and return it
    if (paymentMethod === "newebpay") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
      const itemDesc = items.length > 1 ? `Matside Order (${items.length} items)` : "Matside Order";

      const newebpayFormData = buildNewebPayForm({
        merchantOrderNo: order.id.replace(/-/g, "").slice(0, 20),
        amt: totalAmount,
        itemDesc,
        email: shipping.email,
        returnUrl: `${siteUrl}/api/payments/newebpay/return`,
        notifyUrl: `${siteUrl}/api/payments/newebpay/callback`,
      });

      await db
        .from("orders")
        .update({ newebpay_trade_no: newebpayFormData.MerchantID + newebpayFormData.TradeInfo.slice(0, 20) })
        .eq("id", order.id);

      const htmlForm = buildNewebPayHtmlForm(newebpayFormData);
      return NextResponse.json({ orderId: order.id, newebpayForm: htmlForm });
    }

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Orders API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
