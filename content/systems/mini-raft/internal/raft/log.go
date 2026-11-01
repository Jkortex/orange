package raft

// LogEntry 代表 Raft 复制状态机中的一条日志指令
type LogEntry struct {
	Term    int         // 该条目被 Leader 创建时的任期号
	Index   int         // 条目在日志中的绝对递增索引
	Command interface{} // 交付给上层状态机执行的状态变更指令
}

// AppendEntriesRequest 领导人向从属节点同步日志的 RPC 请求体
type AppendEntriesRequest struct {
	Term         int
	LeaderID     int
	PrevLogIndex int
	PrevLogTerm  int
	Entries      []LogEntry
	LeaderCommit int
}

// AppendEntriesReply 从属节点响应领导人的结果
type AppendEntriesReply struct {
	Term    int
	Success bool
}
