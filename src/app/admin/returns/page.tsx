import Link from "next/link";
import {
  ADMIN_RETURN_STATUSES,
  ADMIN_RETURN_TYPES,
  adminReturnRequests,
  adminReturnStats,
} from "@/lib/admin/returns";

function label(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function returnsHref({ page, status, type }: { page: number; status: string; type: string }) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const query = params.toString();
  return query ? `/admin/returns?${query}` : "/admin/returns";
}

export default async function Returns({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; type?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const status = query.status ?? "";
  const type = query.type ?? "";

  const [stats, result] = await Promise.all([
    adminReturnStats(),
    adminReturnRequests({ page: requestedPage, status, type }),
  ]);

  const { requests, count, page } = result;
  const first = count ? (page - 1) * 25 + 1 : 0;
  const last = Math.min(page * 25, count);

  return (
    <>
      <div className="admin-order-heading">
        <div>
          <p className="eyebrow">CUSTOMER CARE / OPERATIONS</p>
          <h1>RETURNS</h1>
          <p className="muted">
            Review customer return and refund requests. Approval here does not send money or change payment status.
          </p>
        </div>
        <div className="admin-order-count">
          <span>SHOWING</span>
          <strong>{first}–{last}</strong>
          <small>OF {count}</small>
        </div>
      </div>

      <div className="stat-grid order-stat-grid">
        <div className="panel">
          <span className="eyebrow">TOTAL REQUESTS</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">NEW</span>
          <strong>{stats.requested}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">UNDER REVIEW</span>
          <strong>{stats.underReview}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">APPROVED / OPEN</span>
          <strong>{stats.approved}</strong>
        </div>
      </div>

      <form className="admin-order-filters" method="get">
        <label className="k-field">
          <span>STATUS</span>
          <select name="status" defaultValue={status}>
            <option value="">ALL STATUS</option>
            {ADMIN_RETURN_STATUSES.map((value) => (
              <option value={value} key={value}>{label(value)}</option>
            ))}
          </select>
        </label>

        <label className="k-field">
          <span>TYPE</span>
          <select name="type" defaultValue={type}>
            <option value="">ALL TYPES</option>
            {ADMIN_RETURN_TYPES.map((value) => (
              <option value={value} key={value}>{label(value)}</option>
            ))}
          </select>
        </label>

        <div className="admin-order-filter-actions">
          <button className="button" type="submit">APPLY FILTERS</button>
          <Link className="button secondary" href="/admin/returns">CLEAR</Link>
        </div>
      </form>

      <section className="panel admin-orders-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">REQUEST QUEUE</p>
            <h2>{count ? `${count} REQUEST${count === 1 ? "" : "S"}` : "NO REQUESTS"}</h2>
          </div>
          <p className="muted">Open a request to review selected items, customer notes and workflow controls.</p>
        </div>

        {requests.length ? (
          <div className="table-scroll">
            <table className="k-table">
              <caption className="sr-only">Return and refund requests</caption>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>CUSTOMER</th>
                  <th>TYPE</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.order?.order_number ?? "ORDER UNAVAILABLE"}</strong>
                      {request.order ? <small>{request.order.delivery_name}</small> : null}
                    </td>
                    <td>{request.order?.customer_email ?? "—"}</td>
                    <td>{label(request.request_type)}</td>
                    <td>{label(request.reason)}</td>
                    <td><span className="badge">{label(request.status)}</span></td>
                    <td>{new Date(request.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</td>
                    <td><Link className="text-link" href={`/admin/returns/${request.id}`}>REVIEW →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No return/refund requests match these filters.</p>
        )}
      </section>

      <nav className="admin-pagination" aria-label="Returns pagination">
        {page > 1 ? (
          <Link className="button secondary" href={returnsHref({ page: page - 1, status, type })}>
            ← PREVIOUS
          </Link>
        ) : <span />}
        <span>PAGE {page}</span>
        {page * 25 < count ? (
          <Link className="button secondary" href={returnsHref({ page: page + 1, status, type })}>
            NEXT →
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}
