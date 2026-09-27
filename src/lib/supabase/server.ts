import "server-only";
import {createClient} from "@supabase/supabase-js";
import {supabaseConfig} from "./config";
import type {Database} from "./database.types";
export function createCatalogClient(){
 const config=supabaseConfig(); if(!config)return null;
 return createClient<Database>(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store",signal:AbortSignal.timeout(10000)})}});
}
