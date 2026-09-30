// Generated from executable migrations by pnpm db:types. Do not hand-edit.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { public: { Tables: {
addresses: {
Row: {
id: string;
profile_id: string;
recipient_name: string;
phone: string;
country_code: string;
city: string;
address_line_1: string;
address_line_2: string | null;
postal_code: string | null;
is_default: boolean;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
profile_id?: string;
recipient_name: string;
phone: string;
country_code?: string;
city: string;
address_line_1: string;
address_line_2?: string | null;
postal_code?: string | null;
is_default?: boolean;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
profile_id?: string;
recipient_name?: string;
phone?: string;
country_code?: string;
city?: string;
address_line_1?: string;
address_line_2?: string | null;
postal_code?: string | null;
is_default?: boolean;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"addresses_profile_id_fkey","columns":["profile_id"],"isOneToOne":false,"referencedRelation":"profiles","referencedColumns":["id"]}];
};
categories: {
Row: {
id: string;
name: string;
slug: string;
description: string;
is_active: boolean;
sort_position: number;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
name: string;
slug: string;
description?: string;
is_active?: boolean;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
name?: string;
slug?: string;
description?: string;
is_active?: boolean;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Relationships: [];
};
collections: {
Row: {
id: string;
name: string;
slug: string;
description: string;
is_active: boolean;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
name: string;
slug: string;
description?: string;
is_active?: boolean;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
name?: string;
slug?: string;
description?: string;
is_active?: boolean;
created_at?: string;
updated_at?: string;
};
Relationships: [];
};
notification_outbox: {
Row: {
id: string;
order_id: string;
event_type: string;
recipient_email: string;
recipient_phone: string | null;
recipient_country_code: string | null;
payload: string;
email_status: string;
sms_status: string;
email_attempts: number;
sms_attempts: number;
email_sent_at: string | null;
sms_sent_at: string | null;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
order_id: string;
event_type: string;
recipient_email: string;
recipient_phone?: string | null;
recipient_country_code?: string | null;
payload?: string;
email_status?: string;
sms_status?: string;
email_attempts?: number;
sms_attempts?: number;
email_sent_at?: string | null;
sms_sent_at?: string | null;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
order_id?: string;
event_type?: string;
recipient_email?: string;
recipient_phone?: string | null;
recipient_country_code?: string | null;
payload?: string;
email_status?: string;
sms_status?: string;
email_attempts?: number;
sms_attempts?: number;
email_sent_at?: string | null;
sms_sent_at?: string | null;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"notification_outbox_order_id_fkey","columns":["order_id"],"isOneToOne":false,"referencedRelation":"orders","referencedColumns":["id"]}];
};
order_items: {
Row: {
id: string;
order_id: string;
product_id: string;
variant_id: string;
product_name: string;
product_slug: string;
sku: string;
size: string;
color: string;
image_url: string | null;
unit_price: number;
quantity: number;
discount_total: number;
line_total: number;
created_at: string;
};
Insert: {
id?: string;
order_id: string;
product_id: string;
variant_id: string;
product_name: string;
product_slug: string;
sku: string;
size: string;
color: string;
image_url?: string | null;
unit_price: number;
quantity: number;
discount_total?: number;
line_total: number;
created_at?: string;
};
Update: {
id?: string;
order_id?: string;
product_id?: string;
variant_id?: string;
product_name?: string;
product_slug?: string;
sku?: string;
size?: string;
color?: string;
image_url?: string | null;
unit_price?: number;
quantity?: number;
discount_total?: number;
line_total?: number;
created_at?: string;
};
Relationships: [{"foreignKeyName":"order_items_order_id_fkey","columns":["order_id"],"isOneToOne":false,"referencedRelation":"orders","referencedColumns":["id"]},{"foreignKeyName":"order_items_product_id_fkey","columns":["product_id"],"isOneToOne":false,"referencedRelation":"products","referencedColumns":["id"]},{"foreignKeyName":"order_items_variant_id_product_id_fkey","columns":["variant_id","product_id"],"isOneToOne":false,"referencedRelation":"product_variants","referencedColumns":["id","product_id"]}];
};
orders: {
Row: {
id: string;
customer_id: string | null;
order_number: string;
currency: string;
subtotal: number;
shipping_total: number;
discount_total: number;
final_total: number;
payment_status: Database["public"]["Enums"]["payment_status"];
fulfillment_status: Database["public"]["Enums"]["fulfillment_status"];
customer_email: string;
delivery_name: string;
delivery_phone: string;
delivery_country_code: string;
delivery_city: string;
delivery_address_line_1: string;
delivery_address_line_2: string | null;
delivery_postal_code: string | null;
promo_code_snapshot: string | null;
created_at: string;
updated_at: string;
paid_at: string | null;
is_test: boolean;
};
Insert: {
id?: string;
customer_id?: string | null;
order_number?: string;
currency?: string;
subtotal: number;
shipping_total?: number;
discount_total?: number;
final_total: number;
payment_status?: Database["public"]["Enums"]["payment_status"];
fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
customer_email: string;
delivery_name: string;
delivery_phone: string;
delivery_country_code: string;
delivery_city: string;
delivery_address_line_1: string;
delivery_address_line_2?: string | null;
delivery_postal_code?: string | null;
promo_code_snapshot?: string | null;
created_at?: string;
updated_at?: string;
paid_at?: string | null;
is_test?: boolean;
};
Update: {
id?: string;
customer_id?: string | null;
order_number?: string;
currency?: string;
subtotal?: number;
shipping_total?: number;
discount_total?: number;
final_total?: number;
payment_status?: Database["public"]["Enums"]["payment_status"];
fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"];
customer_email?: string;
delivery_name?: string;
delivery_phone?: string;
delivery_country_code?: string;
delivery_city?: string;
delivery_address_line_1?: string;
delivery_address_line_2?: string | null;
delivery_postal_code?: string | null;
promo_code_snapshot?: string | null;
created_at?: string;
updated_at?: string;
paid_at?: string | null;
is_test?: boolean;
};
Relationships: [{"foreignKeyName":"orders_customer_id_fkey","columns":["customer_id"],"isOneToOne":false,"referencedRelation":"profiles","referencedColumns":["id"]}];
};
product_collections: {
Row: {
product_id: string;
collection_id: string;
sort_position: number;
created_at: string;
};
Insert: {
product_id: string;
collection_id: string;
sort_position?: number;
created_at?: string;
};
Update: {
product_id?: string;
collection_id?: string;
sort_position?: number;
created_at?: string;
};
Relationships: [{"foreignKeyName":"product_collections_collection_id_fkey","columns":["collection_id"],"isOneToOne":false,"referencedRelation":"collections","referencedColumns":["id"]},{"foreignKeyName":"product_collections_product_id_fkey","columns":["product_id"],"isOneToOne":false,"referencedRelation":"products","referencedColumns":["id"]}];
};
product_images: {
Row: {
id: string;
product_id: string;
image_url: string | null;
storage_path: string | null;
alt_text: string | null;
sort_position: number;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
product_id: string;
image_url?: string | null;
storage_path?: string | null;
alt_text?: string | null;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
product_id?: string;
image_url?: string | null;
storage_path?: string | null;
alt_text?: string | null;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"product_images_product_id_fkey","columns":["product_id"],"isOneToOne":false,"referencedRelation":"products","referencedColumns":["id"]}];
};
product_variants: {
Row: {
id: string;
product_id: string;
sku: string;
size: string;
color: string;
stock_quantity: number;
is_active: boolean;
sort_position: number;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
product_id: string;
sku: string;
size: string;
color: string;
stock_quantity?: number;
is_active?: boolean;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
product_id?: string;
sku?: string;
size?: string;
color?: string;
stock_quantity?: number;
is_active?: boolean;
sort_position?: number;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"product_variants_product_id_fkey","columns":["product_id"],"isOneToOne":false,"referencedRelation":"products","referencedColumns":["id"]}];
};
products: {
Row: {
id: string;
name: string;
slug: string;
description: string;
price: number;
compare_at_price: number | null;
currency: string;
status: Database["public"]["Enums"]["product_status"];
featured: boolean;
is_drop: boolean;
category_id: string;
seo_title: string | null;
seo_description: string | null;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
name: string;
slug: string;
description?: string;
price: number;
compare_at_price?: number | null;
currency?: string;
status?: Database["public"]["Enums"]["product_status"];
featured?: boolean;
is_drop?: boolean;
category_id: string;
seo_title?: string | null;
seo_description?: string | null;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
name?: string;
slug?: string;
description?: string;
price?: number;
compare_at_price?: number | null;
currency?: string;
status?: Database["public"]["Enums"]["product_status"];
featured?: boolean;
is_drop?: boolean;
category_id?: string;
seo_title?: string | null;
seo_description?: string | null;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"products_category_id_fkey","columns":["category_id"],"isOneToOne":false,"referencedRelation":"categories","referencedColumns":["id"]}];
};
profiles: {
Row: {
id: string;
full_name: string;
phone: string | null;
role: Database["public"]["Enums"]["profile_role"];
created_at: string;
updated_at: string;
};
Insert: {
id: string;
full_name?: string;
phone?: string | null;
role?: Database["public"]["Enums"]["profile_role"];
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
full_name?: string;
phone?: string | null;
role?: Database["public"]["Enums"]["profile_role"];
created_at?: string;
updated_at?: string;
};
Relationships: [];
};
promo_codes: {
Row: {
id: string;
code: string;
kind: Database["public"]["Enums"]["discount_kind"];
amount: number;
currency: string | null;
minimum_subtotal: number;
maximum_discount: number | null;
starts_at: string | null;
expires_at: string | null;
max_uses: number | null;
used_count: number;
is_active: boolean;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
code: string;
kind: Database["public"]["Enums"]["discount_kind"];
amount: number;
currency?: string | null;
minimum_subtotal?: number;
maximum_discount?: number | null;
starts_at?: string | null;
expires_at?: string | null;
max_uses?: number | null;
used_count?: number;
is_active?: boolean;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
code?: string;
kind?: Database["public"]["Enums"]["discount_kind"];
amount?: number;
currency?: string | null;
minimum_subtotal?: number;
maximum_discount?: number | null;
starts_at?: string | null;
expires_at?: string | null;
max_uses?: number | null;
used_count?: number;
is_active?: boolean;
created_at?: string;
updated_at?: string;
};
Relationships: [];
};
return_request_items: {
Row: {
return_request_id: string;
order_item_id: string;
quantity: number;
};
Insert: {
return_request_id: string;
order_item_id: string;
quantity: number;
};
Update: {
return_request_id?: string;
order_item_id?: string;
quantity?: number;
};
Relationships: [{"foreignKeyName":"return_request_items_order_item_id_fkey","columns":["order_item_id"],"isOneToOne":false,"referencedRelation":"order_items","referencedColumns":["id"]},{"foreignKeyName":"return_request_items_return_request_id_fkey","columns":["return_request_id"],"isOneToOne":false,"referencedRelation":"return_requests","referencedColumns":["id"]}];
};
return_requests: {
Row: {
id: string;
order_id: string;
customer_id: string;
request_type: string;
reason: string;
details: string;
status: string;
admin_note: string;
created_at: string;
updated_at: string;
};
Insert: {
id?: string;
order_id: string;
customer_id: string;
request_type: string;
reason: string;
details?: string;
status?: string;
admin_note?: string;
created_at?: string;
updated_at?: string;
};
Update: {
id?: string;
order_id?: string;
customer_id?: string;
request_type?: string;
reason?: string;
details?: string;
status?: string;
admin_note?: string;
created_at?: string;
updated_at?: string;
};
Relationships: [{"foreignKeyName":"return_requests_customer_id_fkey","columns":["customer_id"],"isOneToOne":false,"referencedRelation":"profiles","referencedColumns":["id"]},{"foreignKeyName":"return_requests_order_id_fkey","columns":["order_id"],"isOneToOne":false,"referencedRelation":"orders","referencedColumns":["id"]}];
};
wishlist_items: {
Row: {
profile_id: string;
product_id: string;
created_at: string;
};
Insert: {
profile_id?: string;
product_id: string;
created_at?: string;
};
Update: {
profile_id?: string;
product_id?: string;
created_at?: string;
};
Relationships: [{"foreignKeyName":"wishlist_items_product_id_fkey","columns":["product_id"],"isOneToOne":false,"referencedRelation":"products","referencedColumns":["id"]},{"foreignKeyName":"wishlist_items_profile_id_fkey","columns":["profile_id"],"isOneToOne":false,"referencedRelation":"profiles","referencedColumns":["id"]}];
};
}; Views: { [_ in never]: never }; Functions: {
admin_advance_fulfillment: { Args: { p_order_id: string | null; p_expected_updated_at: string | null; p_next_status: string | null }; Returns: string };
admin_attach_image: { Args: { p_product_id: string | null; p_storage_path: string | null; p_alt_text: string | null }; Returns: string };
admin_create_test_order: { Args: { p_cart: Json | null; p_address: Json | null }; Returns: string };
admin_create_test_order_v2: { Args: { p_cart: Json | null; p_address: Json | null; p_promo_code: string | null }; Returns: string };
admin_reorder_images: { Args: { p_product_id: string | null; p_ids: string[] | null; p_expected_ids: string[] | null }; Returns: undefined };
admin_save_checkout_settings: { Args: { p_shipping_total: string | null; p_free_shipping_threshold: string | null }; Returns: Json };
admin_save_product: { Args: { p_id: string | null; p_expected_updated_at: string | null; p_product: Json | null; p_collection_ids: string[] | null }; Returns: string };
admin_save_promo: { Args: { p_id: string | null; p_expected_updated_at: string | null; p_promo: Json | null }; Returns: string };
admin_update_return_request: { Args: { p_request_id: string | null; p_expected_updated_at: string | null; p_status: string | null; p_admin_note: string | null }; Returns: string };
checkout_create_unpaid_order: { Args: { p_cart: Json | null; p_address: Json | null; p_promo_code: string | null }; Returns: string };
checkout_get_shipping_settings: { Args: { p_request: boolean | null }; Returns: Json };
checkout_quote_promo: { Args: { p_code: string | null; p_subtotal: string | null }; Returns: Json };
customer_create_return_request: { Args: { p_order_id: string | null; p_request_type: string | null; p_reason: string | null; p_details: string | null; p_items: Json | null }; Returns: string };
customer_save_address: { Args: { p_id: string | null; p_address: Json | null }; Returns: string };
notification_prepare: { Args: { p_order_id: string | null; p_event_type: string | null }; Returns: Json };
notification_record_delivery: { Args: { p_notification_id: string | null; p_channel: string | null; p_status: string | null }; Returns: undefined };
}; Enums: {
discount_kind: "fixed" | "percentage";
fulfillment_status: "unfulfilled" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
payment_status: "pending" | "paid" | "failed" | "cancelled" | "partially_refunded" | "refunded";
product_status: "draft" | "active" | "archived";
profile_role: "customer" | "admin";
}; CompositeTypes: { [_ in never]: never }; }; };
