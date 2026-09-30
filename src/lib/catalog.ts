export type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
};
export type ProductImage = { src: string; alt: string };
export type Category = { name: string; slug: string };
export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  category: string;
  categorySlug: string;
  image: string;
  images: ProductImage[];
  description: string;
  featured: boolean;
  drop: boolean;
  variants: Variant[];
  createdAt: string;
  seoTitle?: string;
  seoDescription?: string;
};
export const money = (amount: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GEL",
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export const campaignImage = "/images/campaign.jpg";
