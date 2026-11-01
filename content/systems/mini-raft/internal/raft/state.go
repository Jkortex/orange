package raft

import (
	"sync"
	"time"
)

// Role 代表节点在集群中所处的状态角色
type Role string

const (
	Follower  Role = "Follower"
	Candidate Role = "Candidate"
	Leader    Role = "Leader"
)

// RaftNode 代表单个共识节点实例
type RaftNode struct {
	mu sync.Mutex

	// 基础网络标识
	id    int
	peers []int

	// 持久化状态 (Persistent State)
	currentTerm int
	votedFor    int
	log         []LogEntry

	// 易失性状态 (Volatile State)
	role        Role
	commitIndex int
	lastApplied int

	// 选举与心跳时钟控制
	heartbeatResetCh chan struct{}
	stopCh           chan struct{}
}

// NewRaftNode 初始化一个默认处于 Follower 角色的 Raft 节点
func NewRaftNode(id int, peers []int) *RaftNode {
	return &RaftNode{
		id:               id,
		peers:            peers,
		currentTerm:      0,
		votedFor:         -1,
		log:              make([]LogEntry, 0),
		role:             Follower,
		commitIndex:      0,
		lastApplied:      0,
		heartbeatResetCh: make(chan struct{}, 1),
		stopCh:           make(chan struct{}),
	}
}

// GetStatus 获取节点的当前角色与任期（并发安全）
func (rn *RaftNode) GetStatus() (Role, int) {
	rn.mu.Lock()
	defer rn.mu.Unlock()
	return rn.role, rn.currentTerm
}
