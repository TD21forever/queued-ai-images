# API 接口文档

## 1. 创建图像生成任务

### 接口信息
- **URL**: `POST /api/tasks/create`
- **功能**: 创建新的图像生成任务，加入队列

### 请求参数
```json
{
  "prompt": "A futuristic tea lounge floating above the clouds..."
}
```

### 响应示例
```json
{
  "taskId": 1,
  "status": "queued"
}
```

### 测试用例

#### 成功创建任务
```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains"
  }'
```

#### 缺少 prompt
```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H "Content-Type: application/json" \
  -d '{}'

# 响应: { "error": "Prompt is required." }, 400
```

#### 匿名用户超限（3次/天）
```bash
# 连续调用4次，第4次返回
# { "error": "Daily limit reached." }, 429
```

---

## 2. 获取任务列表

### 接口信息
- **URL**: `GET /api/tasks`
- **功能**: 获取当前用户的任务历史（最近20条）

### 请求参数
- 无参数（根据用户会话自动识别）

### 响应示例
```json
{
  "tasks": [
    {
      "id": 2,
      "prompt": "A futuristic tea lounge",
      "status": "completed",
      "imageUrl": "https://example.com/image.jpg",
      "error": null,
      "createdAt": "2026-01-21T10:30:00Z",
      "completedAt": "2026-01-21T10:32:00Z"
    },
    {
      "id": 1,
      "prompt": "A beautiful sunset",
      "status": "processing",
      "imageUrl": null,
      "error": null,
      "createdAt": "2026-01-21T10:00:00Z",
      "completedAt": null
    }
  ]
}
```

### 测试用例

#### 匿名用户获取任务
```bash
curl http://localhost:3000/api/tasks \
  --cookie-jar cookies.txt
```

#### 已登录用户获取任务
```bash
# 需要先登录获取 session cookie
curl http://localhost:3000/api/tasks \
  -H "Cookie: sb-access-token=your_token"
```

---

## 3. 获取单个任务状态

### 接口信息
- **URL**: `GET /api/tasks/{taskId}`
- **功能**: 查询指定任务的详细状态和结果

### 请求参数
- `taskId`: 任务ID（路径参数）

### 响应示例
```json
{
  "id": 1,
  "prompt": "A futuristic tea lounge",
  "status": "completed",
  "imageUrl": "https://example.com/image.jpg",
  "error": null,
  "createdAt": "2026-01-21T10:30:00Z",
  "completedAt": "2026-01-21T10:32:00Z"
}
```

### 测试用例

#### 查询存在的任务
```bash
curl http://localhost:3000/api/tasks/1 \
  --cookie cookies.txt
```

#### 查询不存在的任务
```bash
curl http://localhost:3000/api/tasks/999

# 响应: { "error": "Task not found." }, 404
```

#### 访问他人的任务
```bash
# 使用不同的匿名ID或用户ID
# 响应: { "error": "Forbidden." }, 403
```

---

## 4. Worker 处理任务

### 接口信息
- **URL**: `POST /api/worker/generate`
- **功能**: 处理图像生成任务（由 QStash 调用）
- **权限**: 需要 QStash 签名验证

### 请求参数
```json
{
  "taskId": 1
}
```

### 响应示例
```json
{
  "ok": true,
  "status": "completed"
}
```

### 测试用例
*此接口需要 QStash 签名，无法直接测试，由 QStash 自动调用*

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 403 | 权限不足（访问他人的任务） |
| 404 | 任务不存在 |
| 429 | 匿名用户超限 |
| 500 | 服务器内部错误 |
| 502 | 队列服务异常 |

## 任务状态

| 状态 | 说明 |
|------|------|
| queued | 排队中 |
| processing | 处理中 |
| completed | 已完成 |
| failed | 失败 |

## 限流规则

| 用户类型 | 限制 |
|----------|------|
| 匿名用户 | 3次/天 |
| 已登录用户 | 无限制 |
