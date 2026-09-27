import Link from "next/link";
import { notFound } from "next/navigation";
import { adminOrder } from "@/lib/admin/repository";
import { UUID } from "@/lib/validation";
import { ActionForm } from "@/components/action-form";
import { advanceFulfillment } from "@/app/admin/actions";

function statusClass(value: string) {
    return "status-badge status-" + value.replaceAll("_", "-");
}

function statusLabel(value: string) {
    return value.replaceAll("_", " ").toUpperCase();
}

export default async function Order({ params }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!UUID.test(id))
        notFound();

    const order = await adminOrder(id);
    if (!order)
        notFound();

    const amount = (value: number) =>
        new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: order.currency,
        }).format(value / 100);

    const itemCount = order.order_items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0,
    );

    const nextFulfillmentStatus =
        order.fulfillment_status === "unfulfilled"
            ? "processing"
            : order.fulfillment_status === "processing"
                ? "shipped"
                : order.fulfillment_status === "shipped"
                    ? "delivered"
                    : null;

    const fulfillmentCanAdvance =
        !!nextFulfillmentStatus &&
        (order.fulfillment_status !== "unfulfilled" || order.payment_status === "paid");

    return (
        <>
            <div className="admin-order-detail-top">
                <div>
                    <Link className="text-link" href="/admin/orders">← ALL ORDERS</Link>
                    <p className="eyebrow">ORDER DETAIL</p>
                    <h1>
                        {order.order_number}
                        {order.is_test ? <span className="test-order-badge detail-test-badge">TEST</span> : null}
                    </h1>
                    <p className="muted">
                        Placed {new Date(order.created_at).toLocaleString("en-GB", {
                            timeZone: "UTC",
                            dateStyle: "medium",
                            timeStyle: "short",
                        })} UTC
                    </p>
                </div>
                <div className="admin-order-status-stack">
                    <span className={statusClass(order.payment_status)}>
                        PAYMENT · {statusLabel(order.payment_status)}
                    </span>
                    <span className={statusClass(order.fulfillment_status)}>
                        FULFILLMENT · {statusLabel(order.fulfillment_status)}
                    </span>
                </div>
            </div>

            <div className="stat-grid order-detail-stats">
                <div className="panel">
                    <span className="eyebrow">ORDER TOTAL</span>
                    <strong>{amount(order.final_total)}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">ITEMS</span>
                    <strong>{itemCount}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">PAYMENT</span>
                    <strong className="stat-word">{statusLabel(order.payment_status)}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">FULFILLMENT</span>
                    <strong className="stat-word">{statusLabel(order.fulfillment_status)}</strong>
                </div>
            </div>

            <div className="admin-order-detail-grid">
                <section className="panel">
                    <p className="eyebrow">CUSTOMER</p>
                    <h2>{order.delivery_name}</h2>
                    <dl className="order-data-list">
                        <div><dt>EMAIL</dt><dd>{order.customer_email}</dd></div>
                        <div><dt>PHONE</dt><dd>{order.delivery_phone}</dd></div>
                        <div><dt>CUSTOMER ID</dt><dd>{order.customer_id ?? "Guest / unavailable"}</dd></div>
                    </dl>
                </section>

                <section className="panel">
                    <p className="eyebrow">DELIVERY ADDRESS</p>
                    <h2>{order.delivery_city}</h2>
                    <address className="order-address">
                        {order.delivery_name}<br />
                        {order.delivery_address_line_1}<br />
                        {order.delivery_address_line_2 ? <>{order.delivery_address_line_2}<br /></> : null}
                        {order.delivery_city}
                        {order.delivery_postal_code ? `, ${order.delivery_postal_code}` : ""}<br />
                        {order.delivery_country_code}
                    </address>
                </section>

                <section className="panel">
                    <p className="eyebrow">TOTALS</p>
                    <div className="order-totals">
                        <div><span>Subtotal</span><strong>{amount(order.subtotal)}</strong></div>
                        <div><span>Shipping</span><strong>{amount(order.shipping_total)}</strong></div>
                        <div><span>Discount</span><strong>−{amount(order.discount_total)}</strong></div>
                        <div className="order-total-final"><span>Total</span><strong>{amount(order.final_total)}</strong></div>
                    </div>
                </section>

                <section className="panel">
                    <p className="eyebrow">ORDER INFO</p>
                    <dl className="order-data-list">
                        <div><dt>PROMO CODE</dt><dd>{order.promo_code_snapshot ?? "—"}</dd></div>
                        <div>
                            <dt>PAID AT</dt>
                            <dd>
                                {order.paid_at
                                    ? new Date(order.paid_at).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"
                                    : "Not paid"}
                            </dd>
                        </div>
                        <div>
                            <dt>LAST UPDATED</dt>
                            <dd>{new Date(order.updated_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd>
                        </div>
                    </dl>
                </section>
            </div>

            <section className="panel admin-order-items">
                <div className="admin-panel-heading">
                    <div>
                        <p className="eyebrow">PURCHASED ITEMS</p>
                        <h2>{itemCount} ITEM{itemCount === 1 ? "" : "S"}</h2>
                    </div>
                    <p className="muted">Order-item snapshots remain unchanged even if the catalog is edited later.</p>
                </div>
                <div className="table-scroll">
                    <table className="k-table">
                        <caption className="sr-only">Purchased item snapshots</caption>
                        <thead>
                            <tr>
                                <th>ITEM</th>
                                <th>VARIANT / SKU</th>
                                <th>QTY</th>
                                <th>UNIT PRICE</th>
                                <th>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.order_items.map((item) => (
                                <tr key={item.id}>
                                    <td><strong>{item.product_name}</strong></td>
                                    <td>
                                        {item.color} / {item.size}
                                        <small>{item.sku}</small>
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td>{amount(item.unit_price)}</td>
                                    <td>{amount(item.line_total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="panel admin-order-status-control">
                <div>
                    <p className="eyebrow">FULFILLMENT CONTROL</p>
                    <h2>
                        {nextFulfillmentStatus
                            ? `Next step: ${statusLabel(nextFulfillmentStatus)}`
                            : "Fulfillment workflow complete"}
                    </h2>
                    <p className="muted">
                        Payment status stays protected and will be controlled by verified payment callbacks.
                        Fulfillment can only move forward in order: UNFULFILLED → PROCESSING → SHIPPED → DELIVERED.
                    </p>
                </div>

                {nextFulfillmentStatus ? (
                    fulfillmentCanAdvance ? (
                        <ActionForm
                            action={advanceFulfillment}
                            className="fulfillment-action"
                            label={`MARK AS ${statusLabel(nextFulfillmentStatus)}`}
                            confirm={`Change fulfillment status to ${statusLabel(nextFulfillmentStatus)}?`}
                        >
                            <input type="hidden" name="order_id" value={order.id} />
                            <input type="hidden" name="updated_at" value={order.updated_at} />
                            <input type="hidden" name="next_status" value={nextFulfillmentStatus} />
                        </ActionForm>
                    ) : (
                        <div className="fulfillment-lock">
                            <span className={statusClass(order.payment_status)}>
                                PAYMENT · {statusLabel(order.payment_status)}
                            </span>
                            <p>This order must be confirmed as PAID by the payment gateway before processing can begin.</p>
                        </div>
                    )
                ) : (
                    <span className={statusClass(order.fulfillment_status)}>
                        {statusLabel(order.fulfillment_status)}
                    </span>
                )}
            </section>
        </>
    );
}
