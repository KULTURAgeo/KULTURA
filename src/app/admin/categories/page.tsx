import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { adminCategories } from "./repository";
import { saveCategory } from "./actions";

type Category = Awaited<ReturnType<typeof adminCategories>>[number];

function CategoryFields({ category }: { category?: Category }) {
  return (
    <>
      <div className="form-grid">
        <Field
          label="NAME"
          name="name"
          defaultValue={category?.name}
          required
          maxLength={120}
        />
        <Field
          label="SLUG"
          name="slug"
          defaultValue={category?.slug}
          required
          maxLength={120}
        />
        <Field
          label="SORT POSITION"
          name="sort_position"
          type="number"
          defaultValue={category?.sort_position ?? 0}
          required
          min={0}
          max={1000000}
          step="1"
        />
      </div>
      <label className="k-field">
        <span>DESCRIPTION</span>
        <textarea
          name="description"
          defaultValue={category?.description ?? ""}
          maxLength={10000}
          rows={4}
        />
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={category?.is_active ?? true}
        />
        Active in the store
      </label>
    </>
  );
}

export default async function CategoriesAdmin() {
  const categories = await adminCategories();

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CATALOG STRUCTURE</p>
          <h1>CATEGORIES</h1>
        </div>
        <Link className="button secondary" href="/shop">
          VIEW SHOP ↗
        </Link>
      </div>

      <section className="panel">
        <h2>NEW CATEGORY</h2>
        <p className="muted">
          Create the sections customers see first when they open Shop.
        </p>
        <ActionForm action={saveCategory} label="CREATE CATEGORY">
          <CategoryFields />
        </ActionForm>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CURRENT STRUCTURE</p>
            <h2>{categories.length} CATEGORIES</h2>
          </div>
        </div>

        {!categories.length ? (
          <div className="empty-state">
            <h2>No categories yet.</h2>
            <p>Create your first category above. It will then be available in the product editor.</p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="k-table">
                <caption className="sr-only">Product categories</caption>
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>NAME</th>
                    <th>SLUG</th>
                    <th>STATUS</th>
                    <th>STORE</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.sort_position}</td>
                      <td><strong>{category.name}</strong></td>
                      <td>{category.slug}</td>
                      <td>
                        <span
                          className={
                            "status-badge " +
                            (category.is_active ? "status-paid" : "status-cancelled")
                          }
                        >
                          {category.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        {category.is_active ? (
                          <Link href={"/shop/" + category.slug}>View ↗</Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              {categories.map((category) => (
                <details className="variant-editor" key={category.id}>
                  <summary>
                    Edit {category.name} · {category.is_active ? "ACTIVE" : "INACTIVE"}
                  </summary>
                  <ActionForm action={saveCategory} label="SAVE CATEGORY">
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      type="hidden"
                      name="updated_at"
                      value={category.updated_at}
                    />
                    <CategoryFields category={category} />
                  </ActionForm>
                </details>
              ))}
            </div>
          </>
        )}

        <p className="muted">
          Categories are not deleted because products keep a permanent category reference. Turn a category inactive to hide it from the store.
        </p>
      </section>
    </>
  );
}
