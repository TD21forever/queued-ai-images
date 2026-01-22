import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { pollImageTask, startImageTask } from "@/lib/modelscope";

export const runtime = "nodejs";

const LEASE_MS = 60 * 1000;

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

  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  const leaseExpiresAtIso = leaseExpiresAt.toISOString();

  const { data: existingTask, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("id, status, prompt, model, deadline_at, lease_expires_at")
    .eq("id", taskId)
    .single();

  if (fetchError || !existingTask) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  if (existingTask.deadline_at && new Date(existingTask.deadline_at) <= now) {
    await supabaseAdmin
      .from("tasks")
      .update({ status: "failed", error: "超时：已超过截止时间。" })
      .eq("id", taskId)
      .in("status", ["queued", "processing"]);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  if (existingTask.status === "completed") {
    return NextResponse.json({ ok: true, status: "completed" });
  }

  if (existingTask.status === "failed") {
    return NextResponse.json({ ok: true, status: "failed" });
  }

  if (existingTask.status === "processing") {
    const lease = existingTask.lease_expires_at
      ? new Date(existingTask.lease_expires_at)
      : null;
    if (!lease || lease <= now) {
      await supabaseAdmin
        .from("tasks")
        .update({ status: "failed", error: "超时：处理租约已到期。" })
        .eq("id", taskId)
        .eq("status", "processing");
      return NextResponse.json({ ok: true, status: "failed" });
    }
    return NextResponse.json({ ok: true, status: "processing" });
  }

  // 抢占处理权：仅 queued 且未超过 deadline 的任务能进入 processing，并设置 60s 租约
  const { data: taskToProcess } = await supabaseAdmin
    .from("tasks")
    .update({
      status: "processing",
      processing_started_at: nowIso,
      lease_expires_at: leaseExpiresAtIso,
      error: null,
    })
    .eq("id", taskId)
    .eq("status", "queued")
    .gt("deadline_at", nowIso)
    .select("id, prompt, model, lease_expires_at")
    .single();

  if (!taskToProcess) {
    return NextResponse.json({ ok: true, status: "queued" });
  }

  try {
    const model =
      taskToProcess.model || process.env.MODELSCOPE_MODEL || "Tongyi-MAI/Z-Image-Turbo";

    const timeBudgetMs = Math.max(
      5_000,
      new Date(taskToProcess.lease_expires_at).getTime() - Date.now() - 3_000
    );

    const providerTaskId = await startImageTask(taskToProcess.prompt, model);
    const imageUrl = await pollImageTask(providerTaskId, {
      timeoutMs: timeBudgetMs,
      intervalMs: 5_000,
    });

    await supabaseAdmin
      .from("tasks")
      .update({
        status: "completed",
        image_url: imageUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "processing")
      .eq("lease_expires_at", taskToProcess.lease_expires_at);

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
      .eq("id", taskId)
      .eq("status", "processing")
      .eq("lease_expires_at", taskToProcess.lease_expires_at);

    return NextResponse.json({ error: "生成失败。" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler, {
  currentSigningKey,
  nextSigningKey,
});
