import type { Database } from "@/lib/supabase/database.types";
import { ActionForm, Field } from "@/components/action-form";
import { savePromo } from "@/app/admin/actions";

type Promo = Database["public"]["Tables"]["promo_codes"]["Row"];

function decimal(value: number) {
  return (value / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function utcInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function PromoEditor({ promo }: { promo?: Promo }) {
  return (
    <div className="promo-editor">
      <ActionForm
        action={savePromo}
        label={promo ? "SAVE PROMO CODE" : "CREATE PROMO CODE"}
      >
        {promo ? (
          <>
            <input type="hidden" name="id" value={promo.id} />
            <input type="hidden" name="updated_at" value={promo.updated_at} />
          </>
        ) : null}

        <div className="form-grid">
          <Field
            label="PROMO CODE"
            name="code"
            defaultValue={promo?.code ?? ""}
            required
            maxLength={50}
            autoComplete="off"
          />

          <label className="k-field">
            <span>DISCOUNT TYPE</span>
            <select name="kind" defaultValue={promo?.kind ?? "percentage"}>
              <option value="percentage">PERCENTAGE (%)</option>
              <option value="fixed">FIXED AMOUNT (GEL)</option>
            </select>
          </label>

          <Field
            label="DISCOUNT AMOUNT · ENTER 10 FOR 10% OR GEL 10"
            name="amount"
            defaultValue={promo ? decimal(promo.amount) : ""}
            type="number"
            required
            min={0.01}
            step="0.01"
          />

          <Field
            label="MINIMUM MERCHANDISE SUBTOTAL · GEL"
            name="minimum_subtotal"
            defaultValue={promo ? decimal(promo.minimum_subtotal) : "0"}
            type="number"
            min={0}
            step="0.01"
          />

          <Field
            label="MAXIMUM DISCOUNT · GEL · OPTIONAL"
            name="maximum_discount"
            defaultValue={promo?.maximum_discount ? decimal(promo.maximum_discount) : ""}
            type="number"
            min={0.01}
            step="0.01"
          />

          <Field
            label="MAXIMUM USES · OPTIONAL"
            name="max_uses"
            defaultValue={promo?.max_uses ?? ""}
            type="number"
            min={1}
            step="1"
          />

          <Field
            label="STARTS AT · UTC · OPTIONAL"
            name="starts_at"
            defaultValue={utcInput(promo?.starts_at ?? null)}
            type="datetime-local"
          />

          <Field
            label="EXPIRES AT · UTC · OPTIONAL"
            name="expires_at"
            defaultValue={utcInput(promo?.expires_at ?? null)}
            type="datetime-local"
          />
        </div>

        <label className="check-field">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={promo?.is_active ?? true}
          />
          ACTIVE — customers can apply this code
        </label>

        {promo ? (
          <div className="promo-editor-meta">
            <span>USED {promo.used_count} TIMES</span>
            <span>CREATED {new Date(promo.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</span>
          </div>
        ) : null}

        <p className="muted">
          Percentage discounts apply to the merchandise subtotal only. Delivery is calculated separately.
          Test checkout orders do not consume the promo usage limit.
        </p>
      </ActionForm>
    </div>
  );
}
