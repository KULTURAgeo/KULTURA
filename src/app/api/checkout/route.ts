import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/guards";
import { normalizeLines, quoteLines } from "@/lib/cart/model";
import { getProductsByIds } from "@/lib/catalog/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTestCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 30000)
      return NextResponse.json({ ok: false, message: "Your bag is too large." }, { status: 413 });

    const { client, user } = await requireActor();
    if (!user.email)
      return NextResponse.json({ ok: false, message: "A verified email address is required." }, { status: 400 });

    const body = (await request.json()) as { items?: unknown };
    const requested = normalizeLines(body.items);
    if (!requested.length)
      return NextResponse.json({ ok: false, message: "Your bag is empty." }, { status: 400 });

    const catalog = await getProductsByIds([...new Set(requested.map((line) => line.productId))]);
    if (catalog.status !== "ready")
      return NextResponse.json({ ok: false, message: "We cannot verify your bag right now." }, { status: 503 });

    const quote = quoteLines(requested, catalog.products);
    if (!quote.lines.length || quote.lines.some((line) => !line.available))
      return NextResponse.json({ ok: false, message: "One or more items are no longer available. Refresh your bag." }, { status: 409 });

    const stale = quote.lines.some((line) => {
      const submitted = requested.find((item) => item.variantId === line.variantId);
      return !submitted ||
        submitted.quantity !== line.quantity ||
        submitted.observedPrice !== line.price ||
        Boolean(line.notice);
    });
    if (stale)
      return NextResponse.json({ ok: false, message: "Price or stock changed. Refresh your bag before checkout." }, { status: 409 });

    const { data: address, error: addressError } = await client
      .from("addresses")
      .select("recipient_name,phone,country_code,city,address_line_1,address_line_2,postal_code")
      .eq("profile_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    if (addressError)
      return NextResponse.json({ ok: false, message: "We cannot load your delivery address right now." }, { status: 503 });
    if (!address)
      return NextResponse.json({ ok: false, message: "Add a default delivery address before checkout." }, { status: 400 });

    const admin = createAdminClient();
    if (!admin)
      return NextResponse.json({ ok: false, message: "Test checkout is not configured yet." }, { status: 503 });

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        customer_id: user.id,
        currency: "GEL",
        subtotal: quote.subtotal,
        shipping_total: 0,
        discount_total: 0,
        final_total: quote.subtotal,
        payment_status: "pending",
        fulfillment_status: "unfulfilled",
        customer_email: user.email,
        delivery_name: address.recipient_name,
        delivery_phone: address.phone,
        delivery_country_code: address.country_code,
        delivery_city: address.city,
        delivery_address_line_1: address.address_line_1,
        delivery_address_line_2: address.address_line_2,
        delivery_postal_code: address.postal_code,
      })
      .select("id,order_number")
      .single();
    if (orderError || !order)
      return NextResponse.json({ ok: false, message: "We could not create a test order." }, { status: 503 });

    const items = quote.lines.map((line) => {
      const product = catalog.products.find((entry) => entry.id === line.productId)!;
      const variant = product.variants.find((entry) => entry.id === line.variantId)!;
      return {
        order_id: order.id,
        product_id: line.productId,
        variant_id: line.variantId,
        product_name: line.name,
        product_slug: line.slug,
        sku: variant.sku,
        size: line.size,
        color: line.color,
        image_url: line.image,
        unit_price: line.price,
        quantity: line.quantity,
        discount_total: 0,
        line_total: line.lineTotal,
      };
    });

    const { error: itemError } = await admin.from("order_items").insert(items);
    if (itemError) {
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ ok: false, message: "We could not create the test order items." }, { status: 503 });
    }

    try {
      const session = await createTestCheckoutSession({
        orderId: order.id,
        customerId: user.id,
        customerEmail: user.email,
        lines: quote.lines.map((line) => ({
          name: line.name + " — " + line.color + " / " + line.size,
          unitAmount: line.price,
          quantity: line.quantity,
        })),
      });
      return NextResponse.json({ ok: true, url: session.url });
    } catch {
      await admin.from("order_items").delete().eq("order_id", order.id);
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ ok: false, message: "Stripe test checkout is not configured or temporarily unavailable." }, { status: 503 });
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "unauthenticated")
      return NextResponse.json({ ok: false, message: "Please sign in before checkout." }, { status: 401 });
    return NextResponse.json({ ok: false, message: "Checkout could not be started." }, { status: 500 });
  }
}
