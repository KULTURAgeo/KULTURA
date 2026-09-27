import { adminOptions } from "@/lib/admin/repository";
import { ProductEditor } from "@/components/admin/product-editor";
export default async function NewProduct() { const options = await adminOptions(); return <><h1>NEW PRODUCT</h1><ProductEditor options={options}/></>; }
