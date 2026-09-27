import { notFound } from "next/navigation";
import { adminOptions, adminProduct } from "@/lib/admin/repository";
import { ProductEditor } from "@/components/admin/product-editor";
import { UUID } from "@/lib/validation";
export default async function EditProduct({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; if (!UUID.test(id))
    notFound(); const [product, options] = await Promise.all([adminProduct(id), adminOptions()]); if (!product)
    notFound(); return <><h1>EDIT PRODUCT</h1><p className="muted">{product.name}</p><ProductEditor product={product} options={options}/></>; }
