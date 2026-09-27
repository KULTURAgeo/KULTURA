"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { money } from "@/lib/catalog";
import type { Database } from "@/lib/supabase/database.types";

type Address = Database["public"]["Tables"]["addresses"]["Row"];

type CheckoutProps = {
  addresses: Address[];
  profile: {
    fullName: string;
    phone: string;
    email: string;
  };
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

function deliveryPrice(subtotal: number, city: string) {
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return isTbilisi(city) ? TBILISI_DELIVERY : REGIONAL_DELIVERY;
}

export function Checkout({
  addresses,
  profile,
}: CheckoutProps) {
  const cart = useCart();
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

  const shipping = useMemo(
    () =>
      cart.quote.lines.length
        ? deliveryPrice(cart.quote.subtotal, deliveryCity)
        : 0,
    [cart.quote.lines.length, cart.quote.subtotal, deliveryCity],
  );

  const total = cart.quote.subtotal + shipping;
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
              {cart.quote.subtotal >= FREE_DELIVERY_THRESHOLD
                ? "FREE"
                : deliveryCity
                  ? money(shipping)
                  : "—"}
            </strong>
          </div>

          <p className="muted checkout-free-shipping-note">
            Standard delivery is free from {money(FREE_DELIVERY_THRESHOLD)}.
            Tbilisi delivery is {money(TBILISI_DELIVERY)}; other regions of
            Georgia are {money(REGIONAL_DELIVERY)}.
          </p>
        </section>

        <section className="checkout-section checkout-payment-preview">
          <p className="eyebrow">PAYMENT</p>
          <h2>PAY SECURELY</h2>
          <label className="checkout-payment-option">
            <input type="radio" checked readOnly />
            <span>
              <strong>ONLINE CARD PAYMENT</strong>
              <small>
                Secure bank payment will open here when the payment gateway is
                activated.
              </small>
            </span>
            <span>VISA · MC</span>
          </label>
          <p className="muted">
            KULTURA will not store your full card number. Payment status will be
            confirmed by the connected payment provider when checkout goes
            live.
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
                <div className="checkout-total-final">
                  <span>TOTAL</span>
                  <strong>
                    {deliveryCity ? money(total) : money(cart.quote.subtotal)}
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

              <button
                type="button"
                className="button checkout-pay-button"
                disabled
              >
                PAYMENT CONNECTION PENDING
              </button>
              <p className="checkout-secure-note">
                CHECKOUT PREVIEW · NO PAYMENT WILL BE TAKEN
              </p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
