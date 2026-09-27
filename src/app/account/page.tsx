import { requirePage } from "@/lib/auth/guards";
import { ActionForm, Field } from "@/components/action-form";
import { updateProfile } from "./actions";
export default async function AccountPage() {
    const { user, profile } = await requirePage();
    return <section className="account-section"><h1>YOUR PROFILE</h1><p className="muted">{user.email}</p><ActionForm action={updateProfile} label="SAVE PROFILE"><Field label="NAME" name="full_name" defaultValue={profile.full_name} maxLength={200} autoComplete="name"/><Field label="PHONE" name="phone" defaultValue={profile.phone ?? ""} maxLength={40} autoComplete="tel"/></ActionForm></section>;
}
