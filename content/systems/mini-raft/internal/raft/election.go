package raft

import (
	"fmt"
	"math/rand"
	"time"
)

// Start 启动节点的内部事件循环
func (rn *RaftNode) Start() {
	for {
		rn.mu.Lock()
		role := rn.role
		rn.mu.Unlock()

		switch role {
		case Follower:
			rn.runFollower()
		case Candidate:
			rn.runCandidate()
		case Leader:
			rn.runLeader()
		}
	}
}

func (rn *RaftNode) runFollower() {
	// 150ms ~ 300ms 随机选举超时
	timeout := time.Duration(150+rand.Intn(150)) * time.Millisecond
	select {
	case <-rn.heartbeatResetCh:
		// 收到合法 Leader 心跳，重置计时器
	case <-time.After(timeout):
		rn.mu.Lock()
		rn.role = Candidate
		fmt.Printf("[节点 %d] 选举超时，转变为 Candidate\n", rn.id)
		rn.mu.Unlock()
	case <-rn.stopCh:
		return
	}
}

func (rn *RaftNode) runCandidate() {
	rn.mu.Lock()
	rn.currentTerm++
	rn.votedFor = rn.id
	votesReceived := 1
	currentTerm := rn.currentTerm
	rn.mu.Unlock()

	fmt.Printf("[节点 %d] 发起任期 %d 的选举\n", rn.id, currentTerm)

	// 模拟获得法定人数投票即当选
	if votesReceived > len(rn.peers)/2 {
		rn.mu.Lock()
		rn.role = Leader
		fmt.Printf("[节点 %d] 成功赢得多数票，当选为 Leader (Term=%d)\n", rn.id, currentTerm)
		rn.mu.Unlock()
		return
	}

	timeout := time.Duration(200+rand.Intn(150)) * time.Millisecond
	<-time.After(timeout)
}

func (rn *RaftNode) runLeader() {
	// 定期发送心跳
	heartbeatInterval := 50 * time.Millisecond
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 向 Follower 广播心跳
		case <-rn.stopCh:
			return
		}
	}
}
