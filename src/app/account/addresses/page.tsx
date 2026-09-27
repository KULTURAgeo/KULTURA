import { requirePage } from "@/lib/auth/guards";
import { ActionForm, Field } from "@/components/action-form";
import { saveAddress, deleteAddress } from "../actions";
import type { Database } from "@/lib/supabase/database.types";
type Address = Database["public"]["Tables"]["addresses"]["Row"];
function AddressFields({ address }: {
    address?: Address;
}) { return <>{address && <input type="hidden" name="id" value={address.id}/>}<div className="form-grid"><Field label="RECIPIENT" name="recipient_name" defaultValue={address?.recipient_name} required maxLength={200} autoComplete="name"/><Field label="PHONE" name="phone" defaultValue={address?.phone} required maxLength={40} autoComplete="tel"/><Field label="COUNTRY CODE" name="country_code" defaultValue={address?.country_code ?? "GE"} required maxLength={2} autoComplete="country"/><Field label="CITY" name="city" defaultValue={address?.city} required maxLength={120} autoComplete="address-level2"/><Field label="ADDRESS LINE 1" name="address_line_1" defaultValue={address?.address_line_1} required maxLength={300} autoComplete="address-line1"/><Field label="ADDRESS LINE 2" name="address_line_2" defaultValue={address?.address_line_2 ?? ""} maxLength={300} autoComplete="address-line2"/><Field label="POSTAL CODE" name="postal_code" defaultValue={address?.postal_code ?? ""} maxLength={30} autoComplete="postal-code"/></div><label className="check-field"><input type="checkbox" name="is_default" defaultChecked={address?.is_default}/>Default address</label></>; }
export default async function Addresses() {
    const { client, user } = await requirePage();
    const { data, error } = await client.from("addresses").select("*").eq("profile_id", user.id).order("created_at");
    return <section><h1>YOUR ADDRESSES</h1>{error ? <p role="alert">Addresses are temporarily unavailable.</p> : <>{!data.length && <p className="muted">No saved addresses yet.</p>}<div className="address-list">{data.map(a => <section className="panel" key={a.id}><h2>{a.is_default ? "DEFAULT ADDRESS" : "SAVED ADDRESS"}</h2><ActionForm action={saveAddress} label="SAVE ADDRESS"><AddressFields address={a}/></ActionForm><ActionForm action={deleteAddress} label="REMOVE ADDRESS" confirm="Remove this saved address?"><input type="hidden" name="id" value={a.id}/></ActionForm></section>)}</div></>}<section className="panel"><h2>ADD ADDRESS</h2><ActionForm action={saveAddress} label="ADD ADDRESS"><AddressFields /></ActionForm></section></section>;
}
