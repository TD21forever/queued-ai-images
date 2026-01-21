// 浏览器端 Supabase 客户端
// 用于前端页面直接访问数据库，受 RLS 策略限制
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

// 创建浏览器端客户端（用于 React Client Components）
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, anonKey);
}
