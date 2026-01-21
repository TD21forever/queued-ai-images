// 服务端 Supabase 管理客户端
// 使用 Service Role Key，绕过 RLS 策略，拥有完全访问权限
// 仅用于后端管理操作（如定时任务、后台处理等），严禁在浏览器端使用
import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

// 创建管理员客户端（绕过 RLS，拥有完全权限）
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
