import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { requirePage } from "@/lib/auth/guards";
import { dropTimeInput } from "@/lib/drops";
import { isDropOpenForAlerts } from "@/lib/drops-repository";
import { dropAlertDeliveryConfigured } from "@/lib/notifications/drop-alerts";
import { UUID } from "@/lib/validation";
import { changeReleaseProduct, saveRelease, sendReleaseAlerts } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Drops" };

export default async function AdminDrops({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [{ client }, { edit }] = await Promise.all([requirePage(true), searchParams]);
  const editId = typeof edit === "string" && UUID.test(edit) ? edit : null;
  const [list, selected] = await Promise.all([
    client.from("drop_releases").select("*").order("launches_at", { ascending: false }).order("id").limit(40),
    editId ? client.from("drop_releases").select("*").eq("id", editId).maybeSingle() : null,
  ]);
  if (list.error || selected?.error) throw new Error("Drops unavailable.");
  const active = selected?.data;
  const [options, linked] = await Promise.all([
    active ? client.from("products").select("id,name,status").neq("status", "archived").order("name").order("id").limit(500) : null,
    active ? client.from("drop_release_products").select("product_id,products(name)").eq("release_id", active.id) : null,
  ]);
  if (options?.error || linked?.error) throw new Error("Drop products unavailable.");
  const assigned = new Set(linked?.data?.map(row => row.product_id));
  const candidates = options?.data?.filter(product => !assigned.has(product.id)) ?? [];
  const readyToSend = active && isDropOpenForAlerts(active);

  return (
    <>
      <div className="section-heading"><h1>DROPS</h1><Link className="button secondary" href="/drops">VIEW DROPS ↗</Link></div>
      <section className="panel">
        <h2>RELEASES</h2>
        {!list.data.length && <p className="muted">No drops scheduled yet.</p>}
        {list.data.map(row => <p key={row.id}><Link href={`/admin/drops?edit=${row.id}`}>
          {row.title} · {row.archived ? "Archived" : row.published ? "Published" : "Draft"} · {dropTimeInput(row.launches_at).replace("T", " ")}
        </Link></p>)}
        {active && <Link href="/admin/drops">ADD A NEW DROP ↗</Link>}
      </section>
      <section className="panel" key={active?.updated_at ?? "new"}>
        <h2>{active ? "EDIT DROP" : "ADD DROP"}</h2>
        <ActionForm action={saveRelease} label="SAVE DROP">
          {active && <>
            <input type="hidden" name="release_id" value={active.id} />
            <input type="hidden" name="updated_at" value={active.updated_at} />
          </>}
          <div className="form-grid">
            <Field label="TITLE · ENGLISH" name="title" defaultValue={active?.title} maxLength={120} required />
            <Field label="TITLE · ქართული" name="title_ka" defaultValue={active?.title_ka} maxLength={120} />
          </div>
          <div className="form-grid">
            <Field label="LAUNCH DATE AND TIME · TBILISI (UTC+4)" name="launches_at" type="datetime-local"
              defaultValue={active ? dropTimeInput(active.launches_at) : undefined} required />
          </div>
          <label className="check-field"><input type="checkbox" name="published" defaultChecked={active?.published} /> Show on Drops page</label>
          {active && <label className="check-field"><input type="checkbox" name="archived" defaultChecked={active.archived} /> Archive release</label>}
        </ActionForm>
      </section>
      {active && <section className="panel">
        <h2>PRODUCTS IN THIS DROP</h2>
        {linked?.data?.map(row => <ActionForm key={row.product_id} action={changeReleaseProduct} label="REMOVE FROM DROP">
          <p>{row.products?.name}</p>
          <input type="hidden" name="release_id" value={active.id} />
          <input type="hidden" name="product_id" value={row.product_id} />
          <input type="hidden" name="mode" value="remove" />
        </ActionForm>)}
        {candidates.length > 0 && <ActionForm action={changeReleaseProduct} label="ADD PRODUCT">
          <input type="hidden" name="release_id" value={active.id} />
          <input type="hidden" name="mode" value="add" />
          <label className="k-field"><span>PRODUCT</span><select name="product_id" defaultValue="" required>
            <option value="" disabled>Choose a product</option>
            {candidates.map(product => <option key={product.id} value={product.id}>{product.name} · {product.status}</option>)}
          </select></label>
        </ActionForm>}
      </section>}
      {active && <section className="panel">
        <h2>LAUNCH EMAILS</h2>
        {!dropAlertDeliveryConfigured() ? <p>Alert requests are saved. A verified email sender is required before they can be sent.</p>
          : readyToSend ? <ActionForm action={sendReleaseAlerts} label="SEND NEXT BATCH">
            <input type="hidden" name="release_id" value={active.id} />
            <p>Send up to four one-time emails to customers who opted in for this drop.</p>
          </ActionForm> : <p>Sending opens after the published release time.</p>}
      </section>}
    </>
  );
}
