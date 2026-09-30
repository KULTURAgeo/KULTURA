import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import {
  adminInventory,
  adminInventoryStats,
  inventoryFilter,
  type InventoryFilter,
} from "@/lib/admin/inventory";
import { saveInventoryStock } from "./actions";

export const metadata = { title: "Inventory" };

const FILTER_LABELS: Record<InventoryFilter, string> = {
  all: "ALL",
  low: "LOW STOCK",
  out: "SOLD OUT",
  "in-stock": "IN STOCK",
  inactive: "INACTIVE",
};

function inventoryStatus(stock: number, active: boolean) {
  if (!active) return "INACTIVE";
  if (stock === 0) return "SOLD OUT";
  if (stock <= 5) return "LOW STOCK";
  return "IN STOCK";
}

function filterHref(filter: InventoryFilter) {
  return filter === "all" ? "/admin/inventory" : `/admin/inventory?filter=${filter}`;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const query = await searchParams;
  const filter = inventoryFilter(query.filter);
  const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const [stats, inventory] = await Promise.all([
    adminInventoryStats(),
    adminInventory(filter, page),
  ]);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    params.set("page", String(nextPage));
    return `/admin/inventory?${params.toString()}`;
  };

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CATALOG / STOCK CONTROL</p>
          <h1>INVENTORY</h1>
          <p className="muted">
            Update stock by size and color. Setting a variant to 0 makes it unavailable in the store.
          </p>
        </div>
        <Link className="button secondary" href="/admin/products">
          PRODUCTS ↗
        </Link>
      </div>

      <div className="stat-grid">
        <div className="panel">
          <span className="eyebrow">VARIANTS</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">LOW STOCK · 1–5</span>
          <strong>{stats.low}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">SOLD OUT</span>
          <strong>{stats.out}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">INACTIVE</span>
          <strong>{stats.inactive}</strong>
        </div>
      </div>

      <nav className="inline-links" aria-label="Inventory filters">
        {(Object.keys(FILTER_LABELS) as InventoryFilter[]).map((value) => (
          <Link
            key={value}
            href={filterHref(value)}
            aria-current={filter === value ? "page" : undefined}
          >
            {FILTER_LABELS[value]}
          </Link>
        ))}
      </nav>

      {!inventory.variants.length ? (
        <div className="empty-state">No inventory rows match this filter.</div>
      ) : (
        <div className="table-scroll">
          <table className="k-table">
            <caption className="sr-only">Product inventory</caption>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>VARIANT</th>
                <th>SKU</th>
                <th>STATUS</th>
                <th>STOCK</th>
              </tr>
            </thead>
            <tbody>
              {inventory.variants.map((variant) => {
                const product = Array.isArray(variant.products)
                  ? variant.products[0]
                  : variant.products;
                return (
                  <tr key={variant.id}>
                    <td>
                      <strong>{product?.name ?? "Product"}</strong>
                      <small>{product?.status?.toUpperCase() ?? ""}</small>
                      {product ? (
                        <Link href={`/admin/products/${product.id}`}>Edit product ↗</Link>
                      ) : null}
                    </td>
                    <td>
                      {variant.color} / {variant.size}
                    </td>
                    <td>{variant.sku}</td>
                    <td>{inventoryStatus(variant.stock_quantity, variant.is_active)}</td>
                    <td>
                      <ActionForm action={saveInventoryStock} label="SAVE STOCK">
                        <input type="hidden" name="variant_id" value={variant.id} />
                        <input type="hidden" name="product_id" value={variant.product_id} />
                        <input type="hidden" name="updated_at" value={variant.updated_at} />
                        <Field
                          label="QUANTITY"
                          name="stock_quantity"
                          type="number"
                          defaultValue={variant.stock_quantity}
                          min={0}
                          max={1000000}
                          step="1"
                          required
                        />
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav className="inline-links" aria-label="Inventory pagination">
        {inventory.page > 1 ? <Link href={pageHref(inventory.page - 1)}>Previous</Link> : null}
        {inventory.page * 50 < inventory.count ? (
          <Link href={pageHref(inventory.page + 1)}>Next</Link>
        ) : null}
      </nav>
    </>
  );
}
