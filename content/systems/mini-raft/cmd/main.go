package main

import (
	"fmt"
	"time"

	"mini-raft/internal/raft"
)

func main() {
	fmt.Println("=== 启动 Mini-Raft 三节点本地仿真环境 ===")

	peers := []int{1, 2, 3}
	nodes := make(map[int]*raft.RaftNode)

	for _, id := range peers {
		nodes[id] = raft.NewRaftNode(id, peers)
		go nodes[id].Start()
	}

	// 观察 3 秒内的选举过程与心跳流转
	time.Sleep(3 * time.Second)

	fmt.Println("=== 集群选举结果检查 ===")
	for id, node := range nodes {
		role, term := node.GetStatus()
		fmt.Printf("节点 %d: 角色=%s, 当前任期=%d\n", id, role, term)
	}
}
