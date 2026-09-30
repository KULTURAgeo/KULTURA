import Link from "next/link";

export type OrderSummary = {
    id: string;
    order_number: string;
    customer_email: string;
    delivery_name?: string;
    created_at: string;
    currency: string;
    final_total: number;
    payment_status: string;
    fulfillment_status: string;
    is_test?: boolean;
};

function label(value: string) {
    return value.replaceAll("_", " ").toUpperCase();
}

function statusClass(value: string) {
    return "status-badge status-" + value.replaceAll("_", "-");
}

export function OrderList({ orders, admin = false }: {
    orders: OrderSummary[];
    admin?: boolean;
}) {
    if (!orders.length)
        return (
            <div className="empty-state">
                <h2>No matching orders.</h2>
                <p>{admin ? "New or matching orders will appear here." : "Your orders will appear here when ordering opens."}</p>
            </div>
        );

    return (
        <div className="table-scroll">
            <table className="k-table order-table">
                <caption className="sr-only">Orders</caption>
                <thead>
                    <tr>
                        <th>ORDER</th>
                        {admin && <th>CUSTOMER</th>}
                        <th>DATE</th>
                        <th>TOTAL</th>
                        <th>PAYMENT</th>
                        <th>FULFILLMENT</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => (
                        <tr key={order.id}>
                            <td>
                                <div className="order-number-cell">
                                    <Link href={admin ? `/admin/orders/${order.id}` : `/order-confirmation/${order.id}`}>
                                        {order.order_number} ↗
                                    </Link>
                                    {order.is_test ? <span className="test-order-badge">TEST</span> : null}
                                </div>
                            </td>
                            {admin && (
                                <td>
                                    {order.delivery_name ? <strong>{order.delivery_name}</strong> : null}
                                    <small>{order.customer_email}</small>
                                </td>
                            )}
                            <td>
                                {new Date(order.created_at).toLocaleDateString("en-GB", {
                                    timeZone: "UTC",
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                                <small>
                                    {new Date(order.created_at).toLocaleTimeString("en-GB", {
                                        timeZone: "UTC",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })} UTC
                                </small>
                            </td>
                            <td>
                                {new Intl.NumberFormat("en-GB", {
                                    style: "currency",
                                    currency: order.currency,
                                }).format(order.final_total / 100)}
                            </td>
                            <td><span className={statusClass(order.payment_status)}>{label(order.payment_status)}</span></td>
                            <td><span className={statusClass(order.fulfillment_status)}>{label(order.fulfillment_status)}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
