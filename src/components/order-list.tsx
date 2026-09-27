import Link from "next/link";
export type OrderSummary = {
    id: string;
    order_number: string;
    customer_email: string;
    created_at: string;
    currency: string;
    final_total: number;
    payment_status: string;
    fulfillment_status: string;
};
export function OrderList({ orders, admin = false }: {
    orders: OrderSummary[];
    admin?: boolean;
}) {
    if (!orders.length)
        return <div className="empty-state"><h2>No orders yet.</h2><p>{admin ? "New orders will appear here when ordering opens." : "Your orders will appear here when ordering opens."}</p></div>;
    return <div className="table-scroll"><table className="k-table"><caption className="sr-only">Orders</caption><thead><tr><th>ORDER</th>{admin && <th>CUSTOMER</th>}<th>DATE</th><th>TOTAL</th><th>PAYMENT</th><th>FULFILLMENT</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{admin ? <Link href={`/admin/orders/${o.id}`}>{o.order_number} ↗</Link> : o.order_number}</td>{admin && <td>{o.customer_email}</td>}<td>{new Date(o.created_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</td><td>{new Intl.NumberFormat("en-GB", { style: "currency", currency: o.currency }).format(o.final_total / 100)}</td><td>{o.payment_status.replaceAll("_", " ")}</td><td>{o.fulfillment_status.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>;
}
