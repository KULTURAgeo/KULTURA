import { ActionForm, Field } from "@/components/action-form";
import { money } from "@/lib/catalog";
import { adminShippingSettings } from "@/lib/admin/shipping";
import { saveShippingSettings } from "./actions";

export const metadata = { title: "Shipping settings" };

export default async function ShippingSettingsPage() {
  const settings = await adminShippingSettings();
  const freeShippingEnabled = settings.freeShippingThreshold !== null;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CHECKOUT SETTINGS</p>
          <h1>SHIPPING</h1>
        </div>
      </div>

      <div className="stat-grid">
        <div className="panel">
          <span className="eyebrow">STANDARD DELIVERY</span>
          <strong>{money(settings.shippingTotal)}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">FREE SHIPPING</span>
          <strong>
            {freeShippingEnabled
              ? `FROM ${money(settings.freeShippingThreshold ?? 0)}`
              : "DISABLED"}
          </strong>
        </div>
      </div>

      <section className="panel">
        <p className="eyebrow">DELIVERY PRICING</p>
        <h2>CHECKOUT SHIPPING RULES</h2>
        <p className="muted">
          These values are used by the customer checkout and are revalidated on
          the server when an order is created. Amounts are in GEL.
        </p>

        <ActionForm action={saveShippingSettings} label="SAVE SHIPPING SETTINGS">
          <div className="form-grid">
            <Field
              label="STANDARD DELIVERY · GEL"
              name="shipping_total"
              type="number"
              min={0}
              max={10000}
              step="0.01"
              required
              defaultValue={(settings.shippingTotal / 100).toFixed(2)}
            />
            <Field
              label="FREE SHIPPING FROM · GEL"
              name="free_shipping_threshold"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                settings.freeShippingThreshold === null
                  ? ""
                  : (settings.freeShippingThreshold / 100).toFixed(2)
              }
            />
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              name="free_shipping_enabled"
              defaultChecked={freeShippingEnabled}
            />
            Enable free shipping threshold
          </label>
          <p className="muted">
            Set delivery to 0 GEL for free shipping on every order. Disable the
            threshold if you do not want order value to change the delivery fee.
          </p>
        </ActionForm>
      </section>
    </>
  );
}
