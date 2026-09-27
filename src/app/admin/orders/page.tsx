import Link from "next/link";
import {
    ADMIN_FULFILLMENT_STATUSES,
    ADMIN_PAYMENT_STATUSES,
    adminOrders,
    adminOrderStats,
} from "@/lib/admin/repository";
import { OrderList } from "@/components/order-list";

function optionLabel(value: string) {
    return value.replaceAll("_", " ").toUpperCase();
}

function ordersHref({
    page,
    search,
    payment,
    fulfillment,
}: {
    page: number;
    search: string;
    payment: string;
    fulfillment: string;
}) {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search) params.set("search", search);
    if (payment) params.set("payment", payment);
    if (fulfillment) params.set("fulfillment", fulfillment);
    const query = params.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function Orders({ searchParams }: {
    searchParams: Promise<{
        page?: string;
        search?: string;
        payment?: string;
        fulfillment?: string;
    }>;
}) {
    const query = await searchParams;
    const requestedPage = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
    const search = (query.search ?? "").slice(0, 80);
    const payment = query.payment ?? "";
    const fulfillment = query.fulfillment ?? "";

    const [stats, result] = await Promise.all([
        adminOrderStats(),
        adminOrders({
            page: requestedPage,
            search,
            payment,
            fulfillment,
        }),
    ]);

    const { orders, count, page } = result;
    const first = count ? (page - 1) * 25 + 1 : 0;
    const last = Math.min(page * 25, count);

    return (
        <>
            <div className="admin-order-heading">
                <div>
                    <p className="eyebrow">SALES / OPERATIONS</p>
                    <h1>ORDERS</h1>
                    <p className="muted">
                        Search customers, review delivery details and monitor payment and fulfillment status.
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
                    <span className="eyebrow">TOTAL ORDERS</span>
                    <strong>{stats.total}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">PENDING PAYMENT</span>
                    <strong>{stats.pendingPayment}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">PAID / UNFULFILLED</span>
                    <strong>{stats.readyToFulfill}</strong>
                </div>
                <div className="panel">
                    <span className="eyebrow">PROCESSING / SHIPPED</span>
                    <strong>{stats.inProgress}</strong>
                </div>
            </div>

            <form className="admin-order-filters" method="get">
                <label className="k-field admin-order-search">
                    <span>SEARCH</span>
                    <input
                        type="search"
                        name="search"
                        defaultValue={search}
                        maxLength={80}
                        placeholder="Order number, customer email or name"
                    />
                </label>

                <label className="k-field">
                    <span>PAYMENT</span>
                    <select name="payment" defaultValue={payment}>
                        <option value="">ALL PAYMENT</option>
                        {ADMIN_PAYMENT_STATUSES.map((status) => (
                            <option value={status} key={status}>{optionLabel(status)}</option>
                        ))}
                    </select>
                </label>

                <label className="k-field">
                    <span>FULFILLMENT</span>
                    <select name="fulfillment" defaultValue={fulfillment}>
                        <option value="">ALL FULFILLMENT</option>
                        {ADMIN_FULFILLMENT_STATUSES.map((status) => (
                            <option value={status} key={status}>{optionLabel(status)}</option>
                        ))}
                    </select>
                </label>

                <div className="admin-order-filter-actions">
                    <button className="button" type="submit">APPLY FILTERS</button>
                    <Link className="button secondary" href="/admin/orders">CLEAR</Link>
                </div>
            </form>

            <section className="panel admin-orders-panel">
                <div className="admin-panel-heading">
                    <div>
                        <p className="eyebrow">ORDER QUEUE</p>
                        <h2>{count ? `${count} ORDER${count === 1 ? "" : "S"}` : "NO ORDERS"}</h2>
                    </div>
                    <p className="muted">Payment status remains gateway-controlled when checkout goes live.</p>
                </div>

                <OrderList orders={orders} admin />
            </section>

            <nav className="admin-pagination" aria-label="Orders pagination">
                {page > 1 ? (
                    <Link
                        className="button secondary"
                        href={ordersHref({ page: page - 1, search: result.search, payment, fulfillment })}
                    >
                        ← PREVIOUS
                    </Link>
                ) : <span />}
                <span>PAGE {page}</span>
                {page * 25 < count ? (
                    <Link
                        className="button secondary"
                        href={ordersHref({ page: page + 1, search: result.search, payment, fulfillment })}
                    >
                        NEXT →
                    </Link>
                ) : <span />}
            </nav>
        </>
    );
}
