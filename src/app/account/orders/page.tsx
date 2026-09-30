import { requirePage } from "@/lib/auth/guards";
import { OrderList } from "@/components/order-list";
import Link from "next/link";

export const metadata = { title: "Your orders" };
const PAGE_SIZE = 25;

export default async function Orders({ searchParams }: {
  searchParams: Promise<{ page?: string; test_order?: string }>;
}) {
  const { client, user } = await requirePage();
  const query = await searchParams;
  const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const offset = (page - 1) * PAGE_SIZE;
  const { data, error } = await client
    .from("orders")
    .select("id,order_number,customer_email,created_at,currency,final_total,payment_status,fulfillment_status,is_test")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + PAGE_SIZE);

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const orders = hasNext ? rows.slice(0, PAGE_SIZE) : rows;

  return (
    <section>
      <h1>YOUR ORDERS</h1>
      {query.test_order === "created" ? (
        <p className="form-success">Test order created successfully. No payment was taken.</p>
      ) : null}
      {error ? (
        <p role="alert">Orders are temporarily unavailable. Please try again.</p>
      ) : (
        <>
          <OrderList orders={orders} />
          <nav className="inline-links" aria-label="Orders pagination">
            {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
            {hasNext ? <Link href={`?page=${page + 1}`}>Next</Link> : null}
          </nav>
        </>
      )}
    </section>
  );
}
