import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const merchantOrderNo = formData.get("MerchantOrderNo") as string;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return NextResponse.redirect(`${siteUrl}/en/checkout/success?ref=${merchantOrderNo}`, {
    status: 303,
  });
}
