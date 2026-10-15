---
title: 分布式 IM 系统设计探讨（视频版）：5 分钟跑通书里的架构
date: 2026-10-15
description: 把「分布式 IM 系统设计探讨」五部曲讲成一支持 5 分钟的视频：从容量估算、双服务架构，到四个关键取舍（消息存储、保序、消息不丢、实时扇出），最后实机演示两个客户端实时收发与落库对账。
category: architecture
tags:
  - 分布式系统
  - 即时通讯
  - 系统设计
  - Kafka
  - PostgreSQL
  - 视频
---

前面的五部曲把设计拆开讲透了，但**"读懂"和"跑起来"是两回事**。这一篇配一支约 5 分钟的视频：它不只是念设计稿，而是把 Kafka / PostgreSQL / Redis 真实跑起来，现场演示两个客户端实时收发，并在最后做一次**落库对账**——消息带着 Kafka 的分区与 offset 落到表里，和 broker 上的记录完全一致。

:::video
src: /media/posts/slack-design-demo.mp4
poster: /media/posts/slack-design-demo.jpg
title: 分布式 IM 系统设计 · 视频导览
约 5 分钟：架构总览 + 四个关键取舍 + 实机演示。
:::

## 视频讲了什么

| 时间 | 内容 | 对应文章 |
| --- | --- | --- |
| 00:00 | 一句话定位：把书里的架构真正跑起来 | —— |
| 00:19 | 需求与容量估算：10M DAU → 0.9 PB / 5 年 | —— |
| 00:43 | 架构总览：两个服务、五条链路 | —— |
| 01:17 | 取舍 ① 消息存储：Postgres 复合索引 vs 真实宽列 | [（五）存储与分片](/posts/2026-10-14-im-storage-sharding-and-wide-column-evolution) |
| 01:50 | 取舍 ② 保序与分区：key = channel_id，offset 权威 | [（二）保序与未读](/posts/2026-10-14-im-message-ordering-and-clock-skew) |
| 02:24 | 取舍 ③ 消息不丢：同步写 Kafka + 四层防线 | [（一）可靠性契约](/posts/2026-10-14-im-message-reliability-and-persistence) |
| 03:04 | 取舍 ④ 实时扇出：每实例独立消费组 = 广播 | [（三）长连接网关](/posts/2026-10-14-im-websocket-gateway-and-fanout-governance) |
| 03:35 | 实机演示：两客户端实时收发 + 落库对账 | [（四）在线状态与断线自愈](/posts/2026-10-14-im-presence-state-and-reconnection-recovery) |
| 04:08 | 瓶颈与延伸：多区域、真归档、浏览器 UI | —— |

## 四个取舍，各自"贵"在哪

视频里刻意没有念代码，而是每个取舍都走同一条叙事线：**书里怎么做 → 我怎么做 → 代价是什么**。

- **消息存储**：书里用 Cassandra；本机内存有限，改用 PostgreSQL 的复合索引等价实现"按频道分区、按时间聚簇"的有序范围读，同时把存储抽象成端口——`MESSAGE_STORE=scylla` 就能切到真实宽列，上层代码一行不改。
- **保序**：书里说"一个频道一个分区"，真实 Kafka 做不到。退而求其次：把 `channel_id` 当 key 哈希分区，同频道必落同分区；排序以分区内 offset 为唯一权威，从而对物理时钟漂移免疫。
- **消息不丢**：发送同步写 Kafka（`RequiredAcks=all`）才返回成功，宁可 5xx 让客户端重试也不做乐观确认；再叠加"落库持久化 / 断点续读 / 离线推送 / 客户端补齐"四层，共用 `message_id` 去重。
- **实时扇出**：Kafka 消费组是负载均衡语义，多实例共用会互相抢消息；改成每实例唯一组 id 实现广播，扇出走异步有界队列，慢客户端不阻塞消费循环。

## 复现这支视频

视频里的实机部分是一条可复现的脚本，仓库在 `design/slack`：

```bash
make up && make health      # 三个中间件容器
make migrate && make seed && make topics
make run-web                # REST :8080
make run-rtim               # WebSocket :8000
# 两个终端各起一个 CLI，登录 alice / bob 互发
make run-cli ARGS=alice
make run-cli ARGS=bob
```

视频本身由 `video/` 目录下的脚本生成：Marp 渲染幻灯片、d2 画架构图、`asciinema` 录终端、`edge-tts` 配音、`ffmpeg` 合成——全程可重跑，改词不用重录画面。

> 一句话总结：这套系统的价值不在功能全，而在**架构真的跑通了，且每个取舍都说得清为什么**。
