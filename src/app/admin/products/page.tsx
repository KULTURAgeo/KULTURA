import Link from "next/link";
import { adminProducts } from "@/lib/admin/repository";
import { money } from "@/lib/catalog";

export default async function Products({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = Math.floor(
    Math.max(1, Math.min(10000, Number(query.page) || 1)),
  );
  const { products, hasNext, page } = await adminProducts(requestedPage);

  return (
    <>
      <div className="section-heading">
        <h1>PRODUCTS</h1>
        <Link className="button" href="/admin/products/new">NEW PRODUCT ↗</Link>
      </div>
      {!products.length ? (
        <div className="empty-state">No products here yet. Create your first piece.</div>
      ) : (
        <div className="table-scroll">
          <table className="k-table">
            <caption className="sr-only">Products</caption>
            <thead><tr><th>PRODUCT</th><th>STATUS</th><th>PRICE</th><th>EDIT</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}<small>{product.slug}</small></td>
                  <td>{product.status}</td>
                  <td>{money(product.price)}</td>
                  <td><Link href={`/admin/products/${product.id}`}>Edit ↗</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="inline-links">
        {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
        {hasNext ? <Link href={`?page=${page + 1}`}>Next</Link> : null}
      </nav>
    </>
  );
}
