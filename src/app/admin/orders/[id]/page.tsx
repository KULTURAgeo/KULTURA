import { notFound } from "next/navigation";
import { adminOrder } from "@/lib/admin/repository";
import { UUID } from "@/lib/validation";
export default async function Order({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    if (!UUID.test(id))
        notFound();
    const order = await adminOrder(id);
    if (!order)
        notFound();
    const amount = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(n / 100);
    return <><h1>{order.order_number}</h1><p>{order.payment_status} / {order.fulfillment_status}</p><div className="form-grid"><section className="panel"><h2>DELIVERY</h2><p>{order.delivery_name}<br />{order.customer_email}<br />{order.delivery_phone}</p><p>{order.delivery_address_line_1}<br />{order.delivery_address_line_2}<br />{order.delivery_city}, {order.delivery_postal_code}<br />{order.delivery_country_code}</p></section><section className="panel"><h2>TOTALS</h2><p>Subtotal: {amount(order.subtotal)}</p><p>Shipping: {amount(order.shipping_total)}</p><p>Discount: {amount(order.discount_total)}</p><p>Total: {amount(order.final_total)}</p></section></div><div className="table-scroll"><table className="k-table"><caption>Purchased item snapshots</caption><thead><tr><th>ITEM</th><th>VARIANT / SKU</th><th>QTY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead><tbody>{order.order_items.map(item => <tr key={item.id}><td>{item.product_name}</td><td>{item.color} / {item.size}<small>{item.sku}</small></td><td>{item.quantity}</td><td>{amount(item.unit_price)}</td><td>{amount(item.line_total)}</td></tr>)}</tbody></table></div></>;
}
