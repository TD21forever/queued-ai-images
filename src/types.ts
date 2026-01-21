export type TaskStatus = "queued" | "processing" | "completed" | "failed";

export type TaskItem = {
  id: string | number;
  prompt: string;
  status: TaskStatus;
  imageUrl?: string | null;
  error?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};
