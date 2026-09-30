import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { adminReturnRequest } from "@/lib/admin/returns";
import { UUID } from "@/lib/validation";
import { updateReturnRequest } from "../actions";

function label(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function allowedStatuses(current: string) {
  switch (current) {
    case "requested":
      return ["requested", "under_review", "approved", "rejected"];
    case "under_review":
      return ["under_review", "approved", "rejected"];
    case "approved":
      return ["approved", "resolved"];
    case "rejected":
      return ["rejected"];
    case "resolved":
      return ["resolved"];
    default:
      return [current];
  }
}

export default async function ReturnRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const request = await adminReturnRequest(id);
  if (!request) notFound();

  const amount = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: request.order.currency,
    }).format(value / 100);

  const requestedUnits = request.items.reduce((sum, item) => sum + item.quantity, 0);
  const statuses = allowedStatuses(request.status);

  return (
    <>
      <div className="admin-order-detail-top">
        <div>
          <Link className="text-link" href="/admin/returns">← ALL RETURNS</Link>
          <p className="eyebrow">RETURN / REFUND REQUEST</p>
          <h1>{label(request.request_type)}</h1>
          <p className="muted">
            Submitted {new Date(request.created_at).toLocaleString("en-GB", {
              timeZone: "UTC",
              dateStyle: "medium",
              timeStyle: "short",
            })} UTC
          </p>
        </div>
        <div className="admin-order-status-stack">
          <span className="badge">REQUEST · {label(request.status)}</span>
          <span className={`status-badge status-${request.order.payment_status.replaceAll("_", "-")}`}>
            PAYMENT · {label(request.order.payment_status)}
          </span>
        </div>
      </div>

      <div className="stat-grid order-detail-stats">
        <div className="panel">
          <span className="eyebrow">ORDER</span>
          <strong className="stat-word">{request.order.order_number}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">REQUESTED UNITS</span>
          <strong>{requestedUnits}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">ORDER TOTAL</span>
          <strong>{amount(request.order.final_total)}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">STATUS</span>
          <strong className="stat-word">{label(request.status)}</strong>
        </div>
      </div>

      <div className="admin-order-detail-grid">
        <section className="panel">
          <p className="eyebrow">CUSTOMER</p>
          <h2>{request.order.delivery_name}</h2>
          <dl className="order-data-list">
            <div><dt>EMAIL</dt><dd>{request.order.customer_email}</dd></div>
            <div><dt>PHONE</dt><dd>{request.order.delivery_phone}</dd></div>
            <div><dt>REQUEST TYPE</dt><dd>{label(request.request_type)}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <p className="eyebrow">REQUEST DETAILS</p>
          <h2>{label(request.reason)}</h2>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {request.details || "No additional details provided."}
          </p>
        </section>

        <section className="panel">
          <p className="eyebrow">ORDER STATUS</p>
          <dl className="order-data-list">
            <div><dt>PAYMENT</dt><dd>{label(request.order.payment_status)}</dd></div>
            <div><dt>FULFILLMENT</dt><dd>{label(request.order.fulfillment_status)}</dd></div>
            <div><dt>TEST ORDER</dt><dd>{request.order.is_test ? "YES" : "NO"}</dd></div>
          </dl>
          <Link className="text-link" href={`/admin/orders/${request.order.id}`}>OPEN ORDER →</Link>
        </section>

        <section className="panel">
          <p className="eyebrow">REQUEST INFO</p>
          <dl className="order-data-list">
            <div><dt>REQUEST ID</dt><dd>{request.id}</dd></div>
            <div><dt>CREATED</dt><dd>{new Date(request.created_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd></div>
            <div><dt>UPDATED</dt><dd>{new Date(request.updated_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel admin-order-items">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">REQUESTED ITEMS</p>
            <h2>{requestedUnits} UNIT{requestedUnits === 1 ? "" : "S"}</h2>
          </div>
          <p className="muted">Quantities are validated against the original order before the request is created.</p>
        </div>
        <div className="table-scroll">
          <table className="k-table">
            <caption className="sr-only">Items requested for return or refund</caption>
            <thead>
              <tr>
                <th>ITEM</th>
                <th>VARIANT / SKU</th>
                <th>ORDERED</th>
                <th>REQUESTED</th>
                <th>UNIT PRICE</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((entry) => (
                <tr key={entry.order_item_id}>
                  <td><strong>{entry.order_item?.product_name ?? "Item unavailable"}</strong></td>
                  <td>
                    {entry.order_item ? `${entry.order_item.color} / ${entry.order_item.size}` : "—"}
                    {entry.order_item ? <small>{entry.order_item.sku}</small> : null}
                  </td>
                  <td>{entry.order_item?.quantity ?? "—"}</td>
                  <td><strong>{entry.quantity}</strong></td>
                  <td>{entry.order_item ? amount(entry.order_item.unit_price) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel admin-order-status-control">
        <div>
          <p className="eyebrow">REQUEST CONTROL</p>
          <h2>{label(request.status)}</h2>
          <p className="muted">
            Review the request and move it forward. APPROVED only approves the customer-care request; it does not refund money, change payment status or change fulfillment automatically.
          </p>
        </div>

        <ActionForm action={updateReturnRequest} label="SAVE REQUEST" className="fulfillment-action">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="updated_at" value={request.updated_at} />
          <label className="k-field">
            <span>STATUS</span>
            <select name="status" defaultValue={request.status}>
              {statuses.map((status) => (
                <option value={status} key={status}>{label(status)}</option>
              ))}
            </select>
          </label>
          <label className="k-field">
            <span>CUSTOMER RESPONSE / ADMIN NOTE</span>
            <textarea
              name="admin_note"
              maxLength={2000}
              rows={5}
              defaultValue={request.admin_note}
              placeholder="Optional note shown to the customer on their order page."
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 130,
                border: "1px solid #444",
                padding: 14,
                background: "#121212",
                color: "#eee",
                borderRadius: 0,
                font: "inherit",
              }}
            />
          </label>
        </ActionForm>
      </section>
    </>
  );
}
