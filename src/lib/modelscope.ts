import "server-only";

const baseUrl = "https://api-inference.modelscope.cn/";
const apiKey = process.env.MODELSCOPE_API_KEY;

if (!apiKey) {
  throw new Error("Missing MODELSCOPE_API_KEY.");
}

const commonHeaders = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

export async function startImageTask(prompt: string, model: string) {
  const response = await fetch(`${baseUrl}v1/images/generations`, {
    method: "POST",
    headers: {
      ...commonHeaders,
      "X-ModelScope-Async-Mode": "true",
    },
    body: JSON.stringify({ model, prompt }),
  });

  if (!response.ok) {
    throw new Error(`ModelScope 提交失败: ${response.status}`);
  }

  const data = (await response.json()) as { task_id?: string };
  if (!data.task_id) {
    throw new Error("ModelScope 返回缺少 task_id。");
  }

  return data.task_id;
}

export async function pollImageTask(
  taskId: string,
  {
    timeoutMs = 5 * 60 * 1000,
    intervalMs = 5 * 1000,
  }: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${baseUrl}v1/tasks/${taskId}`, {
      headers: {
        ...commonHeaders,
        "X-ModelScope-Task-Type": "image_generation",
      },
    });

    if (!response.ok) {
      throw new Error(`ModelScope 轮询失败: ${response.status}`);
    }

    const data = (await response.json()) as {
      task_status?: string;
      output_images?: string[];
    };

    if (data.task_status === "SUCCEED") {
      const imageUrl = data.output_images?.[0];
      if (!imageUrl) {
        throw new Error("ModelScope 返回成功但缺少图片。");
      }
      return imageUrl;
    }

    if (data.task_status === "FAILED") {
      throw new Error("ModelScope 生成失败。");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("ModelScope 生成超时。");
}
