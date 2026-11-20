import Link from "next/link";
import { localizedPageMetadata } from "@/lib/site";
import { ActionForm } from "@/components/action-form";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { DropCountdown } from "@/components/drop-countdown";
import { getDropProducts } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { getServerLocale } from "@/lib/i18n-server";
import { getDropAlertPreference, getDropReleases } from "@/lib/drops-repository";
import { remainingPieces } from "@/lib/drops";
import { setDropAlert } from "./actions";
import styles from "./drops.module.css";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return localizedPageMetadata(locale, locale === "ka" ? "ახალი კოლექციები" : "New Drops", "/drops",
    "See upcoming KULTURA releases, request a launch email, and explore previous drops.",
    "ნახე KULTURA-ს მომავალი გამოშვებები, ჩაირთე ელფოსტის შეტყობინება და აღმოაჩინე წინა კოლექციები.");
}

export default async function Drops() {
  const [locale, releases, legacy] = await Promise.all([
    getServerLocale(), getDropReleases(), getDropProducts(),
  ]);
  const ka = locale === "ka";
  const { next, released } = releases;
  const alert = next && await getDropAlertPreference(next.id);
  const soldOut = ka ? "გაყიდულია" : "Sold out";
  const stockLabel = (count: number) => count === 0 ? soldOut
    : ka ? `დარჩა ${count} ცალი` : `${count} ${count === 1 ? "piece" : "pieces"} left`;
  const date = (value: string) => new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tbilisi",
  }).format(new Date(value));
  const linkedProducts = new Set(released.flatMap(drop => drop.products.map(product => product.id)));
  const previousProducts = legacy.products.filter(product => !linkedProducts.has(product.id));

  return (
    <Container className="page-section">
      <h1 className="page-title">{ka ? "ახალი კოლექციები" : "NEW DROPS"}</h1>
      {next ? (
        <section className={styles.launch} aria-labelledby="next-drop">
          <p className="eyebrow">{ka ? "შემდეგი გამოშვება" : "NEXT RELEASE"}</p>
          <h2 id="next-drop">{ka && next.title_ka ? next.title_ka : next.title}</h2>
          <p className={styles.meta}>
            <time dateTime={next.launches_at}>{date(next.launches_at)}</time> · {ka ? "თბილისის დროით" : "Tbilisi time"}
          </p>
          <DropCountdown key={next.launches_at} time={next.launches_at} initialNow={releases.time} locale={locale} />
          {alert === "signed-out" ? (
            <div>
              <p>{ka ? "შესვლის შემდეგ შეგიძლია მოითხოვო ერთჯერადი შეტყობინება ელფოსტით." : "Sign in to request a one-time launch email."}</p>
              <Link className="button" href="/login?next=/drops">{ka ? "შემატყობინე" : "Notify me"}</Link>
            </div>
          ) : alert === "unavailable" ? (
            <p role="status">{ka ? "შეტყობინებები დროებით მიუწვდომელია." : "Alerts are temporarily unavailable."}</p>
          ) : (
            <div>
              <p>{alert === "subscribed"
                ? ka ? "შეტყობინების მოთხოვნა შენახულია." : "Your alert request is saved."
                : ka ? "გამოშვების შესახებ ერთ წერილს მიიღებ ანგარიშის ელფოსტაზე." : "Get one launch email at your account address."}</p>
              <ActionForm key={alert ?? "available"} action={setDropAlert} label={alert === "subscribed"
                ? ka ? "გაუქმება" : "Cancel alert"
                : ka ? "შემატყობინე" : "Notify me"}>
                <input type="hidden" name="release_id" value={next.id} />
                <input type="hidden" name="mode" value={alert === "subscribed" ? "cancel" : "subscribe"} />
              </ActionForm>
            </div>
          )}
        </section>
      ) : (
        <section className={styles.launch} aria-label={ka ? "შემდეგი გამოშვება" : "Next release"}>
          <p>{releases.unavailable
            ? ka ? "გამოშვებების განრიგი დროებით მიუწვდომელია." : "The release schedule is temporarily unavailable."
            : ka ? "შემდეგი გამოშვების თარიღი ჯერ არ გამოცხადებულა." : "The next release date has not been announced yet."}</p>
        </section>
      )}
      {released.map((drop, index) => {
        const total = drop.products.reduce((sum, product) => sum + remainingPieces(product), 0);
        const state = drop.products.length > 0 && total === 0 ? soldOut
          : drop.archived || index > 0 ? ka ? "არქივი" : "Archive" : ka ? "გამოშვებულია" : "Released";
        return <section key={drop.id} className={styles.release}>
          <p className={styles.status}>{state}</p>
          <h2>{ka && drop.title_ka ? drop.title_ka : drop.title}</h2>
          <p className={styles.meta}><time dateTime={drop.launches_at}>{date(drop.launches_at)}</time></p>
          {drop.products.length > 0 && <div className="product-grid section">
            {drop.products.map(product => <ProductCard product={product} key={product.id} stockLabel={stockLabel(remainingPieces(product))} />)}
          </div>}
        </section>;
      })}
      {previousProducts.length > 0 && (
        <section className={styles.release}>
          <h2>{ka ? "წინა კოლექციები" : "Previous drops"}</h2>
          <div className="product-grid section">
            {previousProducts.map(product => <ProductCard key={product.id} product={product} stockLabel={stockLabel(remainingPieces(product))} />)}
          </div>
        </section>
      )}
      <CatalogNotice status={legacy.status} empty={!released.length && !previousProducts.length && !next} />
    </Container>
  );
}
