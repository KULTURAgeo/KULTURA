import Link from "next/link";
import { adminOrders } from "@/lib/admin/repository";
import { OrderList } from "@/components/order-list";
export default async function Orders({ searchParams }: {
    searchParams: Promise<{
        page?: string;
    }>;
}) {
    const query = await searchParams;
    const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
    const { orders, count } = await adminOrders(page);
    return <><h1>ORDERS</h1><p className="muted">Payment and fulfillment records are read-only in this phase.</p><OrderList orders={orders} admin/><nav className="inline-links">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{page * 25 < count && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></>;
}
