import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ANON_COOKIE = "anon_id";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const anonId = cookieStore.get(ANON_COOKIE)?.value;

  if (!user?.id && !anonId) {
    return NextResponse.json({ tasks: [] });
  }

  const filter = user?.id
    ? { column: "user_id", value: user.id }
    : { column: "anon_id", value: anonId as string };

  const { data: tasks, error } = await supabaseAdmin
    .from("tasks")
    .select("id, prompt, status, image_url, error, created_at, completed_at")
    .eq(filter.column, filter.value)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "加载任务失败，请稍后再试。" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    tasks: (tasks || []).map((task) => ({
      id: task.id,
      prompt: task.prompt,
      status: task.status,
      imageUrl: task.image_url,
      error: task.error,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    })),
  });
}
