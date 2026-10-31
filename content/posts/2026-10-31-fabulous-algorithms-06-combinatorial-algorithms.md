---
title: "数据结构与算法的奇妙冒险（六）：组合算法与全排列生成"
date: 2026-10-31T01:06:00Z
description: "深入组合数学中的排列、组合、笛卡尔积与字典序全排列生成算法，以纯函数式迭代器高效实现。"
category: algorithms
column: fabulous-algorithms
tags: [组合数学, 全排列, 笛卡尔积, 迭代器, 算法设计]
---

# 第 6 章 组合算法与全排列生成

### 本章核心内容

- 生成两组、三组乃至任意多组序列的笛卡尔积（Cartesian Product）
- 生成一个序列的所有可能排列（Permutations）
- 生成一个序列的所有可能组合（Combinations）
- 揭示组合算法与整数进位制分解（阶乘进制、组合进制）之间的代数对应关系

---

组合数学（Combinatorics）如今已演进为一个极其广阔的现代数学分支，涵盖从图论到离散最优化理论的各个领域。贯穿其中的核心红线在于：我们致力于寻找高效算法，来求解涉及有限个离散元素集合（例如包含 $n$ 个整数的序列）的组合结构问题。在本章中，我们将深入攻克序列上的三大基本组合操作：

1. **笛卡尔积**（Cartesian Product）：接受若干序列，生成由各序列元素相互配对组成的所有可能元组。我们将从双序列拓展到多序列，并最终给出一个优雅生成任意多个序列笛卡尔积的纯函数式表达式。
2. **全排列**（Permutations）：生成一个有限序列所有可能重排顺序的集合。我们将探索几种历史跨越数百年的经典算法，领略它们独特的代数对称性。
3. **组合**（Combinations）：在不改变相对顺序的前提下，生成所有指定长度的子序列。

这三类操作的输出本质上都是“序列的序列”。因此，我们可以自然地提出一个逆向问题：“**给定一个整数索引 $p$，输出中的第 $p$ 个序列到底是什么？**”对这个问题的探究，将带给我们关于“整数如何分解为更小整数之和”的深刻代数洞见。

现代主流编程语言通常内置了功能强大的序列操作库（如 .NET 中的 LINQ 提供 `Select`、`Where`、`Aggregate`、`Join` 等），但我一直感到些许意外：标准类库中几乎从未直接内置生成全排列或组合的算法。每当我在自动化测试中需要暴力穷举所有边界条件组合时，都不得不亲自动手编写。这些古老而经典、历久弥新的算法充满了纯粹的逻辑美感。

---

## 6.1 笛卡尔积（The Cartesian Product）

假设你在编写一款 RPG 游戏，拥有角色职业集合与武器集合：

```csharp
HashSet<CharacterClass> cs = [new Wizard(), new Warrior(), new Thief()];
HashSet<Weapon> ws = [new Longsword(), new Wand(), new Dagger()];
```

若要输出一份描述每个角色能否装备每件武器的完整测试报告，传统的命令式双层循环如下：

```csharp
var sb = new StringBuilder();
foreach (var c in cs)
    foreach (var w in ws)
        sb.AppendLine($"{c.Name} {w.Name} {c.CanWield(w)}");
var s = sb.ToString();
```

这种写法虽然直截了当，但它突出了底层的机械循环机制，而非业务本意。在支持查询表达式的现代语言中，我们更倾向于声明式的写法：

```csharp
var q = from c in cs
        from w in ws
        select $"{c.Name} {w.Name} {c.CanWield(w)}";
var s = string.Join("\n", q);
```

无论采用何种书写形式，其数学本质都是遍历集合 $A$ 与 $B$ 的**笛卡尔积**（记作 $A \times B$，读作“A cross B”；在 SQL 领域被称为 `CROSS JOIN`）。

> **数学渊源**  
> 笛卡尔积以法国哲学家与数学家勒内·笛卡尔（René Descartes，“我思故我在”的提出者）命名。

### 6.1.1 少数集合与序列的笛卡尔积

我们首先为集合实现基础的双元与三元笛卡尔积：

代码清单 6.1 双集合笛卡尔积：

```csharp
static class Extensions
{
    public static HashSet<(A a, B b)> CartesianProduct<A, B>(
        this HashSet<A> hsa, HashSet<B> hsb)
    {
        var result = new HashSet<(A a, B b)>();
        foreach (var a in hsa)
            foreach (var b in hsb)
                result.Add((a, b));
        return result;
    }
}
```

若连续调用该方法求三个集合的积，会生成形如 `((a, b), c)` 的嵌套二元元组，极不方便阅读。为此，我们可以直接重载平坦的三元元组版本：

代码清单 6.2 三集合笛卡尔积：

```csharp
public static HashSet<(A a, B b, C c)> CartesianProduct<A, B, C>(
    this HashSet<A> hsa, HashSet<B> hsb, HashSet<C> hsc)
{
    var result = new HashSet<(A a, B b, C c)>();
    foreach (var a in hsa)
        foreach (var b in hsb)
            foreach (var c in hsc)
                result.Add((a, b, c));
    return result;
}
```

为了让操作更加通用，我们将其提升为面向任意序列 `IEnumerable<T>` 的**惰性生成器**（Lazy Generator），并允许传入投射投影函数（Projection），直接融合计算逻辑：

代码清单 6.4 带投射投影函数的通用序列笛卡尔积：

```csharp
public static IEnumerable<R> CartesianProduct<A, B, R>(
    this IEnumerable<A> seqa,
    IEnumerable<B> seqb,
    Func<A, B, R> projection)
{
    foreach (var a in seqa)
        foreach (var b in seqb)
            yield return projection(a, b);
}

public static string Newlines<T>(this IEnumerable<T> seq) =>
    string.Join("\n", seq);
```

此时生成报表一气呵成：

```csharp
string s = cs.CartesianProduct(ws, (c, w) => $"{c.Name} {w.Name} {c.CanWield(w)}").Newlines();
Console.WriteLine(s);
```

### 6.1.2 任意多个序列的笛卡尔积

如果序列的数量在编译期无法确定，而是在运行时动态传入（即输入类型为 `IEnumerable<IEnumerable<T>>`），该如何优雅求解？

首先界定边界情况：
- **0 个序列的笛卡尔积**：生成包含 1 个空序列的序列：`[ [ ] ]`（任何乘法的乘法单位元是 1，笛卡尔积的空单位元即包含一个空子集的集合）；
- **1 个序列 `[[1, 2, 3]]` 的笛卡尔积**：生成 `[[1], [2], [3]]`。

核心构建策略：从 `[ [ ] ]` 开始，逐次将下一个序列中的每一个元素追加到当前所有中间结果的右端。在第 3 章中，我们恰好实现了一个支持 $O(1)$ 均摊追加操作的不可变双端队列（`IDeque<T>`）！

代码清单 6.5 基于不可变双端队列与 LINQ 的任意序列笛卡尔积：

```csharp
public static IEnumerable<IEnumerable<T>> CartesianProduct<T>(
    this IEnumerable<IEnumerable<T>> sequences)
{
    IEnumerable<IDeque<T>> result = [Deque<T>.Empty];
    foreach (var sequence in sequences)
        result = from deque in result
                 from item in sequence
                 select deque.PushRight(item);
    return result;
}
```

利用聚合折叠算子 `Aggregate`，我们可以将其写成极具函数式韵味的单行形式：

代码清单 6.6 基于 `Aggregate` 折叠的笛卡尔积：

```csharp
public static IEnumerable<IEnumerable<T>> CartesianProduct<T>(
    this IEnumerable<IEnumerable<T>> sequences) =>
    sequences.Aggregate(
        (IEnumerable<IDeque<T>>) [Deque<T>.Empty],
        (accumulator, sequence) =>
            from deque in accumulator
            from item in sequence
            select deque.PushRight(item));
```

测试调用：

```csharp
List<string> items = ["ABC", "DEF", "GH"];
foreach (var seq in items.CartesianProduct())
    Console.Write(string.Join("", seq) + " ");
```

输出 18 个按**字典序**排布的字符串组合：
`ADG ADH AEG AEH AFG AFH BDG BDH BEG BEH BFG BFH CDG CDH CEG CEH CFG CFH`

### 6.1.3 与整数位值进制表示的内在联系

回顾十进制数：在 0 到 $10^n - 1$ 之间的任意整数 $p$，在十进制下可被分解为：
$$p = A \times 10^3 + B \times 10^2 + C \times 10^1 + D \times 10^0$$
如果将集合 `[0, 1, 2, ..., 9]` 自身连续做 $n$ 次笛卡尔积，所生成的按字典序排列的序列，**在数学上恰好与 $n$ 位十进制数的递增序列一一对应**！

二进制、八进制和十六进制同理。笛卡尔积正是多进位制数码系统的代数本原。

---

## 6.2 全排列（Permutations）

全排列是指包含 $n$ 个互异元素的序列的所有可能重排形式。排列总数遵循阶乘级暴涨：
$$n! = n \times (n-1) \times (n-2) \times \dots \times 1$$
$O(n!)$ 的增长速度比指数阶还要凶猛。

为了将算法通用化，我们只需专注于对索引序列 `[0, 1, ..., n-1]` 进行全排列生成，随后通过映射将排列应用到任意通用列表中：

代码清单 6.7 将排列映射应用到任意列表：

```csharp
static class Extensions
{
    public static IList<T> Permute<T>(this IList<T> items, IList<int> permutation)
    {
        var result = new T[items.Count];
        for (int i = 0; i < items.Count; i += 1)
            result[i] = items[permutation[i]];
        return result;
    }
}
```

### 6.2.1 包含重复元素的字典序全排列：Pandita 算法

700 多年前，14 世纪印度数学家纳拉亚纳·潘迪塔（Narayana Pandita）提出了一种极其优美的算法：给定一个当前排列，原地就地（in-place）将其修改为**字典序中的下一个排列**。该算法天然支持列表中存在重复元素！

算法四步法则：
1. **从右向左**扫描，找到第一个满足“其数值小于其右侧紧邻数值”的元素索引 `first`（若不存在，说明全数组已完全逆序降序，全排列遍历终结）；
2. **从右向左**扫描，在 `first` 右侧找到最小的、且严格大于 `items[first]` 的元素索引 `second`；
3. **交换** `items[first]` 与 `items[second]`；
4. 将 `first` 之后的所有尾部元素执行**就地翻转**（从降序恢复为字典序最小的升序）。

代码清单 6.8 Pandita 字典序下一个排列算法：

```csharp
static class Extensions
{
    public static bool Greater<T>(this IList<T> items, int x, int y)
        where T : IComparable<T> =>
        items[x].CompareTo(items[y]) > 0;

    public static void Swap<T>(this IList<T> items, int x, int y) =>
        (items[x], items[y]) = (items[y], items[x]);

    public static void ReverseRange<T>(this IList<T> items, int start, int end)
    {
        for (; start < end; start += 1, end -= 1)
            items.Swap(start, end);
    }

    public static bool NextLexiPermutation<T>(this IList<T> items)
        where T : IComparable<T>
    {
        int first = items.Count - 2;
        while (first >= 0 && !items.Greater(first + 1, first))
            first -= 1;

        if (first < 0) return false;

        int second = items.Count - 1;
        while (!items.Greater(second, first))
            second -= 1;

        items.Swap(first, second);
        items.ReverseRange(first + 1, items.Count - 1);
        return true;
    }
}
```

对包含重复字母的 `"ABBEY"` 运行该算法，可以精准生成所有不重不漏的字典序排列。

**性能分析**：最坏情况虽为 $O(n)$，但在所有 $n!$ 种可能中，有超过 50% 的情况下最后两个元素本就处于递增序，只需 2 次比较与 1 次交换即可完成。**数学均摊开销仅为每生成一个排列耗费 3 次比较与 1.5 次交换，均摊时间复杂度为坚定的 $O(1)$！**

### 6.2.2 阶乘进位制（Factorial Number System）与第 $p$ 个排列的直接定位

若序列很长，我们只想获取第 $p$ 个字典序排列（$0 \le p < n!$），无需从头迭代。

我们将 $n!$ 个排列组织为一个包含 $n$ 行、$(n-1)!$ 列的二维矩阵（表 6.1）：
- 首位元素直接由商确定：$r = p / (n-1)!$；
- 剩余部分的排列号由余数确定：$p' = p \pmod{(n-1)!}$。

这揭示了一个迷人的数学结构：**阶乘进制数系统**（Factoradic）！
任何整数 $p < n!$ 均可被唯一分解为：
$$p = c_{n-1}(n-1)! + c_{n-2}(n-2)! + \dots + c_1(1!) + c_0(0!)$$
其中每个数位系数满足 $0 \le c_i \le i$。

代码清单 6.9 基于阶乘进制直接生成第 $p$ 个排列：

```csharp
using System.Numerics;

static IList<int> GetLexiPermutation(int n, BigInteger p)
{
    var remaining = new List<int>(Enumerable.Range(0, n));
    var result = new List<int>(n);
    var f = n.Factorial();

    for (int cur = n; cur > 0; cur -= 1)
    {
        f /= cur;
        var r = (int)(p / f);
        p %= f;
        result.Add(remaining[r]);
        remaining.RemoveAt(r);
    }
    return result;
}

static class Extensions
{
    public static BigInteger Factorial(this int n)
    {
        BigInteger result = 1;
        for (int i = 2; i <= n; i += 1)
            result *= i;
        return result;
    }
}
```

### 6.2.3 Fisher–Yates 洗牌算法

经典的 Fisher–Yates 随机洗牌算法在洗牌过程中，对每个位置随机选取偏移量 $r_i$ 进行交换；这组随机数序列 $r_i$ 在本质上正是阶乘进位制下的各数位系数！若用固定的 $p$ 驱动 Fisher–Yates，便能以 $n$ 次廉价的 $O(1)$ 数组交换，在严格 $O(n)$ 时间内生成确定性的非字典序全排列。

### 6.2.4 调钟算法（Change-Ringing）与 Steinhaus–Johnson–Trotter

源自 17 世纪英国教堂钟声联鸣的“调钟问题”提出了极其苛刻的约束：**在生成的所有 $n!$ 个排列中，相邻的两个连续排列之间，必须且只能通过交换某一对物理相邻的元素得到！**

代码清单 6.12 递归调钟算法：

```csharp
static IEnumerable<IEnumerable<int>> Changes(int n)
{
    if (n == 0)
    {
        yield return [];
        yield break;
    }

    bool fromLeft = false;
    foreach (var perm in Changes(n - 1))
    {
        for (int row = 0; row < n; row += 1)
            yield return perm.InsertAt(fromLeft ? row : n - row - 1, n - 1);
        fromLeft = !fromLeft; // 左右交替蛇形穿梭插入
    }
}

static class Extensions
{
    public static IEnumerable<T> InsertAt<T>(this IEnumerable<T> items, int index, T insert)
    {
        int current = 0;
        foreach (T item in items)
        {
            if (current == index) yield return insert;
            yield return item;
            current += 1;
        }
        if (current == index) yield return insert;
    }
}
```

### 6.2.5 Even（埃文）高效调钟算法

为了避免递归插入导致的二次方开销，计算机科学家 Shimon Even 于 1973 年提出了一种基于方向向量与**移动元**（Mobile Elements）的高性能迭代算法：
- 每个数字拥有一个移动方向（向左 $-1$ 或向右 $+1$）；
- 若沿自身方向所紧邻的邻居数值严格小于自身，则该数字被称为“移动元”；
- 每次挑选全序列中**最大的移动元**，与邻居交换；
- 随后将所有比该移动元更大的元素的移动方向整体反向！

代码清单 6.14 Even 调钟算法实现：

```csharp
static IEnumerable<IList<int>> EvensChanges(int n)
{
    var perm = Enumerable.Range(0, n).ToArray();
    var dirs = Enumerable.Repeat(-1, n).ToArray(); // 初始全部向左

    bool IsMobile(int i)
    {
        int j = i + dirs[perm[i]];
        return 0 <= j && j < n && perm[j] < perm[i];
    }

    int? MaxMobile()
    {
        int max = -1;
        int? maxIndex = null;
        for (int i = 0; i < perm.Length; i += 1)
        {
            if (IsMobile(i) && perm[i] > max)
            {
                maxIndex = i;
                max = perm[i];
            }
        }
        return maxIndex;
    }

    while (true)
    {
        yield return perm.ToList();
        int? maxIndex = MaxMobile();
        if (maxIndex == null) yield break;

        int mi = maxIndex.Value;
        int m = perm[mi];
        perm.Swap(mi, mi + dirs[m]);

        for (int k = m + 1; k < n; k += 1)
            dirs[k] = -dirs[k];
    }
}
```

该算法保证了每次状态转移仅发生一次相邻元素对换，时间复杂度稳定在 $O(n)$。

---

## 6.3 组合（Combinations）

从包含 $n$ 个元素的序列中挑选 $k$ 个元素且保持原有相对顺序不变的子序列，称为**组合**。可能生成的总数遵循二项式系数（$n$ 选 $k$）：
$$\binom{n}{k} = \frac{n!}{k!(n-k)!} = \frac{n(n-1)\dots(n-k+1)}{k!}$$

代码清单 6.15 将索引组合应用到通用列表：

```csharp
static class Extensions
{
    public static IList<T> Combine<T>(this IList<T> items, IList<int> combination)
    {
        var result = new T[combination.Count];
        for (int i = 0; i < combination.Count; i += 1)
            result[i] = items[combination[i]];
        return result;
    }
}
```

### 6.3.1 逆字典序组合生成算法

按右端优先的字典序逐个演进组合：

代码清单 6.16 迭代版组合生成器：

```csharp
static bool NextLexiCombination(int n, IList<int> c)
{
    int k = c.Count;
    bool Increasable(int i) => i == k - 1 ? c[i] < n - 1 : c[i] + 1 < c[i + 1];

    int i = 0;
    while (i < k && !Increasable(i))
        i += 1;

    if (i == k) return false;

    c[i] += 1;
    for (int j = 0; j < i; j += 1)
        c[j] = j;

    return true;
}

static IEnumerable<IList<int>> Combinations1(int n, int k)
{
    var c = Enumerable.Range(0, k).ToArray();
    do
        yield return c.ToList();
    while (NextLexiCombination(n, c));
}
```

以及不带任何可变修改的纯函数式递归版本：

代码清单 6.17 纯函数式递归组合生成器：

```csharp
static IEnumerable<IDeque<int>> Combinations2(int n, int k)
{
    if (k > n || k < 0) yield break;
    if (k == 0)
    {
        yield return Deque<int>.Empty;
        yield break;
    }

    // 第一分支：不包含最大元素 n - 1 的组合
    foreach (var r in Combinations2(n - 1, k))
        yield return r;

    // 第二分支：包含最大元素 n - 1 的组合
    foreach (var r in Combinations2(n - 1, k - 1))
        yield return r.PushRight(n - 1);
}
```

### 6.3.2 组合数与 Choose 算子的极简递推

为了避免计算大数阶乘引发溢出，我们使用递推恒等式：
$$\binom{n}{k} = \binom{n}{k-1} \times \frac{n - k + 1}{k}$$

代码清单 6.18 高效的 Choose 算子：

```csharp
static class Extensions
{
    public static BigInteger Choose(this int n, int k)
    {
        if (k > n) return 0;
        if (k > n / 2) k = n - k; // 利用对称性削减循环次数
        BigInteger result = 1;
        for (int i = 1; i <= k; i += 1)
            result = result * (n - k + i) / i; // 乘除顺序必须严格保证整除
        return result;
    }
}
```

### 6.3.3 组合进位制与 Macaulay 麦考利表示法

在全排列中，我们发现了阶乘进制；而在组合中，存在同样惊人的**组合数系统**（Combinatorial Number System，又称 **Macaulay 表示法**）。

**数学定理**：对于任意确定的阶数 $k$，任何非负整数 $p$ 都可以**唯一地**表示为 $k$ 个严格递减的正整数组合的二项式系数之和：
$$p = \binom{x_0}{1} + \binom{x_1}{2} + \dots + \binom{x_{k-1}}{k}$$
其中 $0 \le x_0 < x_1 < \dots < x_{k-1}$！

更为奇妙的是：**这组系数 $(x_0, x_1, \dots, x_{k-1})$ 恰恰正是字典序下第 $p$ 个组合所选取的元素本身，而且该公式甚至完全不需要知道全集总量 $n$ 的大小！**

代码清单 6.21 直接通过组合值计算其全局序号：

```csharp
static class Extensions
{
    public static BigInteger GetCombNumber(this IList<int> comb)
    {
        BigInteger result = 0;
        int k = comb.Count;
        for (int i = 0; i < k; i += 1)
            result += comb[i].Choose(i + 1);
        return result;
    }
}
```

无需任何复杂的递归与列表回溯，数学恒等式以纯粹的代数力量直接将离散组合映射到了整数坐标轴之上。

---

## 本章小结

- 笛卡尔积是嵌套循环的数学代数表达。利用不可变双端队列（`IDeque<T>`）配合 `Aggregate` 折叠，可以在无需运行时反射的前提下，以完全惰性的方式优雅生成任意多个动态序列的笛卡尔积。
- 字典序全排列的经典解法——Pandita 算法，仅通过 4 步就地指针调整，便实现了均摊 $O(1)$ 的高速全排列枚举，且天然支持序列中存在重复元素。
- 调钟算法（Change-Ringing）解决了相邻排列只允许单次相邻对换的极度受限生成难题；Even 算法利用方向数组与最大移动元标记，将单次生成开销降至线性阶 $O(n)$。
- 组合（Combinations）既可以通过就地指针探测生成，也可以通过将全集划分为“包含末位”与“不包含末位”两个正交子集实现优雅的纯函数式递归。
- 组合数学与数论进制系统存在深刻统一：常规计数法是笛卡尔积的映射，全排列映射了阶乘进制（Factoradic），而组合数则精确对应了麦考利组合数系统（Macaulay Representation）。
