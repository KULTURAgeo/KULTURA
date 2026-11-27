import { notFound } from "next/navigation";
import { adminOptions, adminProduct } from "@/lib/admin/repository";
import { ProductEditor } from "@/components/admin/product-editor";
import { UUID } from "@/lib/validation";
import { MAX_PRODUCT_PHOTOS } from "@/lib/upload-limits";

export default async function EditProduct({ params, searchParams }: PageProps<"/admin/products/[id]">) {
    const [{ id }, query] = await Promise.all([params, searchParams]);
    if (!UUID.test(id)) notFound();

    const [product, options] = await Promise.all([adminProduct(id), adminOptions()]);
    if (!product) notFound();
    const remaining = typeof query.photosRemaining === "string" ? Number(query.photosRemaining) : 0;
    const photosRemaining = Number.isInteger(remaining) && remaining > 0 && remaining <= MAX_PRODUCT_PHOTOS ? remaining : 0;

    return <>
        <h1>EDIT PRODUCT</h1>
        <p className="muted">{product.name}</p>
        <ProductEditor product={product} options={options} photosRemaining={photosRemaining}/>
    </>;
}
