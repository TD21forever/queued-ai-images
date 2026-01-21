import "server-only";

import { Client } from "@upstash/qstash";

const qstashToken = process.env.QSTASH_TOKEN;
const queueName = process.env.QSTASH_QUEUE_NAME || "imggen";
const appUrl = process.env.APP_URL;

if (!qstashToken) {
  throw new Error("Missing QSTASH_TOKEN.");
}

if (!appUrl) {
  throw new Error("Missing APP_URL for QStash destination.");
}

export const qstash = new Client({ token: qstashToken });

export function getWorkerUrl() {
  return `${appUrl.replace(/\/$/, "")}/api/worker/generate`;
}

export function getQueueName() {
  return queueName;
}
