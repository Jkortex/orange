---
title: 时间轮（TimeWheel）方案设计
date: '2025-05-24'
tags:
  - Go
  - 架构
  - 并发
  - 时间轮
  - 长轮询
category: engineering
description: 用 80 行代码支撑 IM 服务端十万级并发长轮询超时管理
---
## 背景：IM 长轮询的超时管理问题

一个极简 IM 服务端，使用 **HTTP 长轮询** 实现实时消息同步：

1. 客户端调用 `/sync?userId=xxx&lastId=N`
2. 有新消息 → 立即返回
3. 无新消息 → 连接挂起等待，**最多等 20 秒**，超时返回空

核心问题：**如何高效管理几十万个长轮询请求的 20 秒超时？**

---

## 常见方案及其问题

### 方案一：每个请求一个 `time.Timer`（Go 原生的堆式定时器）

Go 用四叉堆管理 Timer，插入/删除都是 **O(log n)**。10 万并发时堆操作成为瓶颈。

### 方案二：定时扫表

每秒遍历全部请求，大部分请求在 20 秒内已被消息唤醒，遍历是**空转浪费**。

---

## 时间轮方案

### 数据结构

时间轮是一个 **环状数组** + Ticker，指针以固定间隔向前移动，每次处理当前槽位的任务。

```
                    slot 0
                 ┌─────────┐
      slot 3599  │  list   │  slot 1
          ┌──────┤         ├──────┐
          │      └─────────┘      │
          │                       │
          │        ......         │
          │                       │
          │      ┌─────────┐      │
      ┌───┴──────┤         ├──────┴───┐
      │          │  list   │          │
      │   slot   │         │   slot   │
      │  1799    └─────────┘   1800   │
      │                               │
      └───────────────────────────────┘
                   ▲
                   │
               currentPos
```

### 核心参数

| 参数       | 本项目取值 | 含义                 |
| ---------- | ---------- | -------------------- |
| `interval` | 100ms      | tick 间隔            |
| `slotNum`  | 3600       | 槽位数量             |
| 一圈时长   | 6 分钟     | `interval × slotNum` |

### 跨周期任务（circle 圈数）

如果延迟超过一圈长度，使用 circle 字段记录剩余圈数：

```
delay = 30 × 60s = 1800s
steps = 1800s / 100ms = 18000 步
circle = 18000 / 3600 = 5 圈
pos   = (currentPos + 18000) % 3600
```

每次指针经过槽位只 `circle--`，减到 0 才执行任务。

### 核心代码

```go
type TimeWheel struct {
    interval    time.Duration
    ticker      *time.Ticker
    slots       []*list.List    // 环状数组
    currentPos  int
    slotNum     int
    addTaskChan chan *Task      // 串行化写入
}
```

O(1) 插入 —— 计算位置直接尾插链表：

```go
func (tw *TimeWheel) addTaskHandler(task *Task) {
    steps := int(task.delay / tw.interval)
    task.circle = steps / tw.slotNum
    pos := (tw.currentPos + steps) % tw.slotNum
    tw.slots[pos].PushBack(task)
}
```

每次 tick 扫描当前槽位，圈数未归零的只减圈数，归零才执行：

```go
func (tw *TimeWheel) tickHandler() {
    l := tw.slots[tw.currentPos]
    for e := l.Front(); e != nil; {
        task := e.Value.(*Task)
        if task.circle > 0 {
            task.circle--
            e = e.Next()
            continue
        }
        go task.job()   // 异步执行，不阻塞 tick
        next := e.Next()
        l.Remove(e)
        e = next
    }
    tw.currentPos = (tw.currentPos + 1) % tw.slotNum
}
```

---

## 长轮询中的具体应用

### SyncHandler 流程

```
客户端 ───GET /sync?userId=B&lastId=0───→  Server
                                           │
                                           ├─ 有新消息？→ 立即返回
                                           │
                                           └─ 无 → 注册 waiter
                                                  └─ timewheel.Add(20s, wakeup)
                                           │
                                           ▼  (挂起等待)
                                     ┌──────────┐
                                     │  notify  │ ← 消息到来时触发
                                     │    OR    │ ← 时间轮超时触发
                                     │  timeout │
                                     └──────────┘
                                           │
                                           ▼  返回 SyncState
```

```go
func (s *Server) SyncHandler(w http.ResponseWriter, r *http.Request) {
    state := s.store.GetSyncState(userID, lastID)
    if len(state.Messages) > 0 || len(state.Typing) > 0 {
        s.jsonResponse(w, state)    // 有数据立即返回
        return
    }

    notifyChan := make(chan struct{}, 1)
    s.addWaiter(userID, notifyChan)  // 注册等待者

    s.timewheel.Add(20*time.Second, func() {
        notifyChan <- struct{}{}    // 超时唤醒
    })

    <-notifyChan                     // 阻塞等待
    s.removeWaiter(userID, notifyChan)

    state = s.store.GetSyncState(userID, lastID)
    s.jsonResponse(w, state)
}
```

### 消息到达 → 通知等待者

```go
func (s *Server) HandleSend(senderID, receiverID, content string) interface{} {
    msg := s.store.SendMessage(senderID, receiverID, content)
    s.notifyAll(receiverID)   // 唤醒接收者
    s.notifyAll(senderID)     // 唤醒发送者（多设备同步）
    return msg
}

func (s *Server) notifyAll(userID string) {
    s.mu.Lock()
    waiters := s.waiters[userID]
    delete(s.waiters, userID)     // 全部取出
    s.mu.Unlock()

    for _, ch := range waiters {
        select {
        case ch <- struct{}{}:
        default:                  // 防阻塞
        }
    }
}
```

> **设计取舍**：waiter 被消息唤醒后，时间轮的超时任务仍在槽位中，最终会执行一次空唤醒（向已消费的 channel 发送）。因为 channel 带 1 缓冲，不会阻塞。用少数空唤醒换 O(1) 插入和简洁的代码。

---

## 性能对比

| 操作     | 时间轮                 | Go `time.Timer` 堆 | 定时扫表 |
| -------- | ---------------------- | ------------------ | -------- |
| 插入     | **O(1)**               | O(log n)           | O(1)     |
| 删除     | **O(1)**               | O(log n)           | O(1)     |
| 每次执行 | O(k)（k=当前槽任务数） | O(log n)           | O(n)     |
| 内存     | O(slotNum + n)         | O(n)               | O(n)     |

**10 万并发场景下**：

- `time.Timer`：每次插入 ~17 次比较（log₂10万）
- 时间轮：1 次取模 + 1 次链表尾插

---

## 优缺与改进方向

### 优势

- 实现简单，核心不到 80 行
- 无锁设计（通过 channel 串行化写入）
- 异步执行（`go task.job()`），不阻塞 tick
- 仅依赖 Go 标准库

### 改进方向

| 问题         | 当前方案                  | 改进                                      |
| ------------ | ------------------------- | ----------------------------------------- |
| 任务无法取消 | 超时任务最终空执行一次    | 引入 taskID 映射表，circle 置 -1 标记删除 |
| 固定精度     | 100ms tick 对长短任务一致 | 分级时间轮（秒级轮 + 毫秒级轮）           |
| 任务堆积     | 一个槽任务过多可能超 tick | 限制单次处理数，分拆到后续 tick           |

---

## 总结

时间轮在这里解决的核心问题是：**大量并发长轮询的超时管理**。

它不追求极致精度（±100ms 对 IM 超时绰绰有余），而是追求极致的**并发友好度**——O(1) 插入、无锁设计、异步执行。在十万级并发下相比 Go 内置 `time.Timer` 的四叉堆优势明显。

这 80 行代码一旦搭建好，除了长轮询超时，还可以复用于：

- 定时消息 / 定时发送
- 会话过期清理
- 心跳超时检测
- 浏览状态自动过期

用最小的成本，撑起整个 IM 服务端的延迟任务调度。这就是时间轮的工程之美。
