import { notFound } from "next/navigation";
import { PromoEditor } from "@/components/admin/promo-editor";
import { adminPromo } from "@/lib/admin/repository";
import { UUID } from "@/lib/validation";

export default async function EditPromo({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const promo = await adminPromo(id);
  if (!promo) notFound();

  return (
    <>
      <p className="eyebrow">DISCOUNTS</p>
      <h1>EDIT PROMO</h1>
      <p className="muted">{promo.code}</p>
      <PromoEditor promo={promo} />
    </>
  );
}
