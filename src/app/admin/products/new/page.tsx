import { adminOptions } from "@/lib/admin/repository";
import { ProductEditor } from "@/components/admin/product-editor";
import { ProductImagePicker } from "@/components/admin/product-image-picker";

export default async function NewProduct() {
  const options = await adminOptions();
  return (
    <>
      <h1>NEW PRODUCT</h1>
      <ProductEditor options={options}/>
      <ProductImagePicker />
    </>
  );
}
