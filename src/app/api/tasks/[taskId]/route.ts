import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ANON_COOKIE = "anon_id";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const anonId = cookieStore.get(ANON_COOKIE)?.value;

  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .select(
      "id, user_id, anon_id, prompt, status, image_url, error, created_at, completed_at"
    )
    .eq("id", taskId)
    .single();

  if (error || !task) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  if (user?.id) {
    if (task.user_id !== user.id) {
      return NextResponse.json({ error: "无权限访问该任务。" }, { status: 403 });
    }
  } else if (!anonId || task.anon_id !== anonId) {
    return NextResponse.json({ error: "无权限访问该任务。" }, { status: 403 });
  }

  return NextResponse.json({
    id: task.id,
    prompt: task.prompt,
    status: task.status,
    imageUrl: task.image_url,
    error: task.error,
    createdAt: task.created_at,
    completedAt: task.completed_at,
  });
}
