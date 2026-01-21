import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { qstash, getQueueName, getWorkerUrl } from "@/lib/qstash";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ANON_COOKIE = "anon_id";
const ANON_DAILY_LIMIT = 3;

async function getOrCreateAnonId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const anonId = crypto.randomUUID();
  cookieStore.set(ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return anonId;
}

function getUtcDayStart() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const prompt =
    typeof payload?.prompt === "string" ? payload.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const anonId = user ? null : await getOrCreateAnonId();

  if (!user && anonId) {
    const { count, error } = await supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("anon_id", anonId)
      .gte("created_at", getUtcDayStart().toISOString());

    if (error) {
      return NextResponse.json(
        { error: "Failed to check usage limits." },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= ANON_DAILY_LIMIT) {
      return NextResponse.json(
        { error: "Daily limit reached." },
        { status: 429 }
      );
    }
  }

  const model = process.env.MODELSCOPE_MODEL || "Tongyi-MAI/Z-Image-Turbo";

  const { data: task, error: insertError } = await supabaseAdmin
    .from("tasks")
    .insert({
      user_id: user?.id ?? null,
      anon_id: anonId,
      prompt,
      status: "queued",
      model,
    })
    .select("id, status")
    .single();

  if (insertError || !task) {
    return NextResponse.json(
      { error: "Failed to create task." },
      { status: 500 }
    );
  }

  try {
    await qstash.publishJSON({
      url: getWorkerUrl(),
      queue: getQueueName(),
      body: { taskId: task.id },
    });
  } catch (error) {
    await supabaseAdmin
      .from("tasks")
      .update({ status: "failed", error: "Failed to enqueue task." })
      .eq("id", task.id);

    return NextResponse.json(
      { error: "Failed to enqueue task." },
      { status: 502 }
    );
  }

  return NextResponse.json({ taskId: task.id, status: task.status });
}
