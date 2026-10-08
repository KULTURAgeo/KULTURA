"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { money } from "@/lib/catalog";
import type { Database } from "@/lib/supabase/database.types";
import { createTestOrder, quotePromo } from "@/app/checkout/actions";
import { createUnpaidOrder } from "@/app/checkout/unpaid-actions";

type Address = Database["public"]["Tables"]["addresses"]["Row"];

type CheckoutProps = {
  addresses: Address[];
  profile: {
    fullName: string;
    phone: string;
    email: string;
  };
  shippingSettings: {
    shippingTotal: number;
    freeShippingThreshold: number | null;
  };
  testCheckoutEnabled: boolean;
};

type DraftAddress = {
  recipient_name: string;
  phone: string;
  city: string;
  address_line_1: string;
  address_line_2: string;
  postal_code: string;
};

const FREE_DELIVERY_THRESHOLD = 19900;
const TBILISI_DELIVERY = 1000;
const REGIONAL_DELIVERY = 2000;

function isTbilisi(city: string) {
  const value = city.trim().toLocaleLowerCase();
  return value === "tbilisi" || value === "თბილისი";
}

function legacyTestDeliveryPrice(subtotal: number, city: string) {
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return isTbilisi(city) ? TBILISI_DELIVERY : REGIONAL_DELIVERY;
}

export function Checkout({
  addresses,
  profile,
  shippingSettings,
  testCheckoutEnabled,
}: CheckoutProps) {
  const cart = useCart();
  const router = useRouter();
  const [testPending, startTestTransition] = useTransition();
  const [testMessage, setTestMessage] = useState("");
  const [orderPending, startOrderTransition] = useTransition();
  const [orderMessage, setOrderMessage] = useState("");
  const submitting = useRef(false);
  const checkoutRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const [promoPending, startPromoTransition] = useTransition();
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    subtotal: number;
  } | null>(null);
  const defaultAddress =
    addresses.find((address) => address.is_default) ?? addresses[0] ?? null;
  const [addressMode, setAddressMode] = useState<"saved" | "new">(
    defaultAddress ? "saved" : "new",
  );
  const [selectedAddressId, setSelectedAddressId] = useState(
    defaultAddress?.id ?? "",
  );
  const [draft, setDraft] = useState<DraftAddress>({
    recipient_name: profile.fullName,
    phone: profile.phone,
    city: "",
    address_line_1: "",
    address_line_2: "",
    postal_code: "",
  });

  const selectedAddress =
    addresses.find((address) => address.id === selectedAddressId) ?? null;

  const deliveryCity =
    addressMode === "saved" ? selectedAddress?.city ?? "" : draft.city;

  const shipping = useMemo(() => {
    if (!cart.quote.lines.length) return 0;
    if (testCheckoutEnabled) {
      return legacyTestDeliveryPrice(cart.quote.subtotal, deliveryCity);
    }
    if (
      shippingSettings.freeShippingThreshold !== null &&
      cart.quote.subtotal >= shippingSettings.freeShippingThreshold
    ) {
      return 0;
    }
    return shippingSettings.shippingTotal;
  }, [
    cart.quote.lines.length,
    cart.quote.subtotal,
    deliveryCity,
    shippingSettings.freeShippingThreshold,
    shippingSettings.shippingTotal,
    testCheckoutEnabled,
  ]);

  const promoIsCurrent =
    appliedPromo !== null && appliedPromo.subtotal === cart.quote.subtotal;
  const promoDiscount = promoIsCurrent ? appliedPromo.discount : 0;
  const activePromoCode = promoIsCurrent ? appliedPromo.code : null;
  const total = cart.quote.subtotal + shipping - promoDiscount;
  const unavailable = cart.quote.lines.some((line) => !line.available);
  const missingDelivery =
    addressMode === "saved"
      ? !selectedAddress
      : !draft.recipient_name.trim() ||
        !draft.phone.trim() ||
        !draft.city.trim() ||
        !draft.address_line_1.trim();

  const deliveryLabel = isTbilisi(deliveryCity)
    ? "Tbilisi delivery"
    : "Georgia regional delivery";
  const deliveryEstimate = isTbilisi(deliveryCity)
    ? "Estimated within 48 hours"
    : "Estimated within 7 days";

  const updateDraft = (key: keyof DraftAddress, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const activeAddress: DraftAddress | null =
    addressMode === "saved"
      ? selectedAddress
        ? {
            recipient_name: selectedAddress.recipient_name,
            phone: selectedAddress.phone,
            city: selectedAddress.city,
            address_line_1: selectedAddress.address_line_1,
            address_line_2: selectedAddress.address_line_2 ?? "",
            postal_code: selectedAddress.postal_code ?? "",
          }
        : null
      : draft;

  const canCreateTestOrder =
    testCheckoutEnabled &&
    cart.ready &&
    !cart.busy &&
    !cart.error &&
    !!cart.quote.lines.length &&
    !unavailable &&
    !missingDelivery &&
    !!activeAddress &&
    !testPending &&
    !promoPending;

  const canCreateUnpaidOrder =
    !testCheckoutEnabled &&
    cart.ready &&
    !cart.busy &&
    !cart.error &&
    !!cart.quote.lines.length &&
    !unavailable &&
    !missingDelivery &&
    !!activeAddress &&
    !orderPending &&
    !promoPending;

  const checkoutLines = () =>
    cart.quote.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
    }));

  const applyPromo = () => {
    if (promoPending || !cart.quote.lines.length) return;
    setPromoMessage("");
    startPromoTransition(async () => {
      const result = await quotePromo({
        code: promoInput,
        lines: checkoutLines(),
      });

      if (!result.ok) {
        setAppliedPromo(null);
        setPromoMessage(result.message);
        return;
      }

      setAppliedPromo({
        code: result.code,
        discount: result.discount,
        subtotal: result.subtotal,
      });
      setPromoInput(result.code);
      setPromoMessage(result.message);
    });
  };

  const runTestCheckout = () => {
    if (!canCreateTestOrder || !activeAddress) return;
    setTestMessage("");
    startTestTransition(async () => {
      const result = await createTestOrder({
        lines: checkoutLines(),
        address: activeAddress,
        promoCode: activePromoCode,
      });

      if (!result.ok) {
        setTestMessage(result.message);
        return;
      }

      cart.clear();
      router.push("/account/orders?test_order=created");
      router.refresh();
    });
  };

  const runUnpaidCheckout = () => {
    if (!canCreateUnpaidOrder || !activeAddress || submitting.current) return;
    submitting.current = true;
    setOrderMessage("");
    startOrderTransition(async () => {
      try {
        const input = { lines: checkoutLines(), address: activeAddress, promoCode: activePromoCode };
        // Store only a digest and random request ID, never delivery data or tokens.
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
        const fingerprint = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
        let request = checkoutRequest.current;
        try {
          const saved = JSON.parse(sessionStorage.getItem("kultura.checkout.request") ?? "null");
          if (saved?.fingerprint === fingerprint && typeof saved.id === "string") request = saved;
        } catch { /* Storage may be disabled; in-memory retries still reuse the ID. */ }
        if (!request || request.fingerprint !== fingerprint) request = { fingerprint, id: crypto.randomUUID() };
        checkoutRequest.current = request;
        try { sessionStorage.setItem("kultura.checkout.request", JSON.stringify(request)); } catch { /* Optional persistence. */ }
        const result = await createUnpaidOrder({ ...input, requestId: request.id });
        if (!result.ok || !result.orderId) {
          setOrderMessage(result.message || "The order could not be created.");
          return;
        }
        try { sessionStorage.removeItem("kultura.checkout.request"); } catch { /* Optional persistence. */ }
        cart.clear();
        router.push(`/order-confirmation/${result.orderId}`);
        router.refresh();
      } catch {
        setOrderMessage("We could not confirm your order. Your bag is saved; please try again.");
      } finally {
        submitting.current = false;
      }
    });
  };

  return (
    <div className="checkout-shell">
      <div className="checkout-main">
        <div className="checkout-progress" aria-label="Checkout progress">
          <span className="complete">01 BAG</span>
          <span className="active">02 DELIVERY</span>
          <span>03 PAYMENT</span>
        </div>

        <section className="checkout-section">
          <div className="checkout-section-heading">
            <div>
              <p className="eyebrow">CONTACT</p>
              <h2>YOUR DETAILS</h2>
            </div>
            <Link className="text-link" href="/account">
              EDIT ACCOUNT ↗
            </Link>
          </div>
          <div className="checkout-contact">
            <div>
              <span>EMAIL</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>NAME</span>
              <strong>{profile.fullName || "Not added"}</strong>
            </div>
            <div>
              <span>PHONE</span>
              <strong>{profile.phone || "Add below"}</strong>
            </div>
          </div>
        </section>

        <section className="checkout-section">
          <div className="checkout-section-heading">
            <div>
              <p className="eyebrow">DELIVERY</p>
              <h2>SHIPPING ADDRESS</h2>
            </div>
            <Link className="text-link" href="/account/addresses">
              MANAGE SAVED ADDRESSES ↗
            </Link>
          </div>

          {addresses.length ? (
            <div className="checkout-address-mode">
              <button
                type="button"
                className={addressMode === "saved" ? "active" : ""}
                onClick={() => setAddressMode("saved")}
              >
                SAVED ADDRESS
              </button>
              <button
                type="button"
                className={addressMode === "new" ? "active" : ""}
                onClick={() => setAddressMode("new")}
              >
                DIFFERENT ADDRESS
              </button>
            </div>
          ) : null}

          {addressMode === "saved" && addresses.length ? (
            <div className="checkout-address-list">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={
                    "checkout-address-card" +
                    (selectedAddressId === address.id ? " selected" : "")
                  }
                >
                  <input
                    type="radio"
                    name="checkout_saved_address"
                    value={address.id}
                    checked={selectedAddressId === address.id}
                    onChange={() => setSelectedAddressId(address.id)}
                  />
                  <span>
                    <strong>
                      {address.recipient_name}
                      {address.is_default ? " · DEFAULT" : ""}
                    </strong>
                    <small>{address.phone}</small>
                    <small>
                      {address.address_line_1}
                      {address.address_line_2
                        ? `, ${address.address_line_2}`
                        : ""}
                    </small>
                    <small>
                      {address.city}
                      {address.postal_code ? `, ${address.postal_code}` : ""}
                      {" · "}
                      {address.country_code}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="checkout-address-form">
              <label className="k-field">
                <span>RECIPIENT NAME</span>
                <input
                  value={draft.recipient_name}
                  onChange={(event) =>
                    updateDraft("recipient_name", event.target.value)
                  }
                  autoComplete="name"
                  maxLength={200}
                />
              </label>
              <label className="k-field">
                <span>PHONE</span>
                <input
                  value={draft.phone}
                  onChange={(event) => updateDraft("phone", event.target.value)}
                  autoComplete="tel"
                  maxLength={40}
                />
              </label>
              <label className="k-field checkout-country">
                <span>COUNTRY</span>
                <input value="Georgia (GE)" disabled />
              </label>
              <label className="k-field">
                <span>CITY</span>
                <input
                  value={draft.city}
                  onChange={(event) => updateDraft("city", event.target.value)}
                  autoComplete="address-level2"
                  maxLength={120}
                  placeholder="Tbilisi, Batumi, Kutaisi..."
                />
              </label>
              <label className="k-field checkout-address-wide">
                <span>ADDRESS LINE 1</span>
                <input
                  value={draft.address_line_1}
                  onChange={(event) =>
                    updateDraft("address_line_1", event.target.value)
                  }
                  autoComplete="address-line1"
                  maxLength={300}
                  placeholder="Street, building, apartment"
                />
              </label>
              <label className="k-field">
                <span>ADDRESS LINE 2 · OPTIONAL</span>
                <input
                  value={draft.address_line_2}
                  onChange={(event) =>
                    updateDraft("address_line_2", event.target.value)
                  }
                  autoComplete="address-line2"
                  maxLength={300}
                />
              </label>
              <label className="k-field">
                <span>POSTAL CODE · OPTIONAL</span>
                <input
                  value={draft.postal_code}
                  onChange={(event) =>
                    updateDraft("postal_code", event.target.value)
                  }
                  autoComplete="postal-code"
                  maxLength={30}
                />
              </label>
            </div>
          )}

          <div className="checkout-delivery-card">
            <div>
              <p className="eyebrow">STANDARD DELIVERY</p>
              <strong>{deliveryCity ? deliveryLabel : "Enter a city"}</strong>
              <small>
                {deliveryCity
                  ? deliveryEstimate
                  : "Delivery fee and estimate will update automatically."}
              </small>
            </div>
            <strong>
              {!deliveryCity
                ? "—"
                : shipping === 0
                  ? "FREE"
                  : money(shipping)}
            </strong>
          </div>

          <p className="muted checkout-free-shipping-note">
            {testCheckoutEnabled ? (
              <>
                Standard delivery is free from {money(FREE_DELIVERY_THRESHOLD)}.
                Tbilisi delivery is {money(TBILISI_DELIVERY)}; other regions of
                Georgia are {money(REGIONAL_DELIVERY)}.
              </>
            ) : shippingSettings.freeShippingThreshold !== null ? (
              <>
                Standard delivery is {money(shippingSettings.shippingTotal)} and
                becomes free from {money(shippingSettings.freeShippingThreshold)}.
              </>
            ) : shippingSettings.shippingTotal === 0 ? (
              <>Standard delivery is currently free.</>
            ) : (
              <>Standard delivery is {money(shippingSettings.shippingTotal)}.</>
            )}
          </p>
        </section>

        <section className="checkout-section checkout-payment-preview">
          <p className="eyebrow">PAYMENT</p>
          <h2>PAYMENT PENDING</h2>
          <label className="checkout-payment-option">
            <input type="radio" checked readOnly />
            <span>
              <strong>ONLINE CARD PAYMENT</strong>
              <small>
                The bank payment gateway is not connected yet. You can save a
                pending order without entering card details.
              </small>
            </span>
            <span>VISA · MC</span>
          </label>

          <div className="checkout-promo">
            <div>
              <p className="eyebrow">PROMO CODE</p>
              <span>Have a discount code? Apply it before placing the order.</span>
            </div>
            <div className="checkout-promo-row">
              <input
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                maxLength={50}
                autoComplete="off"
                placeholder="ENTER CODE"
                aria-label="Promo code"
              />
              <button
                type="button"
                className="button secondary"
                onClick={applyPromo}
                disabled={promoPending || !cart.quote.lines.length || !promoInput.trim()}
              >
                {promoPending ? "APPLYING…" : "APPLY"}
              </button>
            </div>
            {promoMessage ? (
              <p
                className={promoIsCurrent ? "form-success" : "form-error"}
                role={promoIsCurrent ? "status" : "alert"}
              >
                {promoMessage}
              </p>
            ) : null}
            {appliedPromo && !promoIsCurrent ? (
              <p className="form-error" role="status">
                Your bag changed. Apply the promo code again.
              </p>
            ) : null}
          </div>

          <p className="muted">
            No card details are collected and this action does not charge money.
            Payment status will remain PENDING until a verified payment gateway is connected.
          </p>
        </section>
      </div>

      <aside className="checkout-summary">
        <div className="checkout-summary-inner">
          <div className="checkout-summary-heading">
            <div>
              <p className="eyebrow">ORDER SUMMARY</p>
              <h2>YOUR BAG</h2>
            </div>
            <Link className="text-link" href="/cart">
              EDIT ↗
            </Link>
          </div>

          {!cart.ready ? <p>Loading your bag…</p> : null}
          {cart.error ? <p role="alert">{cart.error}</p> : null}

          {cart.ready && !cart.quote.lines.length ? (
            <div className="empty-state">
              <p>Your bag is empty.</p>
              <Link className="text-link" href="/shop">
                RETURN TO SHOP ↗
              </Link>
            </div>
          ) : null}

          <div className="checkout-items">
            {cart.quote.lines.map((line) => (
              <article className="checkout-item" key={line.variantId}>
                <div className="checkout-item-image">
                  <Image
                    src={line.image}
                    alt={line.name}
                    width={88}
                    height={108}
                  />
                  <span>{line.quantity}</span>
                </div>
                <div>
                  <strong>{line.name}</strong>
                  <small>
                    {line.color} / {line.size}
                  </small>
                  {line.notice ? <small>{line.notice}</small> : null}
                </div>
                <strong>{line.available ? money(line.lineTotal) : "—"}</strong>
              </article>
            ))}
          </div>

          {!!cart.quote.lines.length ? (
            <>
              <div className="checkout-totals">
                <div>
                  <span>SUBTOTAL</span>
                  <strong>{money(cart.quote.subtotal)}</strong>
                </div>
                <div>
                  <span>DELIVERY</span>
                  <strong>
                    {!deliveryCity
                      ? "—"
                      : shipping === 0
                        ? "FREE"
                        : money(shipping)}
                  </strong>
                </div>
                {promoIsCurrent ? (
                  <div className="checkout-discount-row">
                    <span>PROMO · {activePromoCode}</span>
                    <strong>−{money(promoDiscount)}</strong>
                  </div>
                ) : null}
                <div className="checkout-total-final">
                  <span>TOTAL</span>
                  <strong>
                    {deliveryCity
                      ? money(total)
                      : money(cart.quote.subtotal - promoDiscount)}
                  </strong>
                </div>
              </div>

              {unavailable ? (
                <p className="form-error">
                  Remove unavailable items from your bag before checkout.
                </p>
              ) : missingDelivery ? (
                <p className="muted">
                  Complete your delivery address to continue.
                </p>
              ) : null}

              {testCheckoutEnabled ? (
                <div className="checkout-test-mode">
                  <div className="checkout-test-mode-label">
                    <span>ADMIN TEST MODE</span>
                    <small>Creates a paid test order without charging money.</small>
                  </div>
                  <button
                    type="button"
                    className="button checkout-pay-button"
                    disabled={!canCreateTestOrder}
                    onClick={runTestCheckout}
                  >
                    {testPending ? "CREATING TEST ORDER…" : "CREATE TEST ORDER · NO CHARGE"}
                  </button>
                  {testMessage ? (
                    <p className="form-error" role="alert">{testMessage}</p>
                  ) : null}
                  <p className="checkout-secure-note">
                    TEST ONLY · INVENTORY IS NOT DECREMENTED · NO PAYMENT IS TAKEN
                  </p>
                </div>
              ) : (
                <div className="checkout-test-mode">
                  <div className="checkout-test-mode-label">
                    <span>PAYMENT GATEWAY PENDING</span>
                    <small>Saves this order with payment status PENDING. No money is charged.</small>
                  </div>
                  <button
                    type="button"
                    className="button checkout-pay-button"
                    disabled={!canCreateUnpaidOrder}
                    onClick={runUnpaidCheckout}
                  >
                    {orderPending ? "SAVING ORDER…" : "PLACE UNPAID ORDER"}
                  </button>
                  {orderMessage ? (
                    <p className="form-error" role="alert">{orderMessage}</p>
                  ) : null}
                  <p className="checkout-secure-note">
                    NO PAYMENT WILL BE TAKEN · PAYMENT STATUS WILL BE PENDING
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}