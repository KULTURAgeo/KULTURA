import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ShowroomItemFields } from "@/components/admin/showroom-editor";
import { adminShowroom } from "./repository";
import { deleteShowroomItem, saveShowroomItem, saveShowroomSettings } from "./actions";

export const metadata = { title: "Home 3D showroom" };

export default async function ShowroomAdminPage() {
  const { status, settings, items, products, categories } = await adminShowroom();
  const productNames = new Map(products.map(product => [product.id, product.name]));
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">HOMEPAGE</p>
          <h1>3D SHOWROOM</h1>
        </div>
        <Link className="button secondary" href="/">VIEW HOMEPAGE ↗</Link>
      </div>

      {status === "not_installed" || !settings ? (
        <section className="panel">
          <h2>Showroom setup is pending.</h2>
          <p>Apply the homepage showroom migration to enable these controls.</p>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>DISPLAY MODE</h2>
            <ActionForm action={saveShowroomSettings} label="SAVE DISPLAY MODE">
              <input type="hidden" name="updated_at" value={settings.updated_at} />
              <label className="check-field">
                <input type="checkbox" name="use_custom_items" defaultChecked={settings.use_custom_items} />
                Show the cards I choose below
              </label>
              <p className="muted">
                {settings.use_custom_items
                  ? "Your visible cards appear in display order. An empty list hides the 3D section."
                  : "The homepage currently uses the automatic category display. Save your cards below, then enable this option."}
              </p>
            </ActionForm>
          </section>

          <section className="panel">
            <div className="section-heading">
              <h2>YOUR CARDS · {items.length} / 12</h2>
            </div>
            {items.length === 0 ? (
              <p className="muted">Add a product or category to start arranging your showroom.</p>
            ) : items.map(item => {
              const sourceName = item.source_kind === "product"
                ? productNames.get(item.product_id ?? "")
                : categoryNames.get(item.category_id ?? "");
              const name = item.title || sourceName || "Unavailable source";
              return (
                <details className="variant-editor" key={item.id}>
                  <summary>
                    {item.sort_position} · {name} · {item.is_active ? "VISIBLE" : "HIDDEN"}
                  </summary>
                  <ActionForm action={saveShowroomItem} label="SAVE CARD">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="updated_at" value={item.updated_at} />
                    <ShowroomItemFields key={item.updated_at} item={item} products={products} categories={categories} />
                  </ActionForm>
                  <ActionForm action={deleteShowroomItem} label="REMOVE FROM SHOWROOM"
                    confirm={`Remove “${name}” from the 3D showroom?`}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="updated_at" value={item.updated_at} />
                  </ActionForm>
                </details>
              );
            })}
          </section>

          {items.length < 12 && (
            <section className="panel">
              <h2>ADD CARD</h2>
              <ActionForm action={saveShowroomItem} label="ADD TO SHOWROOM">
                <ShowroomItemFields products={products} categories={categories} />
              </ActionForm>
            </section>
          )}
        </>
      )}
    </>
  );
}
