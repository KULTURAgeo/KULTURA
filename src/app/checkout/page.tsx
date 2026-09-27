import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { Checkout } from "@/components/checkout";
import { requireActor } from "@/lib/auth/guards";
import { AccessError } from "@/lib/actions";

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
  const { data: addresses, error } = await client
    .from("addresses")
    .select("*")
    .eq("profile_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at");

  if (error) {
    throw new Error("Checkout details are temporarily unavailable.");
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
        addresses={addresses ?? []}
        profile={{
          fullName: profile.full_name ?? "",
          phone: profile.phone ?? "",
          email: user.email ?? "",
        }}
      />
    </Container>
  );
}
