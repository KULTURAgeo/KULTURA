import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { ReviewOrder } from "@/components/review-order";
import { requireActor } from "@/lib/auth/guards";
import { AccessError } from "@/lib/actions";
import { parseSettings } from "@/lib/admin/shipping";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Review Order",
  robots: { index: false, follow: false },
};

export default async function ReviewOrderPage() {
  let actor: Awaited<ReturnType<typeof requireActor>>;

  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AccessError && error.code === "unauthenticated") {
      redirect("/login?next=/checkout/review");
    }
    throw error;
  }

  const { client, profile } = actor;
  const shippingResult = await client.rpc("checkout_get_shipping_settings", {
    p_request: true,
  });

  let shippingSettings = {
    shippingTotal: 0,
    freeShippingThreshold: null as number | null,
  };
  if (!shippingResult.error) {
    shippingSettings = parseSettings(shippingResult.data);
  }

  return (
    <Container className="page-section review-order-page">
      <div className="checkout-title-row">
        <div>
          <p className="eyebrow">KULTURA / CHECKOUT</p>
          <h1 className="page-title">REVIEW ORDER</h1>
        </div>
        <p className="muted">Confirm pieces, quantities and total before delivery details.</p>
      </div>
      <ReviewOrder
        shippingSettings={shippingSettings}
        testCheckoutEnabled={profile.role === "admin"}
      />
    </Container>
  );
}
