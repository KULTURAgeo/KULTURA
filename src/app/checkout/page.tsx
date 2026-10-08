import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { Checkout } from "@/components/checkout";
import { requireActor } from "@/lib/auth/guards";
import { AccessError } from "@/lib/actions";
import { parseSettings } from "@/lib/admin/shipping";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  let actor: Awaited<ReturnType<typeof requireActor>>;

  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AccessError && error.code === "unauthenticated") {
      redirect("/login?next=/checkout");
    }
    throw error;
  }

  const { client, user, profile } = actor;
  const [addressResult, shippingResult] = await Promise.all([
    client
      .from("addresses")
      .select(
        "id,profile_id,recipient_name,phone,country_code,city,address_line_1,address_line_2,postal_code,is_default,created_at,updated_at",
      )
      .eq("profile_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at"),
    client.rpc("checkout_get_shipping_settings", { p_request: true }),
  ]);

  if (addressResult.error) {
    throw new Error("Checkout details are temporarily unavailable.");
  }

  let shippingSettings = {
    shippingTotal: 0,
    freeShippingThreshold: null as number | null,
  };
  if (!shippingResult.error) {
    shippingSettings = parseSettings(shippingResult.data);
  }

  return (
    <Container className="checkout-page page-section">
      <div className="checkout-title-row">
        <div>
          <p className="eyebrow">KULTURA / SECURE CHECKOUT</p>
          <h1 className="page-title">CHECKOUT</h1>
        </div>
        <p className="muted">
          Delivery across Georgia · payment connection pending
        </p>
      </div>

      <Checkout
        addresses={addressResult.data ?? []}
        profile={{
          fullName: profile.full_name ?? "",
          phone: profile.phone ?? "",
          email: user.email ?? "",
        }}
        shippingSettings={shippingSettings}
        testCheckoutEnabled={profile.role === "admin" && process.env.ENABLE_TEST_CHECKOUT === "true" && process.env.VERCEL_ENV !== "production"}
      />
    </Container>
  );
}
