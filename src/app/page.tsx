"use client";

import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TaskStatus, TaskItem } from "@/types";

const statusLabels: Record<TaskStatus, string> = {
  queued: "排队中",
  processing: "生成中",
  completed: "已完成",
  failed: "失败",
};

const formatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : formatter.format(date);
}

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskImage, setTaskImage] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<TaskItem[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user?.email ?? null);
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    let active = true;

    const poll = async () => {
      const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as TaskItem;
      if (!active) {
        return;
      }
      setTaskStatus(data.status);
      setTaskImage(data.imageUrl ?? null);
      setTaskError(data.error ?? null);
    };

    const interval = setInterval(poll, 3000);
    poll();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [taskId]);

  useEffect(() => {
    const loadHistory = async () => {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { tasks?: TaskItem[] };
      setHistory(data.tasks ?? []);
    };

    loadHistory();
  }, [taskId, userEmail]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setTaskError(null);
    setTaskImage(null);

    const response = await fetch("/api/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setTaskError(data?.error || "创建任务失败，请稍后再试。");
      return;
    }

    setTaskId(data.taskId);
    setTaskStatus(data.status);
  };

  // Sign-in with magic link
  const handleSignIn = async () => {
    if (!emailInput.trim()) {
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (!error) {
      setEmailSent(true);
    }
  };

  // Sign-out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setEmailSent(false);
  };

  const statusLabel = taskStatus ? statusLabels[taskStatus] ?? taskStatus : "未开始";

  return (
    <main className="relative min-h-screen overflow-hidden px-6 pb-24 pt-10 text-zinc-950">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,208,140,0.45),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-120px] top-32 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_center,rgba(127,191,202,0.4),transparent_70%)] blur-3xl animate-[floatSlow_14s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute left-[-140px] bottom-20 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle_at_center,rgba(244,160,90,0.35),transparent_70%)] blur-3xl animate-[floatSlow_18s_ease-in-out_infinite]" />

      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/20">
              <span className="font-display text-lg">PA</span>
            </div>
            <div>
              <p className="font-display text-2xl tracking-tight">提示词星图</p>
              <p className="text-sm text-zinc-500">
                带队列控制的异步文生图工作室。
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
            {userEmail ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="text-sm text-zinc-600">已登录：{userEmail}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-full border border-zinc-900/10 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-900/30 hover:text-zinc-900"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder="你@邮箱.com"
                  className="w-full rounded-full border border-zinc-200 bg-white/70 px-4 py-2 text-sm outline-none focus:border-zinc-900/40"
                />
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
                >
                  发送登录链接
                </button>
                {emailSent && (
                  <span className="text-xs text-zinc-500">请查收邮箱。</span>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-xl shadow-zinc-950/5 backdrop-blur animate-[fadeUp_800ms_ease-out]">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                  提示词工作台
                </p>
                <h1 className="font-display mt-3 text-4xl leading-tight text-zinc-900 md:text-5xl">
                  用一句话生成可用于宣传的图片。
                </h1>
                <p className="mt-4 max-w-xl text-base text-zinc-600">
                  每次提交都会进入队列。匿名用户每日 3 次，登录后不限次数。
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-white/90 p-5">
                <label className="text-sm font-medium text-zinc-700">提示词</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="例：漂浮在云端的未来茶室，暖金色光线。"
                  className="mt-3 h-28 w-full resize-none rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm leading-relaxed outline-none focus:border-zinc-900/40"
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    当前状态：<span className="text-zinc-900">{statusLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isSubmitting}
                    className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "提交中..." : "开始生成"}
                  </button>
                </div>
                {taskError && (
                  <p className="mt-3 text-sm text-rose-600">{taskError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-lg shadow-zinc-950/5 backdrop-blur animate-[fadeUp_900ms_ease-out]">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                当前任务
              </p>
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-200/80 bg-white/80 p-4 text-sm text-zinc-600">
                {taskId ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>任务 ID</span>
                      <span className="font-mono text-zinc-700">{taskId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>状态</span>
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-white">
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p>暂无任务，提交后将进入队列。</p>
                )}
              </div>
              {taskImage && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200/70">
                  <img src={taskImage} alt="生成结果" className="w-full" />
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-lg shadow-zinc-950/5 backdrop-blur animate-[fadeUp_1000ms_ease-out]">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                最近记录
              </p>
              <div className="mt-5 space-y-4">
                {history.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    暂无记录，生成结果会展示在这里。
                  </p>
                ) : (
                  history.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4"
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{formatDate(task.createdAt)}</span>
                        <span className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] uppercase tracking-wide">
                          {statusLabels[task.status] ?? task.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-zinc-700">
                        {task.prompt}
                      </p>
                      {task.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200/70">
                          <img
                            src={task.imageUrl}
                            alt="生成图片"
                            className="w-full"
                          />
                        </div>
                      )}
                      {task.error && (
                        <p className="mt-2 text-xs text-rose-600">
                          {task.error}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "队列调度",
              body: "每个请求都会进入 QStash 队列，确保稳定重试。",
            },
            {
              title: "异步生成",
              body: "模型在后台完成生成，前台实时更新状态。",
            },
            {
              title: "历史留存",
              body: "生成结果写入 Supabase，随时回看与复用。",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/60 bg-white/70 p-5 text-sm text-zinc-600 shadow-md shadow-zinc-950/5 backdrop-blur"
            >
              <p className="font-display text-lg text-zinc-900">
                {item.title}
              </p>
              <p className="mt-2">{item.body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
