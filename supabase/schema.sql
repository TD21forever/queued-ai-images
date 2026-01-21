-- Supabase 图像生成任务数据库架构
-- 在 Supabase SQL 编辑器中运行此脚本

-- 创建任务状态枚举类型
create type task_status as enum ('queued', 'processing', 'completed', 'failed');

-- 创建任务表：存储图像生成任务
create table if not exists public.tasks (
  id bigserial primary key,                                 -- 任务 ID（自增）
  user_id uuid references auth.users (id),                 -- 关联用户 ID
  anon_id text,                                             -- 匿名用户 ID
  prompt text not null,                                     -- 图像生成提示词
  status task_status not null default 'queued',             -- 任务状态：排队中、处理中、已完成、失败（枚举类型）
  model text,                                               -- 使用的 AI 模型
  image_url text,                                           -- 生成的图像 URL
  error text,                                               -- 错误信息
  created_at timestamptz not null default now(),            -- 创建时间
  updated_at timestamptz not null default now(),            -- 更新时间
  completed_at timestamptz                                  -- 完成时间
);

-- 创建索引：按用户 ID 和创建时间降序查询优化
create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

-- 创建索引：按匿名用户 ID 和创建时间降序查询优化
create index if not exists tasks_anon_id_created_at_idx
  on public.tasks (anon_id, created_at desc);

-- 启用行级安全（RLS）：确保用户只能访问自己的数据
alter table public.tasks enable row level security;

-- 创建查询策略：已认证用户只能查询自己的任务
create policy "tasks_select_own"
  on public.tasks
  for select
  to authenticated
  using (user_id = auth.uid());

-- 创建插入策略：已认证用户只能插入自己的任务
create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 创建更新策略：已认证用户只能更新自己的任务
create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using (user_id = auth.uid());
