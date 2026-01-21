import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { pollImageTask, startImageTask } from "@/lib/modelscope";

export const runtime = "nodejs";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!currentSigningKey || !nextSigningKey) {
  throw new Error("缺少 QStash 签名密钥。");
}

async function handler(request: Request) {
  const payload = await request.json().catch(() => null);
  const taskId =
    typeof payload?.taskId === "string" || typeof payload?.taskId === "number"
      ? payload.taskId
      : "";

  if (!taskId) {
    return NextResponse.json({ error: "缺少 taskId。" }, { status: 400 });
  }

  const { data: existingTask, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("id, status, prompt, model")
    .eq("id", taskId)
    .single();

  if (fetchError || !existingTask) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  if (existingTask.status === "completed") {
    return NextResponse.json({ ok: true, status: "completed" });
  }

  const { data: taskToProcess } = await supabaseAdmin
    .from("tasks")
    .update({ status: "processing" })
    .eq("id", taskId)
    .in("status", ["queued", "failed"])
    .select("id, prompt, model")
    .single();

  if (!taskToProcess) {
    return NextResponse.json({ ok: true, status: existingTask.status });
  }

  try {
    const model =
      taskToProcess.model || process.env.MODELSCOPE_MODEL || "Tongyi-MAI/Z-Image-Turbo";

    const imageUrl = await pollImageTask(
      await startImageTask(taskToProcess.prompt, model)
    );

    await supabaseAdmin
      .from("tasks")
      .update({
        status: "completed",
        image_url: imageUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    return NextResponse.json({ ok: true, status: "completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误。";
    const displayMessage = `生成失败：${message}`;

    await supabaseAdmin
      .from("tasks")
      .update({
        status: "failed",
        error: displayMessage.slice(0, 500),
      })
      .eq("id", taskId);

    return NextResponse.json({ error: "生成失败。" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  currentSigningKey,
  nextSigningKey,
});
