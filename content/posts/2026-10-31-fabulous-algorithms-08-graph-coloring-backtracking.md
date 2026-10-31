---
title: "数据结构与算法的奇妙冒险（八）：基于回溯搜索的图染色算法"
date: 2026-10-31T01:08:00Z
description: "通过深度优先回溯搜索解决图染色问题，探讨启发式剪枝策略与约束满足问题（CSP）求解技巧。"
category: algorithms
column: fabulous-algorithms
tags: [图论, 图染色, 回溯算法, 深度优先搜索, 剪枝]
---

# 第 8 章 基于回溯搜索的图染色算法

### 本章要点

- 地图着色的奇妙应用
- 简单设计的收益
- 回溯搜索算法
- 多重字典（Multidictionary）数据结构

图论——研究由若干节点通过若干边相互连接所形成结构的数学分支——是组合数学的核心组成部分，对计算机编程产生了深远的影响。在本章中，我们将探讨图论中的一个经典问题：给定一定数量的颜色以及一个图，我们能否为每个节点分配一种颜色，使得任意两个相邻节点（即直接由一条边相连的两个节点）永远不同色？如果能，又该如何求解？

节点染色问题与许多现实世界的问题直接相关，例如地图区域着色、数独游戏求解，以及编译器中的避免寄存器溢出（register spilling）。

尽管实现细节可能较为复杂，但回溯搜索算法在核心思想上是一种极其朴素的问题求解策略：先对解做出一个猜测，然后检查猜测是否正确；如果猜错了，就回退一步并尝试其他猜测；如此重复，直到穷尽所有猜测或找到正确解为止。

在本章中，我们将运用回溯搜索算法解决图染色问题，并构建一个通用的回溯引擎，用于求解其他类似的回溯问题。我们还将再次充分利用不可变数据结构的威力，不可变结构天然契合回溯搜索的场景。

> **注意**  
> 图论学者通常更习惯使用“顶点”（vertex）而非“节点”（node），但二者指代相同。在整本书中，我们将统一使用“节点”。

---

## 8.1 为南美洲地图着色

观察南美洲地图，特别是阿根廷、玻利维亚、巴西和巴拉圭这四个国家。如果希望为这张地图上的各个国家着色，使得接壤的国家不会拥有相同的颜色，你至少需要四种颜色，因为这四个国家两两相互接壤，如图 8.1 所示。

![](/media/posts/fabulous-algorithms/img-01934.jpeg)

**图 8.1 南美洲地图中，四个国家两两相互接壤（来源：Wikimedia Commons，基于 CC BY-SA 4.0 许可协议）**

给定平面或球面上任意划分的区域地图，为了避免相邻区域同色，理论上最少需要多少种颜色？我们已经看到南美洲至少需要四种。是否存在只能用五种或更多颜色才能完成染色的地图？数学家们对这个著名的问题探索了数十年，终于在 20 世纪后期证明了：**四种颜色足以为任意平面地图着色**（即著名的“四色定理”）。

在实际绘制政治地图时，我们往往会使用超过四种颜色，原因有二：
- 如果我们将海洋通常使用的蓝色也算作四种颜色之一，那么仅用四种颜色为南美洲染色就必须将玻利维亚或巴拉圭中的一个涂成蓝色，这在地理视觉上显得非常奇怪。
- 政治归属关系会引入很多着色约束。例如，法属圭亚那属于法国领土，因此从法律主权角度来看，法国与巴西接壤。在世界地图中，我们可能希望法国与法属圭亚那保持同一种颜色。这类由于非连通政治区域而增加着色约束的地图，可能需要四种以上的颜色。

为了编写程序解决这一问题，我们需要一种更严谨、更具数学性的视角，将政治与地理细节抽象剥离。我们所采用的抽象数据类型（ADT）是**不可变无向图**（immutable undirected graph）：其中节点代表区域，边连接相邻且不能同色的区域。

> **注意**  
> 如果边是有方向的箭头，能够区分“源”节点和“目标”节点，则称为**有向图**（directed graph）。在**无向图**（undirected graph）中，我们只关心两个节点之间是否存在边相连。

接下来，我们将尝试为每个节点关联一种颜色以完成染色。但在此之前，我们需要一种数据结构来表示不可变图。

---

## 8.2 不可变多重字典

我们在图上执行的操作非常直观：添加和删除节点与边、检查给定节点或边是否存在于图中，以及列出与给定节点相邻的所有节点。实现这个 ADT 应该采用什么数据结构？

假设一个图拥有 $n$ 个节点和 $e$ 条边。经典的表示方案有三种：
- **关联矩阵（Incidence matrix）**：为每个节点分配从 $0$ 到 $n-1$ 的索引，为每条边分配从 $0$ 到 $e-1$ 的索引。创建一个 $n 	imes e$ 的位数组（bit array）。如果编号为 $x$ 的节点是编号为 $y$ 的边的端点之一，则将 $[x, y]$ 处的位设为 1。
- **邻接矩阵（Adjacency matrix）**：创建一个 $n 	imes n$ 的位数组。如果编号为 $x$ 和 $y$ 的两个节点共享一条边，则将 $[x, y]$ 处的位设为 1。
- **邻接字典（Adjacency dictionary）**：创建一个字典，键是节点，对应的值是与其相邻的节点集合。这类字典通常被称为**多重字典（multidictionary）**，因为它将一个键映射到由零个或多个值组成的集合，而不是单一值。

每种选择在构建不可变数据结构时各有优劣。在第 4 章中我们看到，可以通过记忆化四叉树构建大型持久不可变位数组，因此前两种方案是可行的。然而，我们在本章后文出于其他目的也需要多重字典，无论如何都必须实现一个。因此，我们选择使用字典方案来表示不可变图。

如果从头开发一个不可变字典，会分散对图数据结构与算法核心的注意力，因此我们将直接使用 .NET 运行时 `System.Collections.Immutable` 命名空间中的 `ImmutableDictionary` 类。遗憾的是，运行时并没有现成开箱即用的不可变多重字典。我向来主张只编写精确满足问题所需特性的类型，因此让我们通过包装标准不可变字典来构建一个支持多值的包装类型：该字典将每个键与一个不可变的值集合关联起来。实现它并不需要太多代码。

**代码清单 8.1 通过包装常规字典实现多重字典**

```csharp
readonly struct ImMulti<K, V> where K : notnull where V : notnull
{
    private readonly ImmutableDictionary<K, ImmutableHashSet<V>> dict;

    public static ImMulti<K, V> Empty =
        new(ImmutableDictionary<K, ImmutableHashSet<V>>.Empty);

    private ImMulti(ImmutableDictionary<K, ImmutableHashSet<V>> dict) =>
        this.dict = dict;

    public bool IsEmpty => dict.IsEmpty;
    public bool ContainsKey(K k) => dict.ContainsKey(k);
    public bool HasValue(K k, V v) =>
        dict.ContainsKey(k) && dict[k].Contains(v);

    public IEnumerable<K> Keys => dict.Keys;
    public ImmutableHashSet<V> this[K k] => dict[k];

    public ImMulti<K, V> SetItem(K k, ImmutableHashSet<V> vs) =>
        new(dict.SetItem(k, vs));

    public ImMulti<K, V> SetSingle(K k, V v) =>
        dict.SetItem(k, ImmutableHashSet<V>.Empty.Add(v));

    public ImMulti<K, V> SetEmpty(K k) =>
        dict.SetItem(k, ImmutableHashSet<V>.Empty);

    public ImMulti<K, V> Add(K k, V v) =>
        ContainsKey(k) ?
            new(dict.SetItem(k, dict[k].Add(v))) :
            SetSingle(k, v);

    public ImMulti<K, V> Remove(K k) => new(dict.Remove(k));

    public ImMulti<K, V> Remove(K k, V v) =>
        new(dict.SetItem(k, dict[k].Remove(v)));
}
```

分析该实现的细节：
- `IsEmpty`、`ContainsKey`、`Keys`、索引器、`SetItem` 以及 `Remove(K)` 成员只是单纯地将调用转发给底层字典。
- `HasValue(K, V)` 检查键是否存在于字典中；若存在，再检查值是否存在于对应的值集合中。
- `Add(K, V)` 和 `Remove(K, V)` 成员实现了多重字典的专属逻辑，确保正确更新关联的值集合。
- 我们还实现了辅助方法 `SetSingle` 和 `SetEmpty`，因为这类操作足够常见，值得单独封装。

不可变字典和不可变哈希集合中的所有添加、删除和查找操作都是 $O(1)$ 的，因此几乎无需复杂的性能分析。无论规模多大，字典和集合的操作成本都很低。

---

## 8.3 不可变无向图

现在我们拥有了不可变多重字典类型，完全可以直接用它来表示图：让字典的每个键作为节点，对应的值集合作为与其相邻的节点。我们还需要再定义一个专属类型吗？

答案是肯定的，原因有三：
1. **良好的数据类型应当强制维护不变量（invariants）。** 仅使用多重字典极易构建出破坏无向图规则的数据：

```csharp
var badGraph = ImMulti<string, string>.Empty
    .Add("Paraguay", "Brazil")
    .Add("Brazil", "Bolivia");
```

如果键代表节点，那么巴拉圭和巴西是仅有的节点。玻利维亚不是字典的键，因此它不是节点，但莫名其妙地成了巴西的邻居。如果你查询巴拉圭的邻居，会得到巴西；但巴西的邻居中却不包含巴拉圭——这意味着该图并不是无向图。这会导致逻辑混乱。专门的图类型能够强制执行图的规则，确保只能构造合法的图。

2. **字典在概念上是键值存储系统，而图在概念上是由边相连的节点集合。** 类型的成员命名应该清晰传达类型的用途。在处理节点和边时使用键值存储的术语，会造成不必要的认知负担。
3. **在实现图等抽象数据类型时，我们希望隐藏具体实现细节。** 如果将来决定改用邻接矩阵重构图，调用方代码无需做任何修改。

正如我们将 `ImMulti<K, V>` 作为字典的轻量包装一样，我们将 `ImGraph<N>` 设计为 `ImMulti<N, N>` 的轻量包装。通过引入泛型，我们可以为节点自由选择类型。我们需要提供添加、删除和遍历节点与边的成员，以及检查节点或边是否存在的方法。我们还会添加一个便利特性——团（Clique），后文会用到它。

在社交网络中，**团**（clique）是指一群两两互为朋友的人；在图论中，**团**是指一组节点，其中任意两个节点之间都存在一条边相连。正如我们很快会看到的，南美洲两两接壤的阿根廷、玻利维亚、巴西和巴拉圭在转化为图后便构成了一个团。

**代码清单 8.2 包装多重字典实现的不可变无向图**

```csharp
readonly struct ImGraph<N> where N : notnull
{
    public static ImGraph<N> Empty = new(ImMulti<N, N>.Empty);
    private readonly ImMulti<N, N> nodes;
    private ImGraph(ImMulti<N, N> ns) => this.nodes = ns;

    public bool IsEmpty => nodes.IsEmpty;
    public bool HasNode(N n) => nodes.ContainsKey(n);
    public bool HasEdge(N n1, N n2) => nodes.HasValue(n1, n2);
    public IEnumerable<N> Nodes => nodes.Keys;
    public ImmutableHashSet<N> Edges(N n) => nodes[n];

    public ImGraph<N> AddNode(N n) =>
        HasNode(n) ?
            this :
            new(nodes.SetItem(n, ImmutableHashSet<N>.Empty));

    public ImGraph<N> AddEdge(N n1, N n2) =>
        new(nodes.Add(n1, n2).Add(n2, n1));

    public ImGraph<N> RemoveEdge(N n1, N n2) =>
        new(nodes.Remove(n1, n2).Remove(n2, n1));

    public ImGraph<N> RemoveNode(N n)
    {
        var result = this;
        foreach (var n2 in Edges(n))
            result = result.RemoveEdge(n, n2);
        return new(result.nodes.Remove(n));
    }

    public ImGraph<N> AddEdges(N n1, IEnumerable<N> ns)
    {
        var result = this;
        foreach (var n2 in ns)
            result = result.AddEdge(n1, n2);
        return result;
    }

    public ImGraph<N> AddClique(IList<N> ns)
    {
        var result = this;
        for (int i = 0; i < ns.Count; i += 1)
            for (int j = i + 1; j < ns.Count; j += 1)
                result = result.AddEdge(ns[i], ns[j]);
        return result;
    }
}
```

这个针对多重字典的轻量包装维护了图的不变量，并且成员使用了图、节点和边的专业术语：
- `AddNode` 检查节点是否已是字典中的键。如果是，直接返回；如果不是，添加一个新键并赋以空集合，因为新节点暂无连接边。
- `AddEdge` 将两个节点分别添加到对方的邻接集合中，维护了无向图的不变量：若存在从 `n1` 到 `n2` 的边，必然存在从 `n2` 到 `n1` 的边。若这两个节点尚不在图中，它们会自动成为字典的键（即图的节点）。
- `RemoveNode` 在删除节点前先移除该节点的所有边，以维持图的不变量，因此其时间复杂度为 $O(e)$，其中 $e$ 是被移除的边的数量。
- `AddEdges` 是一个辅助方法，用于一次性添加多条连接到同一节点的边。我们将在 8.4 节看到其用武之地。
- `AddClique` 在列表中的任意两个节点之间添加边，其耗时关于列表大小呈 $O(n^2)$。按索引遍历这些节点最为方便，因此我们要求团以带索引的列表形式传入。我们将在 8.5 节处理包含大量团的图。

现在，我们终于拥有了可以表示图的数据结构。接下来让我们构建南美洲图，并给出一个简单的递归染色算法。

---

## 8.4 简单图染色

图染色是组合数学中研究最深入的问题之一，积累了海量的学术文献。幸运的是，对于许多图染色问题，一个简单的递归算法便足以胜任。

用四种颜色为南美洲地图着色就是一个很好的例子。我们首先构建一个图，其中每个节点是一个国家，相邻国家对应相邻节点（图 8.2）。我们还创建了一个包含四种颜色的集合，如下代码所示：

**代码清单 8.3 南美洲图与其颜色集合**

```csharp
var southAmerica = ImGraph<string>.Empty
    .AddNode("Falkland Islands")
    .AddEdges("French Guiana", ["Brazil", "Suriname"])
    .AddEdges("Suriname", ["Brazil", "Guyana"])
    .AddEdges("Guyana", ["Brazil", "Venezuela"])
    .AddEdges("Venezuela", ["Brazil", "Colombia"])
    .AddEdges("Colombia", ["Brazil", "Peru", "Ecuador"])
    .AddEdges("Peru", ["Brazil", "Ecuador", "Bolivia", "Chile"])
    .AddEdges("Chile", ["Bolivia", "Argentina"])
    .AddEdges("Bolivia", ["Brazil", "Paraguay", "Argentina"])
    .AddEdges("Paraguay", ["Brazil", "Argentina"])
    .AddEdges("Argentina", ["Brazil", "Uruguay"])
    .AddEdge("Uruguay", "Brazil");

var colors = ImmutableHashSet<Color>.Empty
    .Add(Color.Red).Add(Color.Yellow)
    .Add(Color.Green).Add(Color.Purple);
```

如果给你四支不同颜色的记号笔，要求你为该图着色且相邻节点不同色，你会怎么做？

你首先注意到的可能是：福克兰群岛选什么颜色都无所谓。因为福克兰群岛是一个度数为 0 的节点（节点的**度数**是与其相连的边的数量），你可以为它挑选任意颜色，完全不用担心产生冲突。

你可能还会注意到，低度数节点（智利、厄瓜多尔、福克兰群岛、法属圭亚那、圭亚那、巴拉圭、苏里南、乌拉圭和委内瑞拉）具有一个很有用的性质：**它们可以放在最后染色**。只要它们是最后一个被分配颜色的，就绝不会出错，因为必然至少还剩有一种其邻居尚未使用的颜色。相比之下，度数为 4 的哥伦比亚就很难被安排在最后染色，因为它的邻居（巴西、厄瓜多尔、秘鲁和委内瑞拉）可能已经把四种颜色占满了。

我们可以进一步推进这个思路：假设我们决定把厄瓜多尔放在最后染色。我们可以先暂时从图中移除厄瓜多尔，给不含厄瓜多尔的图染色，然后为厄瓜多尔挑选一种不同于哥伦比亚和秘鲁的颜色。但在没有厄瓜多尔的图中，哥伦比亚的度数降为了 3，因此哥伦比亚就成为了倒数第二个染色的绝佳候选节点！

递归算法的轮廓由此成型。假设你想用 $c$ 种可用颜色对一个图染色，步骤如下：
1. **基准情况**：图为空。一个没有节点的图显然不存在同色的相邻节点，直接返回。
2. **否则**：在图中寻找一个度数小于 $c$ 的节点，将其作为最后染色的节点。如果找不到这样的节点，该简单算法宣告求解失败。
3. **递归求解**：从图中移除选中的最后节点，递归为剩余图染色。
4. **分配颜色**：为最后这个节点挑选任意一种尚未被其邻居使用的可用颜色。

我们将该算法实现为图的扩展方法，泛型类型参数为节点类型和颜色类型。算法成功时返回节点到颜色的不可变字典映射，失败时返回 `null`。

**代码清单 8.4 简单递归染色算法**

```csharp
static class SimpleGraphColoring
{
    public static ImmutableDictionary<N, C>? ColorGraph<N, C>(
        this ImGraph<N> graph,
        ImmutableHashSet<C> colors)
        where N : notnull where C : notnull
    {
        // 基准情况：空图染色为空字典
        if (graph.IsEmpty)
            return ImmutableDictionary<N, C>.Empty;

        // FirstOrDefault 查找第一个边数足够少（度数小于颜色总数）的节点；若不存在则返回 null
        N? last = graph.Nodes
            .Where(n => graph.Edges(n).Count < colors.Count)
            .FirstOrDefault();

        if (last is null)
            return null;

        // 递归为移除该节点后的剩余图染色
        var coloring = graph.RemoveNode(last).ColorGraph(colors);
        if (coloring is null)
            return null;

        // 收集该节点的邻居已经占用的颜色
        var usedColors = graph.Edges(last).Select(n => coloring[n]);

        // 从所有颜色中排除已被邻居占用的颜色，选取第一个可用颜色
        var lastColor = colors.Except(usedColors).First();

        return coloring.Add(last, lastColor);
    }
}
```

测试运行该算法：

```csharp
var simple = southAmerica.ColorGraph(colors);
foreach (var n in simple!.Keys)
    Console.WriteLine($"{n} -> {simple[n].Name}");
```

算法输出了一组完全合法的染色结果：

```text
Colombia -> Red
Suriname -> Red
Paraguay -> Purple
Peru -> Purple
Chile -> Yellow
French Guiana -> Green
Venezuela -> Purple
Guyana -> Green
Brazil -> Yellow
Bolivia -> Red
Uruguay -> Red
Ecuador -> Green
Falkland Islands -> Green
```

如果该算法成功求解，在具有 $n$ 个节点和 $e$ 条边的图上性能表现如何？

该算法仅包含两类开销较大的操作：$n$ 次寻找要移除的节点，以及 $n$ 次节点删除操作。
- 对于查找操作，最好情况下每次都能立即命中低度数节点，总代价为 $O(n)$；最坏情况下每次需要扫描 $O(n)$ 个节点才能找到目标，总代价为 $O(n^2)$。
- 对于删除操作，在整个递归回溯过程中总共会删除所有 $n$ 个节点和所有 $e$ 条边，代价为 $O(n + e)$。

因此，渐近时间复杂度介于 $O(n + e)$ 和 $O(n^2 + e)$ 之间。正如我们在南美洲地图上看到的那样，能够被此算法求解的简单图通常拥有大量低度数节点，针对这些图，算法的实际运行时间是线性的。

我们得到了一个实现简单、在典型图上性能良好、能够轻松搞定大多由低度数节点构成的图的算法。遗憾的是，如果图中**每个节点的度数都大于或等于可用颜色数量**，该算法甚至无法迈出第一步。我们在 8.5 节中就将直面这样一种图。

---

## 8.5 基于回溯搜索求解数独

数独是一种风靡全球的益智谜题：玩家必须在 $9 	imes 9$ 的网格中填入数字 1 到 9，使得每一行、每一列以及每个 $3 	imes 3$ 的宫（box）中，数字 1 到 9 恰好出现一次。谜题的创作者会预先填好一部分数字。

乍看之下，数独谜题与图染色大相径庭，但它本质上就是一个标准的图染色问题：
- 数字 1 到 9 就是 9 种可用的“颜色”。
- 我们可以构建一个包含 81 个节点的图，每个网格单元格对应一个节点。
- 两个单元格如果在同一行、同一列或同一宫内不能拥有相同的数字，则在这两个对应节点之间连接一条边。
- 换句话说，每行中的 9 个节点、每列中的 9 个节点、每宫中的 9 个节点各自构成了一个完全连通的**团**（Clique）。

我们将单元格从左上角到右下角按 0 到 80 进行编号并构建该图。

**代码清单 8.5 数独图的构建及其颜色集合**

```csharp
var sudoku = ImGraph<int>.Empty;

// 9 个行团（Row cliques）
for (int i = 0; i < 9; i += 1)
    sudoku = sudoku.AddClique([.. Enumerable.Range(i * 9, 9)]);

// 9 个列团（Column cliques）
for (int i = 0; i < 9; i += 1)
    sudoku = sudoku.AddClique(
       [.. Enumerable.Range(0, 9).Select(x => x * 9 + i)]);

// 9 个宫团（Box cliques）
sudoku = sudoku
    .AddClique([00, 01, 02, 09, 10, 11, 18, 19, 20])
    .AddClique([03, 04, 05, 12, 13, 14, 21, 22, 23])
    .AddClique([06, 07, 08, 15, 16, 17, 24, 25, 26])
    .AddClique([27, 28, 29, 36, 37, 38, 45, 46, 47])
    .AddClique([30, 31, 32, 39, 40, 41, 48, 49, 50])
    .AddClique([33, 34, 35, 42, 43, 44, 51, 52, 53])
    .AddClique([54, 55, 56, 63, 64, 65, 72, 73, 74])
    .AddClique([57, 58, 59, 66, 67, 68, 75, 76, 77])
    .AddClique([60, 61, 62, 69, 70, 71, 78, 79, 80]);

var digits = ImmutableHashSet<char>.Empty
    .Add('1').Add('2').Add('3').Add('4').Add('5')
    .Add('6').Add('7').Add('8').Add('9');
```

在这个图中，**每个节点的度数都是 20**（同行的 8 个邻居 + 同列的 8 个邻居 + 同宫其余不重叠的 4 个邻居），但可用的颜色只有 9 种！因此，我们在 8.4 节实现的简单染色算法在此刻完全瘫痪，一步都无法执行。

我们需要更强大的武器——**回溯搜索算法（Backtracking Search Algorithm）**。高层抽象流程如下：
1. 给定一个图，其中任意数量的节点可能已经预先指定了颜色，其余节点各自保留着一组当前仍有可能的候选颜色。
2. 是否存在某个节点的候选颜色集合为空？若是，说明之前的某些决策产生了冲突，当前路径求解失败。
3. 是否所有节点都已合法分配了唯一颜色？若是，算法求解成功并返回解。
4. 否则，图中必然至少存在一个拥有两种或更多候选颜色的节点。挑选其中一个节点，我们准备为其选定颜色。
5. 对该节点的颜色做出一个猜测，并递归执行此算法。如果递归返回成功，说明猜对了，任务完成。
6. 如果递归返回失败，回退猜测（backtrack），尝试该节点的其他候选颜色，直到找到解或者试尽所有颜色宣布此路不通。

该算法之所以被称为“回溯”，是因为你做出假设、探索后果；一旦发现走入死胡同，就**回溯**到当初做假设的节点，尝试其他分支。

只要解存在，该算法最终必然能够找到它。但“尝试所有可能并逐一验证”的效率足够高吗？递归猜测可能产生天文数字级别的分支组合。在动手实现之前，让我们深入一点计算复杂度理论来审视这一问题。

### 8.5.1 图染色是 NP 完全问题

在本书前面的章节中，我们分析算法的渐近时间复杂度并将其表征为 $O(1)$、$O(\log n)$、$O(n)$、$O(n^2)$、$O(2^n)$ 等。如果一个算法在最坏情况下的时间复杂度为 $O(n^c)$（其中 $c$ 为常数），我们称其具有**多项式时间**（polynomial time）性能。请注意，指数级算法 $O(c^n)$ 不是多项式级的。

在理论计算机科学中，有一类被称为 **NP 完全（NP-complete）** 的问题，它们具备以下共性特征：
- 它们都可以被表述为“是/否”判定问题。
- 给出一个声称答案为“是”的候选解，可以在多项式时间内验证其正确性。
- 至今尚未发现能在多项式时间内必定求解该问题的算法。
- 至今也尚未证明“不存在多项式时间求解算法”。
- 如果为其中任意一个 NP 完全问题找到了多项式时间算法，那么所有 NP 完全问题都将迎来多项式时间算法（这正是“完全”（Complete）的含义）。

> **注意**  
> NP 完全问题属于公认的极度困难的问题，它们可能存在多项式算法，但至今无人发现。主流计算机科学界倾向于相信此类多项式算法并不存在（即 $P 
eq NP$）。

图染色问题可以表述为判定问题：“南美洲地图能否仅用四种颜色完成染色？”如果我们猜测答案为“是”并给出了一组分配方案，我们可以通过遍历每条边并检查其两个端点颜色是否不同来验证它。因为一个具有 $n$ 个节点的图最多只有 $O(n^2)$ 条边，所以验证过程显然是在多项式时间内完成的。证明图染色问题等价于其他所有 NP 完全问题超出了本书范围，但它的确与其他所有 NP 完全问题一样困难。我们构想的所有图染色算法要么最坏情况下具有指数级复杂度，要么像前面的简单算法一样无法处理任意图。

我们的回溯搜索框架能够为任意图染色问题求解（或在无解时报告失败）。由于图染色是 NP 完全的且不存在已知多项式算法，因此回溯搜索在最坏情况下必然不是多项式级的。“持续猜测直到找到解”在最坏情况下就是指数级的。

然而，我们不必过度悲观：现实生活中的许多图染色问题并非最恶劣的极端情况。既然我们坚持以回溯作为核心策略，那么优化算法性能的最有效途径就是：**在猜测前尽可能激进地缩减候选空间（剪枝与约束传播）**。

### 8.5.2 实现通用回溯器

为了尽可能激进地减少必须探索的候选分支，我们将回溯求解器的代码拆分为三个清晰的组成部分：
- **尝试状态（Attempt）**：一个多重字典，键为待染色的节点，值为该节点当前剩余的可能候选颜色。如果每个节点都恰好只剩一个候选值，则这是一个**解（Solution）**；如果任何节点剩余候选值数量为零，则这是一个**破坏状态（Broken）**。
- **化简器（Reducer）**：接收一个 Attempt，在不进行任何盲目猜测的前提下，通过约束推演剔除不可能的候选颜色，生成并返回一个候选集合更小的新 Attempt。
- **回溯器（Backtracker）**：接收一个 Attempt，首先对其调用化简器；随后检查化简后的结果是破坏状态还是最终解；若二者皆非，则挑选一个分支进行猜测并递归求解。回溯器生成解的序列，空序列表示无解。

我们此前已经编写了 `ImMulti` 多重字典。现在我们定义表示化简器的单方法接口，以及用于剔除邻接节点不可能颜色的图染色化简器：

**代码清单 8.6 剔除不可能节点颜色的图染色化简器**

```csharp
interface IReducer<K, V> where K : notnull where V : notnull
{
    ImMulti<K, V> Reduce(ImMulti<K, V> solver);
}

sealed class GraphColorReducer<N, C> : IReducer<N, C>
    where N : notnull where C : notnull
{
    private readonly ImGraph<N> graph;
    public GraphColorReducer(ImGraph<N> graph) => this.graph = graph;

    private (ImMulti<N, C>, bool) ReduceOnce(ImMulti<N, C> attempt)
    {
        bool progress = false;
        var result = attempt;

        // 遍历所有已被确定唯一颜色的节点
        foreach (N n1 in attempt.Keys.Where(k => attempt[k].Count == 1))
        {
            // 获取 n1 的确定颜色
            C c = attempt[n1].Single();

            // 查找所有与 n1 相邻且候选集合中依然包含颜色 c 的邻居节点
            var elim = graph.Edges(n1).Where(n => attempt.HasValue(n, c));
            foreach (N n2 in elim)
            {
                // 节点 n2 与 n1 相邻，因此 n2 绝不可能取颜色 c，将其剔除
                result = result.Remove(n2, c);
                progress = true;
            }
        }
        return (result, progress);
    }

    public ImMulti<N, C> Reduce(ImMulti<N, C> attempt)
    {
        bool progress;
        do
            // 只要一轮化简产生了新的排除项，就可能引发连锁反应，继续下一轮化简
            (attempt, progress) = ReduceOnce(attempt);
        while (progress);

        return attempt;
    }
}
```

注意该设计的精妙之处：
- Attempt 是节点到颜色的多重字典，而 Graph 底层是节点到节点的多重字典。如果我们之前没有为图编写专门的包装类型，这段代码中就会充斥着两个键类型完全相同但值语义截然不同的多重字典，极易混淆。我们在第 8.3 节编写封装类的决定在此获得了丰厚的回报。
- `ReduceOnce` 的策略是：识别所有已经确定唯一颜色的节点，并强制从其所有邻居的候选集中剔除该颜色。这一步可能会让某个邻居的候选集归零（产生 broken attempt），这是好事，回溯器可以立即放弃该分支不再递归；或者可能恰好将所有节点都锁定到了单一颜色（产生 solution）；无论是哪种情况，它都极大地消减了需要猜测的分支。
- `ReduceOnce` 的剔除操作可能导致某些原本拥有多个候选颜色的邻居也塌缩为单一确定颜色，从而触发新的约束。因此，`Reduce` 会循环调用 `ReduceOnce` 直到状态不再发生改变（达到不动点）。

接下来实现通用的回溯搜索算法：

**代码清单 8.7 通用回溯算法**

```csharp
sealed class Backtracker<N, C> where N : notnull where C : notnull
{
    private readonly IReducer<N, C> reducer;
    public Backtracker(IReducer<N, C> reducer) => this.reducer = reducer;

    public IEnumerable<ImMulti<N, C>> Solve(ImMulti<N, C> attempt)
    {
        // 第一步：执行确定性化简与约束传播
        attempt = reducer.Reduce(attempt);

        // 如果存在任何节点无可用颜色，说明此路不通，剪枝并返回空序列
        if (attempt.Keys.Any(k => attempt[k].IsEmpty))
            return [];

        // 如果所有节点都已被化简为恰好一个颜色，找到了合法解！
        if (attempt.Keys.All(k => attempt[k].Count == 1))
            return [attempt];

        // 挑选一个具有多个候选颜色的节点进行分支猜测
        N guessKey = attempt.Keys.Where(k => attempt[k].Count > 1).First();

        // 为该节点的每个可能候选颜色创建假设，并递归求解
        return attempt[guessKey]
            .SelectMany(v => Solve(attempt.SetSingle(guessKey, v)));
    }
}
```

因为我们将所有与图相关的领域逻辑全部封装到了化简器中，所以回溯器本身的代码极其精炼！事实上，`Backtracker` 的实现中完全没有任何与“图染色”绑定的逻辑——它是一个高度通用的回溯搜索器，可用于求解任何“在满足特定约束条件下寻找键值映射”的问题。只要换一个不同的化简器，它就能直接求解全新的问题。

当我们传入一个 Attempt 时，首先对其进行化简；化简可能瞬间判定冲突或直接得出最终解。如果陷入僵局，我们选取一个仍有多种可能的键，为每一种可能的值创建一个分支 Attempt，并递归调用 `Solve`。`SelectMany` 操作符负责将各个分支返回的解序列平坦化连接为一个单一的序列。

> **注意**  
> 通过返回空序列或单元素序列来过滤死路，并使用 `SelectMany` 将所有分支序列级联的技术，在函数式编程中非常关键。我们在第 11 章讲解 Monad 时还会深入重温这一模式。

现在，让我们利用代码清单 8.5 构建的数独图来解决数独谜题：

**代码清单 8.8 基于回溯搜索求解数独**

```csharp
string puzzle =
    "  8 274  " +
    "         " +
    " 6 38  52" +
    "      32 " +
    "1   7   4" +
    " 92      " +
    "78  62 1 " +
    "         " +
    "  384 5  ";

var initial = ImMulti<int, char>.Empty;

// 初始状态下，每个单元格都有 1~9 这 9 种可能数字
foreach (var cell in sudoku.Nodes)
    initial = initial.SetItem(cell, digits);

// 将谜题中已给出的已知数字锁定为单一候选值
for (int i = 0; i < puzzle.Length; i += 1)
    if (puzzle[i] != ' ')
        initial = initial.SetSingle(i, puzzle[i]);

var reducer = new GraphColorReducer<int, char>(sudoku);
var backtracker = new Backtracker<int, char>(reducer);
var solution = backtracker.Solve(initial).First();

// 打印解
for (int i = 0; i < 81; i += 1)
{
    Console.Write(solution[i].Single());
    if (i % 9 == 8)
        Console.WriteLine();
}
```

运行程序，数独谜题被瞬间求解：

```text
358127469
279654831
461389752
847916325
135278694
692435187
784562913
516793248
923841576
```

你完全可以在多项式时间内验证其正确性：预置数字全部吻合，且每一行、每一列、每个宫中的数字 1 到 9 恰好出现一次。

### 8.5.3 如何进一步改进？

如果你有玩数独的经验，就会明白人类在解题时绝不是这样盲目猜测回溯的。数独圈内通常将这种暴力试错称为“分叉假设法”（Bifurcation）。在数独领域中，分叉试错被视作没有技巧的笨办法，因为几乎总是存在更优雅的逻辑推演技巧。

我们的化简器能够变得更快、更聪明吗？我们确实遗漏了几个重要的优化手段：
1. **及早终止破坏状态**：当前的化简器在循环期间从未主动检查 Attempt 是否已被破坏。它盲目地在图上查找单值节点进行化简，即使某一轮化简已经导致某个邻居的候选集缩减为零（产生矛盾），化简器依然会把循环跑完，全靠外层的回溯器来做后续检测。
2. **增量约束传播**：当化简器第一次调用 `ReduceOnce` 时，它会遍历所有节点寻找单值节点，并扫描所有相邻节点以剔除候选。但在随后的多次 `ReduceOnce` 调用中，绝大多数工作都被机械地重复执行了。化简器理应采用工作队列（worklist）模式，仅对上一轮产生新变化的节点及其邻居进行增量传播。
3. **针对“团”的高级约束推导**：当前的化简器完全不理解团的全局约束。如果一个团的节点数量与可用颜色数量相等，这会创造绝佳的化简契机。例如在数独中，底部中间的 $3 	imes 3$ 宫必然包含一个 7。即使没有任何单元格被唯一定位为 7，通过排除其他宫的影响，也可以推断出该宫内 7 的唯一落点。一个更聪明的化简器能够利用这一事实直接锁定单元格，触发级联化简。

数独界沉淀了数十种基于数独图高密度团特性的推导技巧（例如隐性数对、X-Wing 等），无需任何分叉猜测即可快速化简。将这些启发式规则编码到化简器中，能够让回溯搜索的速度获得数量级的飞跃。

### 8.5.4 回溯与笛卡尔积

我们已经看到，当问题包含大量可供化简器利用的强约束时，回溯算法表现优异。那么在相反的情况下——如果染色问题几乎没有任何约束呢？

假设有两个互不相邻的孤岛，以及四种可选颜色：

```csharp
var islands = ImGraph<string>.Empty.AddNode("A").AddNode("B");
var islandsReducer = new GraphColorReducer<string, Color>(islands);
var islandsBT = new Backtracker<string, Color>(islandsReducer);
var islandsInit = ImMulti<string, Color>.Empty
    .SetItem("A", colors).SetItem("B", colors);

foreach (var s in islandsBT.Solve(islandsInit))
    Console.WriteLine(s["A"].Single().Name + " " + s["B"].Single().Name);
```

由于没有任何互斥约束，这里存在多达 16 种可能解：

```text
(Yellow,Yellow) (Yellow,Red) (Yellow,Green) (Yellow,Purple) (Red,Yellow)
(Red,Red) (Red,Green) (Red,Purple) (Green,Yellow) (Green,Red) (Green,Green)
(Green,Purple) (Purple,Yellow) (Purple,Red) (Purple,Green) (Purple,Purple)
```

你敏锐地发现了：这正是四种颜色集合与自身的**笛卡尔积（Cartesian Product）**！我们在第 6 章中学习过，可以通过将多次 `SelectMany` 调用组合在一起来计算笛卡尔积，而这恰恰就是我们回溯算法在底层所做的事情。

**回溯搜索在本质上是在枚举所有可能候选解的笛卡尔积空间，并通过化简步骤尽可能及早地剔除必定失败的搜索分支。**

在传统认知中，搜索通常意味着在采购订单表中查找某位客户的订单，或者在树结构中向下遍历寻找特定节点。而回溯算法解决的是一个更高维度的抽象搜索问题：**在整个庞大的解空间中漫游，寻找满足指定约束条件的解状态**。化简步骤的核心使命，就是在我们迈入歧途之前，敏锐地识别并避开那些绝不可能通向成功解的庞大子空间。

---

## 8.6 排程问题本质是图染色问题

为地图涂色和解数独虽然实用，但多少带有一点游戏色彩。图染色之所以在学术界和工业界得到如此深入的研究，不仅因为它是纯数学的瑰宝，更因为工业生产中的大量实际工程调度——即**排程问题（Scheduling Problems）**——都可以精确建模为图染色问题：

- **机场登机口排程**：一天中的小时数有限，机场的登机口也有限。如果一个拥有 10 个登机口的机场每天开放 16 小时，且每架飞机停靠 1 小时，我们可以构建 160 种“颜色”（每个登机口的每一个小时对应一种颜色）。飞机则是图中的节点；如果两架飞机在同一个小时内到达或起飞，它们之间就连接一条边，表示绝不能共享同一个登机口。为无冲突地安排飞机的登机口，便化归为图染色问题。
- **学校课表排课**：教室与时间段是稀缺资源。我们可以将“教室 + 时间段”抽象为颜色。同一时间同一教室不能安排两门课程；选修了相同两门课程的学生不能在同一时间被要求出现在两个地点；此外还有化学课不能在普通计算机房上、影视鉴赏课需要投影教室等各类特定约束。将这些冲突关系建模为图中的边，高效寻找一组合法染色，是运筹学与图论中极为经典的课表编排算法。
- **编译器寄存器分配（Register Allocation）**：编译器后端代码生成团队的核心挑战之一，就是寄存器分配与溢出优化。CPU 通常无法直接在内存中高效执行复杂指令，而是需要先将值加载到数量有限的高速物理寄存器中，在寄存器中完成计算，最后将结果写回内存。如何让有限的寄存器发挥极致性能？观察以下代码：

```csharp
for (int i = 0; i < 10; i += 1)
    for (int j = 0; j < 10; j += 1)
        F(i, j);

for (int k = 0; k < 10; k += 1)
    // ... 后续代码 ...
```

局部变量 `i` 和 `j` 的生命周期高度重叠，它们在同一时刻都被活跃使用，因此理想情况下绝对不能共用同一个物理寄存器。如果物理寄存器不够，编译器就必须执行**寄存器溢出（Register Spill）**——将变量写回内存并在需要时重新加载，这会带来严重的性能损耗。然而，变量 `k` 的生命周期与 `i`、`j` 完全不重叠，因此 `k` 可以完全安全地复用 `i` 或 `j` 之前释放的寄存器。

编译器正是通过将每个局部变量建模为节点，为生命周期重叠的变量之间连边，并将可用的物理寄存器视作“颜色”，从而将寄存器分配转化为图染色问题。如果找到合法染色，就能以零溢出代价完成代码生成；若可用寄存器不足，编译器还需要借助图算法精确计算出溢出代价最小的节点，将其溢出到内存，再对剩余图重新染色。

图染色的应用领域浩瀚繁多，足以为其撰写一本厚重专著。下次当你面临复杂的资源调度、排班规划，或在数独题前苦思冥想时，请不要忘记在你的工具箱里，还静静躺着这把锋利的图染色回溯之刃。

---

## 本章小结

- 图论是组合数学中研究由边相连节点的学科分支。节点染色问题是图论中研究最广泛的经典问题之一：在给定颜色数量的前提下，如何为每个节点分配合法颜色，使得任意相邻节点皆不同色？
- 包含大量低度数节点的简单图通常可以用递归算法在线性时间内求解：每次识别一个度数足够低可放在最后染色的节点，在图中暂时剥离它并递归为剩余部分染色，最后为其挑选一种剩余可用颜色。
- 结构更复杂的密集图需要借助回溯搜索算法：首先通过化简器进行无假设约束传播，检查当前尝试状态是破坏状态、解状态还是不完全状态；若为不完全状态，则挑选一个分支进行递归假设搜索。
- 回溯算法在底层与笛卡尔积算法同构：通过序列的 `SelectMany` 操作符进行组合枚举，并附加确定性的剪枝化简步骤，以避免遍历那些绝不可能满足约束的巨大解空间。
- 图染色在一般情况下属于 NP 完全问题。目前不存在已知多项式时间算法，但理论上也尚未证明其不存在，目前已知最优的通用算法在最坏情况下为指数级。幸运的是，通过设计高效的约束化简器，绝大多数工业实际问题都能在极短时间内得到有效求解。
