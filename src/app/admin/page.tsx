import { adminOverview } from "@/lib/admin/repository";
import { OrderList } from "@/components/order-list";
export default async function Admin() {
    const data = await adminOverview();
    return <><h1>OVERVIEW</h1><div className="stat-grid">{[["TOTAL PRODUCTS", data.total], ["ACTIVE PRODUCTS", data.active], ["LOW STOCK · 1–5", data.low], ["OUT OF STOCK", data.empty]].map(([label, value]) => <div className="panel" key={label}><span className="eyebrow">{label}</span><strong>{value}</strong></div>)}</div><section className="panel"><h2>RECENT ORDERS</h2><OrderList orders={data.orders} admin/></section></>;
}
