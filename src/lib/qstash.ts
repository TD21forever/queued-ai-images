import "server-only";

import { Client } from "@upstash/qstash";

const qstashToken = process.env.QSTASH_TOKEN;
const queueName = process.env.QSTASH_QUEUE_NAME || "imggen";
if (!qstashToken) {
  throw new Error("Missing QSTASH_TOKEN.");
}

export const qstash = new Client({ token: qstashToken });

export function getWorkerUrl(baseUrl?: string) {
  const resolvedBase = (baseUrl || process.env.APP_URL || "").replace(/\/$/, "");
  if (!resolvedBase) {
    throw new Error("缺少 APP_URL，用于 QStash 回调地址。");
  }
  console.info("[qstash] worker base url:", resolvedBase);
  return `${resolvedBase}/api/worker/generate`;
}

export function getQueueName() {
  return queueName;
}
