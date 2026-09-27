// Only these known informational routes exist; unknown slugs return HTTP 404.
export const dynamicParams = false;
import { notFound } from "next/navigation";
import {pageMetadata} from "@/lib/site";
import { Container, ButtonLink } from "@/components/ui";
const pages: Record<string, { title: string; text: string }> = {
  about: {
    title: "OUR OWN TERMS.",
    text: "KULTURA is an independent streetwear label built around bold silhouettes, texture and individual expression. An everyday uniform for those who move differently. STEP INTO KULTURA.",
  },
  contact: {
    title: "GET IN TOUCH",
    text: "Our customer care contact details will be published before the store opens.",
  },
  shipping: {
    title: "SHIPPING",
    text: "Delivery regions, costs and estimated timeframes are being finalized. Ordering is not available during this preview.",
  },
  returns: {
    title: "RETURNS",
    text: "The returns policy will be published before launch. This preview does not accept orders.",
  },
  privacy: {
    title: "PRIVACY",
    text: "Customer accounts use Supabase authentication and store the profile and delivery details you provide. Necessary storage supports core site features. Google Analytics and Meta Pixel are optional and load only according to your Cookie Settings choice. You can change that choice at any time from the footer. A fuller privacy notice will be published before launch.",
  },
  terms: {
    title: "TERMS",
    text: "Commercial terms will be published before launch. Products, imagery, prices and stock currently shown are demonstration content.",
  },
  "size-guide": {
    title: "FIND YOUR FIT",
    text: "Verified garment measurements and fit guidance will be published with the final collection.",
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  return pageMetadata((Object.hasOwn(pages,page) ? pages[page].title : "Not found"), "/"+page);
}
export default async function Information({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const entry = Object.hasOwn(pages,page) ? pages[page] : undefined;
  if (!entry) notFound();
  return (
    <Container className="information page-section">
      <p className="eyebrow">KULTURA</p>
      <h1 className="page-title">{entry.title}</h1>
      <p>{entry.text}</p>
      <ButtonLink href="/shop" secondary>
        EXPLORE THE COLLECTION ↗
      </ButtonLink>
    </Container>
  );
}
