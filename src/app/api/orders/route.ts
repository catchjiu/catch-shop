import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildNewebPayHtmlForm, buildNewebPayForm } from "@/lib/payments/newebpay";
import type { PaymentMethod } from "@/lib/supabase/types";

interface OrderItem {
  variantId: string;
  quantity: number;
  price: number;
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
  };
  paymentMethod: PaymentMethod;
  bankLastFive?: string;
  items: OrderItem[];
  totalAmount: number;
  isPreorderOrder: boolean;
  locale: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: OrderRequestBody = await request.json();
    const { shipping, paymentMethod, bankLastFive, items, totalAmount, isPreorderOrder } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    // Get current authenticated user (optional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Validate stock for non-preorder items
    const variantIds = items.map((i) => i.variantId);
    const { data: variants } = await serviceClient
      .from("product_variants")
      .select("id, stock_quantity, products(is_preorder)")
      .in("id", variantIds);

    if (!variants) {
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
    const { data: order, error: orderError } = await serviceClient
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
        payment_ref: bankLastFive ? `bank_last5:${bankLastFive}` : null,
        is_preorder_order: isPreorderOrder,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Create order items
    const orderItemsData = items.map((item) => ({
      order_id: order.id,
      variant_id: item.variantId,
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const { error: itemsError } = await serviceClient
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError) {
      console.error("Order items error:", itemsError);
      // Rollback order
      await serviceClient.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 });
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

      // Store trade no reference
      await serviceClient
        .from("orders")
        .update({ newebpay_trade_no: newebpayFormData.MerchantID + newebpayFormData.TradeInfo.slice(0, 20) })
        .eq("id", order.id);

      const htmlForm = buildNewebPayHtmlForm(newebpayFormData);
      return NextResponse.json({ orderId: order.id, newebpayForm: htmlForm });
    }

    // Manual bank transfer: just return order ID
    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("Orders API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
