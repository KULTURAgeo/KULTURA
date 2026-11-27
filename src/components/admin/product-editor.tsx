import Image from "next/image";
import { ProductImagePicker } from "./product-image-picker";
import { ActionForm, Field } from "@/components/action-form";
import { saveProduct, archiveProduct, deleteProduct, uploadImage, updateImage, removeImage, moveImage } from "@/app/admin/actions";
import { VariantMatrix } from "./variant-matrix";
import { createProductWithImage } from "@/app/admin/products/new/actions";
import type { adminProduct, adminOptions } from "@/lib/admin/repository";
import { mapProduct } from "@/lib/catalog/mapper";
type Product = NonNullable<Awaited<ReturnType<typeof adminProduct>>>;
type Options = Awaited<ReturnType<typeof adminOptions>>;
function Hidden({ productId, image }: {
    productId: string;
    image: {
        id: string;
        updated_at: string;
    };
}) { return <><input type="hidden" name="product_id" value={productId}/><input type="hidden" name="id" value={image.id}/><input type="hidden" name="updated_at" value={image.updated_at}/></>; }
export function ProductEditor({ product, options, photosRemaining = 0 }: {
    product?: Product;
    options: Options;
    photosRemaining?: number;
}) {
    return <><ActionForm action={product ? saveProduct : createProductWithImage} label={product ? "SAVE PRODUCT" : "CREATE PRODUCT"}><input type="hidden" name="id" value={product?.id ?? ""}/><input type="hidden" name="updated_at" value={product?.updated_at ?? ""}/>
 <section className="panel"><h2>GENERAL</h2><div className="form-grid"><Field label="NAME" name="name" autoComplete="off" defaultValue={product?.name} required maxLength={200}/><Field label="SLUG" name="slug" defaultValue={product?.slug} required maxLength={160}/></div><label className="k-field"><span>DESCRIPTION</span><textarea name="description" defaultValue={product?.description} maxLength={10000} rows={5}/></label></section>
 <section className="panel"><h2>PRICING</h2><div className="form-grid"><Field label="PRICE · GEL" name="price" defaultValue={product ? (product.price / 100).toFixed(2) : ""} type="number" min={0} step="0.01" required/><Field label="COMPARE-AT PRICE · GEL" name="compare_at_price" defaultValue={product?.compare_at_price != null ? (product.compare_at_price / 100).toFixed(2) : ""} type="number" min={0} step="0.01"/></div></section>
 <section className="panel"><h2>ORGANIZATION</h2><label className="k-field"><span>SHOP DIVISION</span><select name="audience" required defaultValue={(() => {
   const divisions = options.collections
     .filter(c => ["shop-x", "shop-y", "shop-unisex"].includes(c.slug))
     .filter(c => product?.product_collections.some(pc => pc.collection_id === c.id))
     .map(c => c.slug);
   if (divisions.length === 3) return "xys";
   if (divisions.length === 1) return divisions[0].replace("shop-", "");
   return "";
 })()}><option value="" disabled>Choose a division</option><option value="x">X</option><option value="y">Y</option><option value="unisex">UNISEX</option><option value="xys">XYS — All 3 divisions</option></select></label><label className="k-field"><span>CATEGORY</span><select name="category_id" required defaultValue={product?.category_id ?? ""}><option value="" disabled>Choose a category</option>{options.categories.map(c => <option value={c.id} key={c.id}>{c.name}{c.audience ? " · "+c.audience.toUpperCase() : " · NOT ASSIGNED"}{c.is_active ? "" : " (inactive)"}</option>)}</select></label>{!options.categories.length && <p className="muted">Create a category in Supabase before adding products.</p>}<fieldset className="check-list"><legend>COLLECTIONS</legend>{options.collections.filter(c => !["shop-x","shop-y","shop-unisex"].includes(c.slug)).map(c => <label className="check-field" key={c.id}><input type="checkbox" name="collections" value={c.id} defaultChecked={product?.product_collections.some(pc => pc.collection_id === c.id)}/>{c.name}{c.is_active ? "" : " (inactive)"}</label>)}{!options.collections.length && <p className="muted">No collections yet.</p>}</fieldset></section>
 {!product && <section className="panel">
   <h2>MEDIA</h2>
   <p className="muted">Choose up to 10 photos. The first becomes the main photo. JPEG, PNG or WebP · up to 3 MB and 25 megapixels per file.</p>
   <ProductImagePicker />
   <Field label="PHOTO ALT TEXT FOR THIS BATCH · OPTIONAL" name="image_alt_text" maxLength={500}/>
 </section>}
 <section className="panel"><h2>VISIBILITY</h2><label className="k-field"><span>STATUS</span><select name="status" defaultValue={product?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option>{product?.status === "archived" && <option value="archived">Archived</option>}</select></label><label className="check-field"><input type="checkbox" name="featured" defaultChecked={product?.featured}/>Featured on homepage</label><label className="check-field"><input type="checkbox" name="is_drop" defaultChecked={product?.is_drop}/>Part of the current drop</label></section>
 <section className="panel"><h2>SEO</h2><Field label="SEO TITLE" name="seo_title" defaultValue={product?.seo_title ?? ""} maxLength={200}/><label className="k-field"><span>SEO DESCRIPTION</span><textarea name="seo_description" defaultValue={product?.seo_description ?? ""} maxLength={500} rows={3}/></label></section></ActionForm>
 {product ? <><section className="panel" id="product-media">
   <h2>MEDIA</h2>
   {photosRemaining > 0 && <p role="alert" className="form-error">
     The product was created. Choose only the last {photosRemaining} {photosRemaining === 1 ? "photo" : "photos"} again to finish the upload.
   </p>}
   <p className="muted">Choose up to 10 photos to add to the gallery. JPEG, PNG or WebP · up to 3 MB and 25 megapixels per file. Uploaded assets are public.</p>
   <div className="admin-image-grid">
     {product.product_images.map((image, index) => <article className="image-editor" key={image.id}>
       <Image src={mapProduct({ ...product, category: null, variants: product.product_variants, images: [image] }, process.env.SUPABASE_URL).image}
         alt={image.alt_text ?? product.name} width={400} height={400}/>
       <ActionForm action={updateImage} label="SAVE ALT TEXT">
         <Hidden productId={product.id} image={image}/>
         <Field label="ALT TEXT" name="alt_text" defaultValue={image.alt_text ?? ""} maxLength={500}/>
       </ActionForm>
       <div className="image-controls">
         {index > 0 && <ActionForm action={moveImage} label="MOVE UP">
           <Hidden productId={product.id} image={image}/>
           <input type="hidden" name="direction" value="up"/>
         </ActionForm>}
         {index < product.product_images.length - 1 && <ActionForm action={moveImage} label="MOVE DOWN">
           <Hidden productId={product.id} image={image}/>
           <input type="hidden" name="direction" value="down"/>
         </ActionForm>}
         <ActionForm action={removeImage} label="REMOVE" confirm="Remove this product image?">
           <Hidden productId={product.id} image={image}/>
         </ActionForm>
       </div>
     </article>)}
   </div>
   <ActionForm action={uploadImage} label="UPLOAD PHOTOS">
     <input type="hidden" name="product_id" value={product.id}/>
     <ProductImagePicker key={product.product_images.map(image => image.id).join("|")}
       product={{ name: product.name, price: product.price }} hasMainImage={product.product_images.length > 0}/>
     <Field label="PHOTO ALT TEXT FOR THIS BATCH · OPTIONAL" name="alt_text" maxLength={500}/>
   </ActionForm>
 </section>
 <VariantMatrix key={[product.updated_at, ...product.product_variants.map((variant) => variant.updated_at)].join("|")}
   productId={product.id} updatedAt={product.updated_at} slug={product.slug} savedBaseSku={product.base_sku}
   savedColors={product.product_colors} variants={product.product_variants} />
 {product.status !== "archived" && <section className="panel"><h2>ARCHIVE PRODUCT</h2><p className="muted">Hide this product while keeping historical orders intact.</p><ActionForm action={archiveProduct} label="ARCHIVE PRODUCT" confirm="Archive this product and hide it from the store?"><input type="hidden" name="id" value={product.id}/><input type="hidden" name="updated_at" value={product.updated_at}/><label className="check-field"><input type="checkbox" name="confirm_archive" required/>I want to archive this product</label></ActionForm></section>}
  <section className="panel"><h2>PERMANENTLY DELETE PRODUCT</h2><p className="muted">This permanently removes the product, variants, wishlist and collection links. Products used by order history or checkout cannot be deleted; archive those instead.</p><ActionForm action={deleteProduct} label="DELETE PRODUCT" confirm={`Permanently delete "${product.name}"? This cannot be undone.`}><input type="hidden" name="id" value={product.id}/><input type="hidden" name="updated_at" value={product.updated_at}/><Field label="TYPE THE EXACT PRODUCT NAME" name="confirm_name" required maxLength={200}/></ActionForm></section></> : <p className="muted">Create the product first, then add variants or additional images.</p>}</>;
}
