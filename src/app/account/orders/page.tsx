import { requirePage } from "@/lib/auth/guards";
import { OrderList } from "@/components/order-list";
import Link from "next/link";
export const metadata = { title: "Your orders" };
export default async function Orders({ searchParams }: {
    searchParams: Promise<{
        page?: string;
    }>;
}) {
    const { client, user } = await requirePage();
    const query = await searchParams;
    const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
    const offset = (Math.floor(page) - 1) * 25;
    const { data, error, count } = await client.from("orders").select("id,order_number,customer_email,created_at,currency,final_total,payment_status,fulfillment_status", { count: "exact" }).eq("customer_id", user.id).order("created_at", { ascending: false }).order("id").range(offset, offset + 24);
    return <section><h1>YOUR ORDERS</h1>{error ? <p role="alert">Orders are temporarily unavailable. Please try again.</p> : <><OrderList orders={data ?? []}/><nav className="inline-links">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{offset + 25 < (count ?? 0) && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></>}</section>;
}
