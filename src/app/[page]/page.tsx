// Only these known informational routes exist; unknown slugs return HTTP 404.
export const dynamicParams = false;
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/site";
import { InformationContent } from "@/components/information-content";
import type { InformationPage } from "@/lib/information-pages-ka";

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
    title: "PRIVACY POLICY",
    intro:
      "This Privacy Policy explains how KULTURA handles personal data when you use this website, create an account, save delivery details, contact us or choose optional analytics and marketing technologies. Paid online ordering is not yet open; this notice will be reviewed again before checkout launches.",
    sections: [
      {
        heading: "WHO CONTROLS YOUR DATA",
        items: [
          "Trading name: KULTURA.",
          "Privacy and customer-care contact: kultura.geo@gmail.com.",
          "Instagram: @kultura.geo.",
        ],
        paragraphs: [
          "KULTURA determines why and how personal data collected through this store is used. The legal/business address and any additional controller details required for paid online trading will be published before checkout opens.",
        ],
      },
      {
        heading: "DATA WE COLLECT",
        paragraphs: [
          "Account and authentication data may include your email address and the information needed to create, confirm, sign in to, secure or recover your account.",
          "Profile data may include your name and telephone number. Saved delivery-address data may include the recipient name, telephone number, country, city, street address, optional second address line, postal code and default-address preference.",
          "Your shopping bag is stored in your browser and may contain product, variant, size, colour, quantity and observed price information. The site may also process basic technical request information needed to operate and secure the service.",
          "If you contact KULTURA, we may process the information you include in your message and the contact details needed to reply.",
          "Newsletter signup is currently disabled, so the newsletter form does not currently collect email addresses.",
          "Checkout is currently unavailable, so KULTURA does not currently collect payment-card details through this website.",
        ],
      },
      {
        heading: "WHY WE USE PERSONAL DATA",
        paragraphs: [
          "We use account, profile and address information to provide requested site features, maintain customer accounts, support future order fulfilment, respond to requests, prevent misuse, secure the service and comply with applicable legal obligations.",
          "Depending on the activity, processing may be necessary to provide a requested service or take steps connected with a contract, to comply with legal obligations, for legitimate operational or security interests where permitted by law, or on the basis of your consent.",
        ],
      },
      {
        heading: "AUTHENTICATION & DATABASE SERVICES",
        paragraphs: [
          "KULTURA uses Supabase for authentication and database functionality. Account sessions and account-related records may therefore be processed through Supabase systems as needed to provide these features.",
          "Passwords are submitted to the authentication service for account creation and sign-in. KULTURA's application database is not designed to store plaintext account passwords.",
        ],
      },
      {
        heading: "COOKIES, LOCAL STORAGE & TRACKING",
        paragraphs: [
          "Necessary browser storage is used for core functionality such as keeping your shopping bag, remembering your cookie preferences and maintaining authenticated sessions where applicable.",
          "Google Analytics is optional. If you consent to Analytics in Cookie Settings, it may receive page-view and ecommerce-interaction information such as product views and add-to-cart events.",
          "Meta Pixel is optional. If you consent to Marketing in Cookie Settings, it may receive page-view and ecommerce-interaction information such as product views and add-to-cart events for advertising measurement.",
          "Google Analytics and Meta Pixel are not intentionally loaded by KULTURA before the corresponding consent choice is enabled. You can reject optional tracking or change your choice later through Cookie Settings in the footer.",
        ],
      },
      {
        heading: "SERVICE PROVIDERS & RECIPIENTS",
        paragraphs: [
          "Personal data may be processed by service providers that help operate the site, including Supabase for authentication/database services and Vercel for website hosting and infrastructure.",
          "If you enable optional tracking, relevant information may also be processed by Google for Analytics and Meta for Pixel services according to the selected consent.",
          "When paid ordering is introduced, payment and delivery providers may need limited customer or transaction information to process payments and fulfil deliveries. This Privacy Policy will be reviewed before those services go live.",
          "KULTURA does not sell personal data to advertisers.",
        ],
      },
      {
        heading: "INTERNATIONAL PROCESSING",
        paragraphs: [
          "Some technology providers used by the website may process or store information outside Georgia. Where international transfers are subject to data-protection requirements, KULTURA will rely on the safeguards required by applicable law and will update this notice if the relevant processing changes materially.",
        ],
      },
      {
        heading: "HOW LONG WE KEEP DATA",
        paragraphs: [
          "Personal data is kept only for as long as reasonably necessary for the purpose for which it was collected, for account or service operation, dispute handling, security, or applicable legal and record-keeping obligations.",
          "Account, profile and saved-address information may be retained while an account remains active and for an appropriate period afterward where there is a valid legal or operational reason to retain it.",
          "Shopping-bag and cookie-preference information stored in your browser remains subject to your browser storage controls. Optional analytics and marketing data are also subject to the settings and retention practices of the relevant provider.",
        ],
      },
      {
        heading: "YOUR RIGHTS",
        paragraphs: [
          "Subject to the conditions and limitations of applicable Georgian law, you may have the right to receive information about the processing of your personal data, access it and obtain a copy, request correction or completion, request termination of processing or erasure, request blocking in applicable cases, and request data portability where the legal conditions for portability are met.",
          "Where processing is based on consent, you may withdraw that consent. You can withdraw optional Analytics or Marketing consent directly through Cookie Settings. Withdrawal does not make earlier lawful processing unlawful.",
          "KULTURA does not currently use solely automated decision-making that produces legal or similarly significant effects for customers.",
        ],
      },
      {
        heading: "HOW TO MAKE A PRIVACY REQUEST",
        paragraphs: [
          "Send privacy requests to kultura.geo@gmail.com. Please describe what you are requesting clearly enough for us to identify the relevant account or data. We may need to take reasonable steps to verify that a request relates to you before acting on it.",
          "KULTURA will handle valid requests within the time limits and subject to the exceptions provided by applicable law.",
        ],
      },
      {
        heading: "SECURITY",
        paragraphs: [
          "KULTURA uses reasonable technical and organisational measures intended to protect personal data against unauthorised access, alteration, disclosure or loss. No internet service can guarantee absolute security.",
        ],
      },
      {
        heading: "CHANGES TO THIS POLICY",
        paragraphs: [
          "This policy may be updated when the store, service providers, payment features or legal requirements change. Material changes will be reflected on this page. The policy will be reviewed again before paid checkout is enabled.",
        ],
      },
      {
        heading: "CONTACT",
        paragraphs: [
          "For privacy questions or requests, contact kultura.geo@gmail.com.",
        ],
      },
    ],
  },
  terms: {
    title: "TERMS & CONDITIONS",
    intro:
      "These Terms & Conditions explain how KULTURA's online store works. The store is currently in preview and online ordering is not yet open. Before paid ordering launches, the trader information required by Georgian law will be completed on this page.",
    sections: [
      {
        heading: "TRADER & CONTACT",
        items: [
          "Trading name: KULTURA.",
          "Customer care email: kultura.geo@gmail.com.",
          "Instagram: @kultura.geo.",
          "Legal/business address: to be published before online ordering opens.",
        ],
        paragraphs: [
          "Instagram is an additional contact channel. Once online ordering is available, KULTURA will also publish the trader address and any other information required by applicable law.",
        ],
      },
      {
        heading: "STORE STATUS",
        paragraphs: [
          "The website may currently display products, prices, images and stock information for preview or testing purposes. Until checkout is enabled, browsing the site or adding an item to the cart does not create a purchase contract or payment obligation.",
        ],
      },
      {
        heading: "PRODUCTS, PRICES & AVAILABILITY",
        paragraphs: [
          "Product descriptions, materials, sizing, colours, images and prices are presented as accurately as reasonably possible. Screen settings and photography may cause minor visual differences.",
          "Prices are shown in Georgian lari (GEL). Any delivery charge or other applicable charge will be disclosed before an order is placed.",
          "Products are subject to availability. If an item becomes unavailable after an order is submitted, KULTURA will inform the customer and handle any amount already paid in accordance with applicable law.",
        ],
      },
      {
        heading: "ORDERS & CONTRACT FORMATION",
        paragraphs: [
          "When ordering becomes available, the checkout process will clearly indicate when placing the order creates an obligation to pay. Before that final step, the customer will be able to review the order, delivery information, price and applicable charges.",
          "An order is considered accepted when KULTURA confirms acceptance through the website, email or another durable medium. KULTURA may refuse or cancel an order where permitted by law, including where there is an obvious pricing error, suspected fraud, unavailable stock or an inability to fulfil the order.",
        ],
      },
      {
        heading: "PAYMENT",
        paragraphs: [
          "Available payment methods will be shown before checkout. KULTURA will not require payment through a method that is not presented on the checkout page.",
          "Where a payment is authorised but an order cannot be fulfilled, any refundable amount will be returned in accordance with applicable law and the relevant payment provider's processing times.",
        ],
      },
      {
        heading: "SHIPPING",
        paragraphs: [
          "Current standard delivery pricing is 10 GEL in Tbilisi with an estimated delivery time of up to 48 hours, and 20 GEL to other regions of Georgia with an estimated delivery time of up to 7 days.",
          "Standard delivery is free when the merchandise subtotal is 199 GEL or more. Full delivery terms and possible delays are explained on the Shipping page.",
        ],
      },
      {
        heading: "WITHDRAWAL, RETURNS & REFUNDS",
        paragraphs: [
          "For distance purchases, consumers have the statutory right to withdraw from the contract within 14 calendar days after receiving the goods, except where a legal exception applies.",
          "A withdrawal notice should be sent to kultura.geo@gmail.com within the applicable period. After giving notice, the goods must be sent back without undue delay and no later than 7 calendar days after the notice, unless KULTURA agrees to collect them.",
          "The customer bears the direct cost of returning the goods unless KULTURA agrees otherwise or applicable law requires otherwise. Refund timing, return conditions and legal exceptions are described in detail on the Returns page.",
        ],
      },
      {
        heading: "NO VOLUNTARY EXCHANGE SERVICE",
        paragraphs: [
          "KULTURA does not currently offer a separate voluntary size or colour exchange service. This does not limit any statutory right relating to defective, damaged, incorrect or otherwise non-conforming goods.",
        ],
      },
      {
        heading: "CONFORMITY & STATUTORY RIGHTS",
        paragraphs: [
          "Nothing in these Terms limits rights that a consumer has under mandatory Georgian consumer law. If goods are defective, damaged, incorrect or otherwise fail to conform to the contract, the customer may have remedies provided by law.",
        ],
      },
      {
        heading: "PROMOTIONS & DISCOUNT CODES",
        paragraphs: [
          "Promotions and discount codes may be subject to separate conditions, including validity dates, eligible products, minimum order values or usage limits. Where separate promotional terms conflict with these Terms, the promotional terms apply only to that promotion to the extent permitted by law.",
        ],
      },
      {
        heading: "INTELLECTUAL PROPERTY",
        paragraphs: [
          "The KULTURA name, visual identity, original product imagery, graphics, copy and other original site content may be protected by intellectual property rights. They may not be reproduced, distributed or used commercially without permission, except where use is permitted by law.",
        ],
      },
      {
        heading: "LIABILITY",
        paragraphs: [
          "KULTURA does not exclude or limit liability where doing so would be prohibited by law. Nothing on this website should be interpreted as excluding mandatory consumer protections.",
          "The website may occasionally be unavailable because of maintenance, technical issues or circumstances outside KULTURA's reasonable control. KULTURA will take reasonable steps to restore service where practical.",
        ],
      },
      {
        heading: "CHANGES TO THESE TERMS",
        paragraphs: [
          "KULTURA may update these Terms from time to time. The version that applies to a purchase is the version presented to the customer when the relevant order is placed, subject to mandatory law.",
        ],
      },
      {
        heading: "GOVERNING LAW & CONTACT",
        paragraphs: [
          "These Terms are governed by the laws of Georgia, without limiting any mandatory consumer protection that applies to the customer.",
          "Questions about these Terms can be sent to kultura.geo@gmail.com or to @kultura.geo on Instagram.",
        ],
      },
    ],
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

  return <InformationContent slug={page} english={entry} />;
}
