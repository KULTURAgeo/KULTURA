import Link from "next/link";
import { adminPromos } from "@/lib/admin/repository";
import { money } from "@/lib/catalog";

function value(kind: string, amount: number) {
  return kind === "percentage"
    ? (amount / 100).toFixed(2).replace(/\.00$/, "") + "%"
    : money(amount);
}

function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " UTC"
    : "—";
}

export default async function Promos({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = Math.floor(
    Math.max(1, Math.min(10000, Number(query.page) || 1)),
  );
  const { promos, hasNext, page } = await adminPromos(requestedPage);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">DISCOUNTS</p>
          <h1>PROMO CODES</h1>
        </div>
        <Link className="button" href="/admin/promos/new">
          NEW PROMO ↗
        </Link>
      </div>

      {!promos.length ? (
        <div className="empty-state">
          <h2>No promo codes yet.</h2>
          <p>Create a code to offer a fixed or percentage discount at checkout.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="k-table promo-table">
            <caption className="sr-only">Promo codes</caption>
            <thead>
              <tr>
                <th>CODE</th>
                <th>DISCOUNT</th>
                <th>MINIMUM</th>
                <th>USES</th>
                <th>WINDOW</th>
                <th>STATUS</th>
                <th>EDIT</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id}>
                  <td><strong>{promo.code}</strong></td>
                  <td>
                    {value(promo.kind, promo.amount)}
                    {promo.maximum_discount ? (
                      <small>Cap {money(promo.maximum_discount)}</small>
                    ) : null}
                  </td>
                  <td>{promo.minimum_subtotal ? money(promo.minimum_subtotal) : "NONE"}</td>
                  <td>
                    {promo.used_count}
                    {promo.max_uses ? " / " + promo.max_uses : " / ∞"}
                  </td>
                  <td>
                    <small>FROM {date(promo.starts_at)}</small>
                    <small>TO {date(promo.expires_at)}</small>
                  </td>
                  <td>
                    <span
                      className={
                        "status-badge " +
                        (promo.is_active ? "status-paid" : "status-cancelled")
                      }
                    >
                      {promo.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <Link href={"/admin/promos/" + promo.id}>Edit ↗</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="inline-links">
        {page > 1 ? (
          <Link href={"?page=" + (page - 1)}>Previous</Link>
        ) : null}
        {hasNext ? <Link href={"?page=" + (page + 1)}>Next</Link> : null}
      </nav>
    </>
  );
}
