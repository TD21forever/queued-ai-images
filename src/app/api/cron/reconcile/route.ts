import "server-only";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

