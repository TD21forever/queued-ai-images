// 服务端 Supabase 客户端
// 用于 Server Components、Server Actions、Route Handlers
// 通过 cookies 同步用户会话，受 RLS 策略限制
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing Supabase public environment variables.");
}

// 创建服务端客户端（用于 Server Components/Actions）
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          cookieStore.set({
            name: cookie.name,
            value: cookie.value,
            ...cookie.options,
          });
        });
      },
    },
  });
}
