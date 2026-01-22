import "server-only";

import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!currentSigningKey || !nextSigningKey) {
  throw new Error("缺少 QStash 签名密钥。");
}



async function handler() {
  const nowIso = new Date().toISOString();

  const { data: deadlineFailed, error: deadlineError } = await supabaseAdmin
    .from("tasks")
    .update({ status: "failed", error: "超时：已超过截止时间。" })
    .in("status", ["queued", "processing"])
    .lte("deadline_at", nowIso)
    .select("id");

  if (deadlineError) {
    return NextResponse.json(
      { error: `deadline reconcile failed: ${deadlineError.message}` },
      { status: 500 }
    );
  }

  const { data: leaseFailed, error: leaseError } = await supabaseAdmin
    .from("tasks")
    .update({ status: "failed", error: "超时：处理租约已到期。" })
    .eq("status", "processing")
    .lte("lease_expires_at", nowIso)
    .select("id");

  if (leaseError) {
    return NextResponse.json(
      { error: `lease reconcile failed: ${leaseError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    deadlineFailed: deadlineFailed?.length ?? 0,
    leaseFailed: leaseFailed?.length ?? 0,
  });
}

const verifiedHandler = verifySignatureAppRouter(handler, {
  currentSigningKey,
  nextSigningKey,
});

export async function POST(request: Request) {

  return verifiedHandler(request);
}
