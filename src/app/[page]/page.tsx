// Only these known informational routes exist; unknown slugs return HTTP 404.
export const dynamicParams = false;
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/site";
import { Container, ButtonLink } from "@/components/ui";

type InformationSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

type InformationPage = {
  title: string;
  intro: string;
  sections?: InformationSection[];
};

const pages: Record<string, InformationPage> = {
  about: {
    title: "OUR OWN TERMS.",
    intro:
      "KULTURA is an independent streetwear label built around bold silhouettes, texture and individual expression. An everyday uniform for those who move differently. STEP INTO KULTURA.",
  },
  contact: {
    title: "GET IN TOUCH",
    intro:
      "For customer care, delivery or return questions, contact kultura.geo@gmail.com.",
  },
  shipping: {
    title: "SHIPPING",
    intro:
      "KULTURA currently delivers across Georgia. Delivery fees and estimated delivery times are shown below.",
    sections: [
      {
        heading: "TBILISI",
        items: [
          "Standard delivery: 10 GEL.",
          "Estimated delivery time: within 48 hours.",
        ],
      },
      {
        heading: "REGIONS OF GEORGIA",
        items: [
          "Standard delivery: 20 GEL.",
          "Estimated delivery time: within 7 days.",
        ],
      },
      {
        heading: "FREE DELIVERY",
        paragraphs: [
          "Standard delivery is free when the merchandise subtotal is 199 GEL or more.",
        ],
      },
      {
        heading: "DELIVERY NOTES",
        paragraphs: [
          "Delivery times are estimates and may be affected by weekends, public holidays, courier availability, weather, address accuracy or other circumstances outside KULTURA's reasonable control.",
          "Please provide a complete delivery address and an active telephone number. If an order cannot be delivered because the delivery details are incomplete or incorrect, a new delivery fee may apply where permitted by law.",
        ],
      },
      {
        heading: "CONTACT",
        paragraphs: [
          "For delivery questions, contact kultura.geo@gmail.com.",
        ],
      },
    ],
  },
  returns: {
    title: "RETURNS",
    intro:
      "This policy is intended to reflect the statutory withdrawal rights that apply to distance sales to consumers in Georgia. Statutory rights are not limited by this policy.",
    sections: [
      {
        heading: "14-DAY RIGHT OF WITHDRAWAL",
        paragraphs: [
          "Except where a legal exception applies, you may withdraw from an online purchase without giving a reason within 14 calendar days from the day you, or a third party designated by you other than the carrier, receive the goods.",
          "To use this right, send a clear withdrawal notice to kultura.geo@gmail.com before the 14-day period expires. Include your name, order number, the item or items you are returning and a clear statement that you are withdrawing from the purchase.",
        ],
      },
      {
        heading: "SENDING THE ITEM BACK",
        paragraphs: [
          "After notifying KULTURA of your withdrawal, you must send the goods back without undue delay and no later than 7 calendar days after giving that notice, unless KULTURA has agreed to collect them.",
          "The customer bears the direct cost of returning the goods, unless KULTURA agrees otherwise or applicable law requires otherwise. Contact kultura.geo@gmail.com before sending a return so we can provide the current return instructions.",
        ],
      },
      {
        heading: "REFUNDS",
        paragraphs: [
          "Where the statutory withdrawal right applies, KULTURA will reimburse the payments due under applicable law, including the cost of the least expensive standard delivery option offered for the original order. Extra delivery costs resulting from a more expensive delivery option selected by the customer do not have to be reimbursed.",
          "A refund must be made without undue delay and no later than 14 calendar days after KULTURA is informed of the withdrawal. For sales of goods, KULTURA may withhold the refund until the goods are received back or until you provide evidence that they were sent back, whichever occurs first, unless KULTURA offered to collect them.",
          "Refunds are made using the same payment method used for the original purchase unless another method is expressly agreed and does not create additional cost for the customer.",
        ],
      },
      {
        heading: "CONDITION OF RETURNED GOODS",
        paragraphs: [
          "You may inspect the goods as reasonably necessary to establish their nature, characteristics and functionality. You may be responsible for any reduction in value caused by handling beyond what is necessary for that purpose, as provided by law.",
        ],
      },
      {
        heading: "NO VOLUNTARY EXCHANGE SERVICE",
        paragraphs: [
          "KULTURA does not currently offer a separate voluntary size or colour exchange service. If you want a different item, you may place a new order. This does not affect any statutory rights you may have, including rights relating to defective, damaged, incorrect or non-conforming goods.",
        ],
      },
      {
        heading: "LEGAL EXCEPTIONS",
        paragraphs: [
          "The statutory right to withdraw does not apply in every situation. Exceptions provided by law may include, for example, certain made-to-order or clearly personalised goods and certain sealed goods that are unsuitable for return for health or hygiene reasons once unsealed.",
        ],
      },
      {
        heading: "WITHDRAWAL NOTICE TEMPLATE",
        paragraphs: [
          "You may email the following wording to kultura.geo@gmail.com: “I hereby give notice that I withdraw from my purchase of [item], order number [order number], received on [date]. Name: [name].” You may use different wording as long as your decision to withdraw is clear.",
        ],
      },
    ],
  },
  privacy: {
    title: "PRIVACY",
    intro:
      "Customer accounts use Supabase authentication and store the profile and delivery details you provide. Necessary storage supports core site features. Google Analytics and Meta Pixel are optional and load only according to your Cookie Settings choice. You can change that choice at any time from the footer. A fuller privacy notice will be published before launch.",
  },
  terms: {
    title: "TERMS",
    intro:
      "Commercial terms will be published before launch. Products, imagery, prices and stock currently shown are demonstration content.",
  },
  "size-guide": {
    title: "FIND YOUR FIT",
    intro:
      "Verified garment measurements and fit guidance will be published with the final collection.",
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
  const entry = Object.hasOwn(pages, page) ? pages[page] : undefined;

  return pageMetadata(
    entry?.title ?? "Not found",
    "/" + page,
    entry?.intro,
  );
}

export default async function Information({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const entry = Object.hasOwn(pages, page) ? pages[page] : undefined;
  if (!entry) notFound();

  return (
    <Container className="information page-section">
      <p className="eyebrow">KULTURA</p>
      <h1 className="page-title">{entry.title}</h1>
      <p className="information-intro">{entry.intro}</p>

      {entry.sections?.length ? (
        <div className="policy-sections">
          {entry.sections.map((section) => (
            <section className="policy-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items?.length ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      <ButtonLink href="/shop" secondary>
        EXPLORE THE COLLECTION ↗
      </ButtonLink>
    </Container>
  );
}
