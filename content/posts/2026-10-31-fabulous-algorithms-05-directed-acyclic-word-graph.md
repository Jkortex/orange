---
title: "数据结构与算法的奇妙冒险（五）：有向无环单词图（DAWG / Trie 压缩）"
date: 2026-10-31T01:05:00Z
description: "从前缀树（Trie）演进到有向无环单词图（DAWG），通过后缀共享实现词典极致压缩与模糊匹配。"
category: algorithms
column: fabulous-algorithms
tags: [Trie, DAWG, 字符串搜索, 词典压缩, 图算法]
---

# 第 5 章 有向无环单词图（DAWG）

### 本章核心内容

- 探索存储大规模词典并支持按前缀高速检索的若干核心技术
- 权衡哈希集、有序列表、前缀树（Trie）与有向无环单词图（DAWG）的成本与收益
- 掌握从已排序词典逐词在线构建极小化 Trie 与 DAWG 的高效算法
- 揭示 DAWG 与形式语言自动机理论之间的深层数学联系

---

在前言所描述的那场糟糕面试之后，我那天的遭遇仅仅稍微好转了一点点。第二位技术面试官向我提出了一个好得多的工程问题：在拼字游戏（Scrabble）的一个回合中，假设你的托盘里有七个字母，用什么算法能够找出所有的“Bingo”（即利用这七个字母所能拼出的所有合法的七字母完整单词）？函数应当接受形如 `"NISATEV"` 的输入，并输出 `"NAIVEST"`、`"NATIVES"` 以及 `"VAINEST"`。

这个问题并不算太难，我当时对自己的解法相当满意；然而，面对随后关于更复杂词典搜索场景的深入追问，我却答得捉襟见肘。我当时虽然知道**前缀树**（Prefix Tree，亦称 Trie）是处理词典检索的合适数据结构，但对其底层细节语焉不详；而当面试官问我是否知道什么是“DOG”（发音与 DAWG 相同）时，我更是一头雾水。原来他指的是**有向无环单词图**（Directed Acyclic Word Graph，简称 DAWG）。那是当天我收到的第二份“不录用”评价。幸运的是，在那之后不久，我便彻底将 DAWG 纳入了自己的武器库。

一个优秀的面试问题往往具备强烈的工程现实意义。涉及大规模词表的高性能检索问题极为普遍，在今天甚至远超 1996 年我参加面试的那个时代：IDE 中的键入自动补全（IntelliSense）、拼写检查纠错、文字游戏解谜与搜索建议无处不在。究竟怎样的数据结构才能既支持亚毫秒级的高速检索，又极其节省内存？

我们将从最朴素的有序列表方案出发，随后探讨前缀去重的 Trie，最终实现同时将公共前缀与公共后缀压缩到极致的 DAWG。在此过程中，我们还将探索词典检索与有限状态机理论之间的优美联结。

---

## 5.1 两个问题，两个平庸的解法

在词典工程中最常见的两个核心需求是：
1. **精确查找**：给定单词是否存在于词典中？（`Contains`）
2. **前缀检索**：词典中所有以指定前缀开头的单词有哪些？（`StartsWith`）

后者是代码编辑器智能自动补全的核心支柱。补全必须以极高的帧率响应用户输入：在当年微软 C# IDE 团队中，我们为 IntelliSense 自动补全设定的响应预算仅仅只有 30 毫秒——大约是屏幕刷新一次的时间窗口。

我们首先定义抽象数据类型：

代码清单 5.1 词表抽象数据类型接口：

```csharp
interface IWords : IEnumerable<string>
{
    bool Contains(string word);
    IEnumerable<string> StartsWith(string prefix);
}
```

在后续分析中，我们用 $n$ 代表词典中的单词总数，$m$ 代表单词的平均（或最大）字符长度。

### 5.1.1 为什么哈希集合不可行？

将词表存入 `HashSet<string>` 的方案可以被立即否决。

哈希集在 `Contains` 上表现优异，通过对字符串各字符进行哈希运算（耗时 $O(m)$）并定位桶，其查询耗时完全独立于单词总数 $n$。然而，**哈希集在前缀检索 `StartsWith` 上毫无用处**。良好哈希函数的设计初衷就是尽可能将哪怕只有一字之差的相似单词彻底打散到完全不相关的桶中。面对前缀匹配，哈希集除了对全量数据进行暴力全表扫描（$O(mn)$）之外别无他法。

### 5.1.2 有序列表：差强人意但内存沉重

退而求其次，最容易实现的方案是维护一个已经按字母序排好序的字符串列表 `List<string>`，并在此基础上执行二分查找：

代码清单 5.2 基于有序列表的词表实现：

```csharp
class SortedWordList : IWords
{
    private List<string> words;

    public SortedWordList(List<string> words)
    {
        this.words = words;
    }

    public bool Contains(string word) => words.BinarySearch(word) >= 0;

    public IEnumerable<string> StartsWith(string prefix)
    {
        int i = words.BinarySearch(prefix);
        if (i < 0)
            i = ~i; // 若未精确命中，按位取反得到首个大于 prefix 的插入点位置

        for (; i < words.Count; i += 1)
        {
            string w = words[i];
            if (!w.StartsWith(prefix))
                yield break;
            yield return w;
        }
    }

    public IEnumerator<string> GetEnumerator() => words.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

二分查找需要 $O(\log n)$ 次字符串比较，每次比较耗时 $O(m)$，因此 `Contains` 耗时为 $O(m \log n)$。在 `StartsWith` 中，定位起始位置耗时 $O(m \log n)$，随后扫描每一个命中项耗时 $O(m)$。

### 内存消耗现实评估：ENABLE 词典基准

在算法分析中我们习惯于关注大 O 渐进复杂度，但在工业级部署中，物理内存消耗同样是生死线。我们采用北美拼字游戏权威词典 **ENABLE** 作为统一测试基准：
- 单词总数 $n = 172,820$；
- 字符总数 $1,570,508$（平均词长 $m \approx 9.1$ 个字符，最长词达 28 个字符）。

若直接将该词表载入 `List<string>`，在 64 位 .NET 运行时下的物理内存账单如下：
1. **字符物理存储**：C# 中 `char` 占用 2 字节，约需 3.1 MB；
2. **指针数组**：存储 172,820 个 64 位对象引用的指针列表占用约 1.3 MB；
3. **对象头与长度开销**：每个字符串对象拥有 4 字节长度字段与 16 字节的 CLR 对象头（MethodTable 指针与 SyncBlock 索引），额外占用约 3.5 MB；
- **总计物理内存消耗接近 8 MB！** 此外，堆内存中散落着 17 万个独立托管对象，为垃圾回收器（GC）的标记与扫描带来了沉重负担。

我们能否将搜索时间降至纯粹的 $O(m)$，同时大幅压缩空间？这正是前缀树登场的时刻。

---

## 5.2 前缀树（Trie）

在词典中，大量单词共享完全相同的前缀。在 ENABLE 词典中，仅仅以 `anti` 开头的单词就有 750 多个；在有序列表中，`anti` 这 4 个字符被机械重复存储了 750 次！

**前缀树（Trie，源自 re-trie-val）的核心思路是：将公共前缀彻底合并共享**。每条边代表一个字符，节点代表字符间的分割切片，从根节点出发沿着边向下遍历即可拼装出单词。

以包含 9 个单词的微型词表为例：
`["car", "care", "cares", "cars", "fir", "fire", "firer", "firers", "firs"]`

![](/media/posts/fabulous-algorithms/img-01934.jpeg)
*图 5.1：9 单词示例的前缀树（Trie）。双圈节点表示该节点是一个合法单词的终点。*

在前缀树中，前缀 `car` 出现 4 次，但在树中仅由一条路径上的节点 3 代表；节点 3 的出边分化出所有后续后缀。

### 5.2.1 节点设计

代码清单 5.3 Trie 节点类实现：

```csharp
sealed class Node
{
    private readonly Dictionary<char, Node> edges = [];
    public bool IsEnd { get; set; }

    public IEnumerable<char> EdgeLabels => edges.Keys;
    public Node FollowEdge(char c) => edges[c];
    public Node? TryFollowEdge(char c) => HasEdge(c) ? FollowEdge(c) : null;
    public bool HasEdge(char c) => edges.ContainsKey(c);
    public Node AddNewNode(char c) => edges[c] = new();
    public Node TryAddNewNode(char c) => HasEdge(c) ? FollowEdge(c) : AddNewNode(c);
}
```

每个节点维护出边字符到子节点的映射表及是否构成合法单词终点的标记 `IsEnd`。所有出边查找在常数时间 $O(1)$ 内完成。

### 5.2.2 树的构建算法

代码清单 5.4 前缀树构建器：

```csharp
sealed class TrieBuilder
{
    private Node root = new();
    private TrieBuilder() { }

    public static Node MakeTrie(IEnumerable<string> words)
    {
        var tb = new TrieBuilder();
        foreach (var word in words)
            tb.Add(word);
        return tb.root;
    }

    private void Add(string word)
    {
        Node n = root;
        foreach (char c in word)
            n = n.TryAddNewNode(c);
        n.IsEnd = true;
    }
}
```

逐字扫描构建整棵树的总时间复杂度为严格的 $O(mn)$（正比于词库字符总量）。

### 5.2.3 基于树图的高速检索

代码清单 5.5 通用图结构词表查询封装：

```csharp
using System.Text;

sealed class WordGraph : IWords
{
    private Node root;

    public WordGraph(Node root)
    {
        this.root = root;
    }

    private Node? Find(string prefix)
    {
        Node? n = root;
        foreach (char c in prefix)
        {
            n = n.TryFollowEdge(c);
            if (n == null) break;
        }
        return n;
    }

    public bool Contains(string word) => Find(word)?.IsEnd ?? false;

    public IEnumerable<string> StartsWith(string prefix)
    {
        Node? n = Find(prefix);
        return n == null ?
            Enumerable.Empty<string>() :
            Words(n, new StringBuilder(prefix));
    }

    private IEnumerable<string> Words(Node n, StringBuilder prefix)
    {
        if (n.IsEnd)
            yield return prefix.ToString();

        foreach (char c in n.EdgeLabels)
        {
            prefix.Append(c);
            foreach (var word in Words(n.FollowEdge(c), prefix))
                yield return word;
            prefix.Remove(prefix.Length - 1, 1); // 回溯重置 StringBuilder
        }
    }

    public IEnumerator<string> GetEnumerator() => StartsWith("").GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

检索性能极为惊艳：
- `Contains(word)` 的时间开销严格为 **$O(m)$**（仅与目标词长相关，彻底摆脱了词库规模 $n$ 的影响）；
- `StartsWith(prefix)` 在 $O(m)$ 时间内瞬间定位到子树根节点，随后仅以 $O(m)$ 的开销吐出每一个命中单词。相比有序列表的二分查找，前缀树实现了降维打击。

### 5.2.4 致命缺陷：海量冗余叶节点

然而，当我们对真实的 ENABLE 词表构建 Trie 时，数据揭示了残酷的现实：
- ENABLE 总共 172,820 个单词，生成的 Trie 包含 **387,881 个节点**；
- 其中有整整 **111,507 个节点是没有任何出边的叶节点**（这些词不是任何更长单词的前缀）！
- 这 11 万个叶节点在结构上完全一模一样（出边表均为空，且 `IsEnd = true`），但由于树状结构的单向限制，它们被分裂成了 11 万个完全独立的对象，白白霸占了海量内存！

既然我们可以合并公共前缀，**为什么不能把公共后缀也一并合并共享**？

---

## 5.3 前缀树与有限状态自动机

在形式语言理论中，**确定性有限状态自动机**（Deterministic Finite Automaton，DFA / FSA）由有限个内部状态、输入字母表以及状态转移函数构成。

前缀树本质上就是一个有限状态自动机：
- 节点对应**状态**；
- 边上的字符对应**输入符号**；
- 根节点是**初始状态**；
- 双圈节点（`IsEnd = true`）是**接收状态（终止成功状态）**。

在经典编译原理与自动机理论中，任何识别正规语言的自动机都存在**唯一的极小化 DFA**（Minimal DFA）。将拥有 14 个状态的 9 词前缀树进行状态等价类合并，可以大幅削减状态总数，同时其识别的单词语言集合保持百分之百不变！

然而，若先在内存中构建出庞大臃肿的 Trie，再运行开销沉重的全量 Hopcroft 状态最小化算法，在内存受限场景下显然是行不通的。我们需要的是：**从已排序的单词流中，以流式在线方式直接一步到位构建出极小化的图结构！**

---

## 5.4 构建有向无环单词图（DAWG）

当树中的节点允许汇聚共享后缀时，树演化为了一张**有向无环图**（Directed Acyclic Graph），在词典领域被称为 **DAWG**（Directed Acyclic Word Graph，亦称 DAFSA）。

我们采用 Jan Daciuk、Bruce Watson 与 Richard Watson 于 1998 年提出的经典线性构建算法。该算法的核心不变式是：**在处理已按字母序排序的词表时，整张图对于此前已插入的所有单词而言始终保持绝对极小化，唯独当前刚插入的最后一个单词的路径节点尚未冻结优化**。当读入新单词时，算法对上一个单词所独占的后缀路径执行自底向上的回溯等价性折叠！

### 5.4.1 节点等价性定义与哈希比较器

如何从数学与代码层面严格判定两个图节点 `x` 与 `y` 是否完全等价（可以安全合并为一个）？
充分必要条件为：
1. 两者的终止标记一致：`x.IsEnd == y.IsEnd`；
2. 两者的出度数量一致：`x.Count == y.Count`；
3. 两者拥有完全相同的出边字符集；
4. **对于每一条出边字符，它们所指向的目标子节点在引用上必须是同一个对象**！

代码清单 5.6 节点等价性比较器实现：

```csharp
sealed class DawgBuilder
{
    private class NodeEquality : IEqualityComparer<Node>
    {
        public bool Equals(Node? x, Node? y)
        {
            if (ReferenceEquals(x, y)) return true;
            if (x is null || y is null) return false;
            if (x.IsEnd != y.IsEnd || x.Count != y.Count) return false;

            return x.EdgeLabels.All(e =>
                y.HasEdge(e) &&
                ReferenceEquals(x.FollowEdge(e), y.FollowEdge(e)));
        }

        public int GetHashCode(Node n)
        {
            var h = new HashCode();
            h.Add(n.IsEnd);
            // 确保出边排序遍历，以保证哈希值的确定性
            foreach (var e in n.EdgeLabels.OrderBy(c => c))
            {
                h.Add(e);
                // 注意：此处计算的是目标节点的引用哈希（Object.GetHashCode），绝非深层递归！
                h.Add(n.FollowEdge(e));
            }
            return h.ToHashCode();
        }
    }
```

为了能够在 $O(1)$ 常数时间内快速查验全图中是否存在与当前节点等价的规范节点，我们维护一个以 `NodeEquality` 为基准的哈希集合 `canonicalNodes`。

### 5.4.2 DAWG 在线构建器完整实现

在 `Node` 类中补充更新出边指向的方法：

```csharp
public int Count => edges.Count;
public char LastEdgeLabel => EdgeLabels.Max();
public Node ReplaceEdge(char c, Node n) => edges[c] = n;
```

随后编写 DAWG 核心构建逻辑：

代码清单 5.8 DAWG 极小化构建器：

```csharp
sealed class DawgBuilder
{
    private class NodeEquality : IEqualityComparer<Node> { /* ... */ }

    private Node root = new();
    private HashSet<Node> canonicalNodes = new(new NodeEquality());

    private DawgBuilder() { }

    public static Node MakeDawg(IEnumerable<string> words)
    {
        var db = new DawgBuilder();
        foreach (var word in words)
            db.Add(word);
        // 所有单词读入完毕，彻底固化最后一个单词的尾部节点
        db.FixUpLastWord(db.root);
        return db.root;
    }

    private void Add(string word)
    {
        int i = 0;
        Node n = root;

        // 第一步：沿既有边推进，查找新单词与前序树的公共前缀
        for (; i < word.Length; i += 1)
        {
            if (!n.HasEdge(word[i])) break;
            n = n.FollowEdge(word[i]);
        }

        // 第二步：自底向上折叠优化上一个单词在此分叉点之后的独占后缀
        FixUpLastWord(n);

        // 第三步：为新单词的剩余后缀开辟新节点
        for (; i < word.Length; i += 1)
            n = n.AddNewNode(word[i]);

        n.IsEnd = true;
    }

    private void FixUpLastWord(Node n)
    {
        if (n.Count == 0) return;

        char c = n.LastEdgeLabel;
        Node s = n.FollowEdge(c);

        // 深度优先递归：先优化深层子节点，自底向上确保等价性比较的引用确定性！
        FixUpLastWord(s);

        // 查验规范节点集中是否存在等价节点
        if (canonicalNodes.TryGetValue(s, out Node? canonical))
        {
            // 命中公共后缀！直接将当前出边重定向至规范节点，废弃多余节点 s
            n.ReplaceEdge(c, canonical);
        }
        else
        {
            // 未命中：说明该节点形态独一无二，正式纳入规范集合，今后不可再被原地篡改
            canonicalNodes.Add(s);
        }
    }
}
```

在此算法运行中：
- 节点一旦加入 `canonicalNodes`，便完成了终生冻结，其哈希值永恒稳定；
- 每一个被插入的节点仅在其生命周期结束时被检查一次并合并；
- **全算法的渐进构建时间依然严格保持为完美的线性阶 $O(mn)$**！

---

## 5.5 ENABLE 词表终极对决：DAWG vs. Trie

在包含 172,820 个单词的完整 ENABLE 词库上，Trie 与 DAWG 的实测结构对比如下：

表 5.1 按出度分类的节点数量对比：

| 出边数量（出度） | 前缀树（Trie）节点数 | 有向无环图（DAWG）节点数 |
| :--- | :--- | :--- |
| **0（纯叶节点）** | 111,507 | **1** |
| 1 | 214,096 | 25,921 |
| 2 | 39,181 | 12,840 |
| 3 | 13,525 | 6,755 |
| 4 | 4,490 | 3,618 |
| 5 | 1,994 | 1,944 |
| 6 ~ 26 | 3,088 | 3,088 |
| **总节点数** | **387,881** | **54,167（缩减 86%！）** |
| **总边数** | **387,880** | **122,975** |

数据结果极具震撼力：
- **节点总量从 38.7 万锐减到 5.4 万，节点缩减幅度高达 86%**！
- 原本散落各处的 11.1 万个冗余叶节点，在 DAWG 中被彻底融化合并为**全局唯一个公共终点节点**！
- 英语中大量常见的派生后缀（如 `-s`、`-ed`、`-ing`、`-ation`、`-ness`）在图中形成了高度密集的汇聚交织，空间利用率达到了理论上的数学极限。

### 历史黑客艺术：将庞大词典压进 640KB

在古老的 MS-DOS 时代，整机常规内存被死死卡在 640 KB 的硬限制之内。游戏先驱们是如何在仅有数百 KB 的机器上运行包含十几万词汇的拼字游戏的？

答案正是 DAWG 的二进制紧凑序列化：
- 分配一块连续的大内存块；
- 每个节点仅由一个 **4 字节紧凑标头** 表示（1 位标记 `IsEnd`，26 位位图标记 26 个英文字母是否存在出边）；
- 标头紧跟若干个 **3 字节相对偏移量**（每个偏移量指向目标节点的内存偏移行首，3 字节寻址能力达 16 MB）；
- 54,167 个节点（$54167 \times 4$ 字节）加上 122,975 条边（$122975 \times 3$ 字节）的总物理体积仅为：
  $$54167 \times 4 + 122975 \times 3 = 585,593 \text{ 字节} \approx 571 \text{ KB}！$$

整整十七万级词汇的英美权威大词典，在支持 $O(m)$ 极速寻词的前提下，被**硬生生塞进了一张 570 KB 的软盘**之中！这就是数据结构与算法融合展现出的极致工业之美。

---

## 本章小结

- 处理大规模词表的检索与前缀匹配时，基于有序列表的二分查找耗时为 $O(m \log n)$，且物理内存开销由于字符串元数据冗余而膨胀数倍；哈希集则无法胜任前缀匹配。
- 前缀树（Trie）通过公共前缀共享，将检索耗时压缩至与词典容量完全无关的 $O(m)$，但英文词库会导致树中滋生十万量级的孤立冗余叶节点。
- 前缀树本质上就是有限状态自动机（FSA）。通过等价状态合并，可以将自动机最小化为有向无环单词图（DAWG / DAFSA）。
- Daciuk 算法利用字典序流式插入的局部不变式，自底向上折叠刚刚脱离修改状态的后缀节点，以优雅的 $O(mn)$ 线性时间在线直接构建出极小化 DAWG。
- 在 ENABLE 真实大词库基准下，DAWG 将节点总数削减了 86%；结合底层紧凑位图编码，能够在几十毫秒内完成闪电检索，同时将全词典体积压缩在数百千字节以内。
