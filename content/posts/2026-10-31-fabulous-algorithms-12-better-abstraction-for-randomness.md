---
title: "数据结构与算法的奇妙冒险（十二）：随机性的更优抽象"
date: 2026-10-31T01:12:00Z
description: "超越原生伪随机数生成器（PRNG），将随机性抽象为离散概率分布的一等公民对象与可组合管道。"
category: algorithms
column: fabulous-algorithms
tags: [随机算法, 概率分布, 抽象设计, 函数式, 离散概率]
---

# 第 12 章 随机性的更优抽象

### 本章要点

- 概率的两大哲学流派：频率学派与贝叶斯学派
- 表示离散概率分布的更优抽象范式
- 为什么范畴分布（Categorical Distribution）等价于掷非均匀骰子
- 范畴分布采样的四种经典算法演进
- 如何在概率分布中高效过滤特定类别

在我的大学时代，我对必修的统计学课程几乎没怎么上心。我当时觉得那些统计学术语晦涩难懂，并且天真地以为在未来的软件工程师职业生涯中用不上概率论思维。后来事实证明我只猜对了一半：那些术语**确实**很费解；但由于我最终从事的是为数据科学家构建编程工具的工作，我那薄弱的概率知识储备迫使我必须立刻恶补。

在本章中，我们将从梳理统计学基础术语开始。如果你已经拥有坚实的概率论与数理统计背景，这部分内容将是一次轻松的复习。随后，我们将超越标准库中传统的原生伪随机数生成器（PRNG），构建一套更高层级的“随机性抽象”。

正如我们不再用晦涩的底层 `while` 循环操作集合，而是借助 `Where`、`SelectMany`、`Join` 和 `GroupBy` 等高阶 LINQ 管道以声明式风格操纵序列一样，我们在处理随机性时也能从更高维度的抽象中极大受益。编写富有表现力、流畅优雅的随机采样代码固然赏心悦目，但本章的工作更是在为一种更具魔力的核心能力筑基：**在程序需要做出决策时，自动化应用贝叶斯定理（Bayes' Theorem）来严谨地吸纳新的现实世界观测证据**。我们将在第 13 章正式推演该定理，而现在，我们的首要任务是高效模拟一枚不均匀骰子的投掷。

---

## 12.1 什么是概率？

周日的大决战在红队与蓝队之间展开。赛前掷硬币红队有 50% 的概率猜对正反面；而如果他们赢得了开球权，击败蓝队的概率将升至 70%。这在数学上究竟意味着什么？

在概率论历史上，存在两大基础哲学流派：

1. **频率学派（Frequentist）**：源自实证自然科学。如果我们把同一个实验重复很多次（例如将一枚六面骰子投掷一百万次），掷出 4 点的概率就是这一百万次投掷中 4 点出现的频率占比。在频率学派眼中，**结果的概率是无限次重复试验中该结果出现的长期相对频率**。
   - 既然概率是出现次数占总试验次数的比例，它必然是介于 0 和 1 之间的实数；若永远不出现，概率为 0；若在 25% 的试验中出现，概率为 0.25。
   - 这种哲学在实验科学中无往不利，但在**无法简单重复的单次事件**面前却捉襟见肘。实验者可以在一天内抛硬币 10,000 次，但红队和蓝队的这场决战只会发生一次。在现实世界中，大量决策根本不存在“可重复试验”。

2. **贝叶斯学派（Bayesian）**：源自博弈与博彩。**概率是我们在已有观测证据的基础之上，对特定结果成立所抱有的信念置信度（Degree of confidence）**。如果我对红队战胜蓝队抱有 70% 的信心，那么只要你出价 70 美元，我就愿意与你签订一张“红队获胜赔付 100 美元，红队落败赔付 0 美元”的赌单。在贝叶斯学派眼中，概率是**随着新证据的到来而不断演进更新的主观认知**。

> **注意**  
> 尽管两派底层的微积分与代数公式完全一致，但它们对概率的认知视角截然不同。例如：我们目前无法获知圆周率 $\pi$ 的小数点后第 $10^{14}$ 位数字是什么。频率学派会认为该数字为偶数的概率只能是 0% 或 100%（因为在计算该特定位数的试验中，它要么是偶数要么不是）；而贝叶斯学派会说，在看到进一步计算证据之前，我们没有任何偏向，因此其为偶数的置信概率应当是 50%。

在本书中，我们将兼用这两套哲学：在验证算法正确性时采取**频率学派**视角（例如若一个随机过程声称以 30% 产生正面，我们就抽取 100,000 个样本，验证其样本比例是否接近 30,000 : 70,000）；而在绝大多数模型建构中，我们秉持**贝叶斯学派**立场：**概率是根据证据推导出的置信观点，而观点完全可以进行严密的数学代数运算**。

---

## 12.2 什么是离散概率分布？

**概率分布（Probability Distribution）** 是一个为各个可能结果分配对应发生概率的数学函数。

分布的所有可能结果构成的集合称为该分布的**支持集（Support）**。
- 若支持集是连续区间（例如“0.0 到 1.0 之间的所有实数”），该分布称为**连续分布**（我们将在第 15 章展开探讨）。
- 在本章与第 13 章中，支持集必须是**离散的（Discrete）**：一枚骰子掷出 1 到 6；一枚硬币产生正面或反面；从罐子里摸出红球、绿球或蓝球。

刻画离散概率分布的函数称为**概率质量函数（Probability Mass Function，简称 PMF）**，通常记作 $P$。例如一枚均匀公正的硬币，其 PMF 为：

$$P(	ext{heads}) = 0.5, \quad P(	ext{tails}) = 0.5$$

更一般地，如果有一枚具有 $n$ 个面（标号 0 到 $n-1$）的公平骰子，其支持集中任意整数 $x$ 的概率皆为 $P(x) = 1/n$，这被称为**离散均匀分布（Discrete Uniform Distribution）**。

但在现实中，各个结果的概率往往并不相等。若一个袋子中装有 5 个红球、3 个蓝球和 2 个绿球，随机摸出一个球的 PMF 为：

$$P(	ext{red}) = 0.5, \quad P(	ext{blue}) = 0.3, \quad P(	ext{green}) = 0.2$$

> **注意**  
> 离散分布的支持集理论上可以是无限的（例如泊松分布或几何分布 $P(n) = 1/2^n$），但本书聚焦于**有限离散分布**，因为我们在 12.11 节实现的别名算法需要有限支持集。

从概率分布中**采样（Sampling）**，是指依据其 PMF 所规定的概率权重，从支持集中随机抽取一个特定值。

---

## 12.3 用 Random 生成均匀采样

几乎所有主流编程语言的标准库都内置了伪随机数生成器。在 C# 中是 `Random`：

```csharp
var rnd = new Random();
int roll = rnd.Next(6); // 在 [0, 6) 之间均匀抽样
```

`Random.Next(max)` 本质上就是从支持集为 $\{0, 1, \dots, 	ext{max}-1\}$ 的离散均匀分布中抽取样本。

> **注意**  
> `Random` 生成的是**伪随机数（PRNG）**，由确定性算法生成，绝不可用于密码学安全或真金白银的博彩场景。此类场景应使用 `System.Security.Cryptography.RandomNumberGenerator`。

然而，`Random.Next(n)` 是一个极其简陋的一次性低阶工具。在复杂的业务世界中，我们希望从扑克牌堆中随机抽一张牌、从播放列表中随机选一首歌、投掷两枚骰子并求和、或者从袋子里摸出一枚不均匀硬币连续抛掷 10 次。

传统操作随机性的代码抽象层级太低了。正如现代编程不再用 `for` 循环手动迭代指针，而是通过 `IEnumerable<T>` 接口结合 `Where`、`Select` 进行流式思考一样，我们也应当为随机分布定义一组通用泛型接口：**将概率分布视作一等公民对象（First-Class Citizens）**。

---

## 12.4 IDistribution<T> 与 IDiscreteDistribution<T>

我们声明两个核心泛型接口：
- `IDistribution<T>`：最顶层的概率分布抽象，仅包含一个操作 `T Sample()`，用于抽取一个样本（第 15 章的连续分布也将基于此接口）。
- `IDiscreteDistribution<T>`：离散概率分布接口，在采样之外追加了两个能力：
  1. `Support()`：枚举有限支持集中的所有可能值。
  2. `Weight(T t)`：获取支持集中特定元素的**相对整数权重（Integer Weight）**。

我们**采用非归一化的正整数权重而非 0.0~1.0 的浮点数**来表示概率。特定元素被抽中的精确概率为其权重除以支持集中所有元素权重之和。这消除了浮点数累加无法精确凑整到 1.0 的舍入误差。

**代码清单 12.1 概率分布核心接口与离散均匀分布**

```csharp
public interface IDistribution<T>
{
    T Sample();
}

public interface IDiscreteDistribution<T> : IDistribution<T>
{
    IEnumerable<T> Support();
    int Weight(T t);
}

public sealed class DiscreteUniform : IDiscreteDistribution<int>
{
    private readonly Random rnd = new();
    private readonly int max;

    public static DiscreteUniform Distribution(int max)
    {
        if (max <= 0)
            throw new InvalidOperationException();
        return new(max);
    }

    private DiscreteUniform(int max) => this.max = max;

    public int Sample() => rnd.Next(max);
    public IEnumerable<int> Support() => Enumerable.Range(0, max);
    public int Weight(int t) => 0 <= t && t < max ? 1 : 0;
}
```

现在，投掷一枚六面骰子变成了面向对象的优雅表达：

```csharp
var DU6 = DiscreteUniform.Distribution(6);
int roll = DU6.Sample();
```

---

## 12.5 用伯努利分布抛掷不均匀硬币

抛硬币可以建模为支持集仅包含 0（反面）和 1（正面）的分布。这类两点分布以瑞士数学家雅各布·伯努利命名。

在实现伯努利分布前，先处理一个基础边界：**单点分布（Singleton Distribution）**——例如一枚两面都是正面的特制硬币，其结果毫无随机性，每次采样必然返回同一个固定值。

**代码清单 12.2 单点分布**

```csharp
public sealed class Singleton<T> : IDiscreteDistribution<T>
{
    private readonly T t;
    public static Singleton<T> Distribution(T t) => new(t);
    private Singleton(T t) => this.t = t;

    public T Sample() => t;
    public IEnumerable<T> Support() => [t];
    public int Weight(T t) =>
        EqualityComparer<T>.Default.Equals(this.t, t) ? 1 : 0;
}
```

有了单点分布与离散均匀分布，我们就能构造加权的伯努利分布。假设我们希望正面概率为 70%、反面为 30%，赋予权重 7 与 3（总权重 10）。我们只需在 $[0, 10)$ 均匀分布中抽样：若样本落在 $0, 1, 2$，产生反面 0；若落在 $3 \sim 9$，产生正面 1。

为了避免权重数值膨胀，我们使用**欧几里得最大公约数（GCD）算法**将权重化简为最简整数比（例如 30 和 70 自动约简为 3 和 7）：

**代码清单 12.3 欧几里得 GCD 算法扩展方法**

```csharp
public static class Extensions
{
    public static int GCD(this int x, int y)
    {
        while (y != 0)
            (x, y) = (y, x % y);
        return x;
    }

    public static int GCD(this IEnumerable<int> numbers) =>
        numbers.Aggregate(0, GCD);
}
```

编写通用的伯努利硬币分布：

**代码清单 12.4 伯努利硬币分布**

```csharp
public sealed class Bernoulli : IDiscreteDistribution<int>
{
    private readonly DiscreteUniform du;
    public int Zero { get; }
    public int One { get; }

    public static IDiscreteDistribution<int> Distribution(int zero, int one)
    {
        if (zero < 0 || one < 0 || (zero == 0 && one == 0))
            throw new InvalidOperationException();

        // 边界情况：两面都是反面
        if (one == 0)
            return Singleton<int>.Distribution(0);

        // 边界情况：两面都是正面
        if (zero == 0)
            return Singleton<int>.Distribution(1);

        int gcd = zero.GCD(one);
        return new Bernoulli(zero / gcd, one / gcd);
    }

    private Bernoulli(int zero, int one)
    {
        this.Zero = zero;
        this.One = one;
        this.du = DiscreteUniform.Distribution(zero + one);
    }

    public int Sample() => this.du.Sample() < Zero ? 0 : 1;
    public IEnumerable<int> Support() => [0, 1];
    public int Weight(int x) => x == 0 ? Zero : x == 1 ? One : 0;
}
```

构建一枚平均掷出 5 次反面对应 7 次正面的非均匀硬币：

```csharp
var coin = Bernoulli.Distribution(5, 7);
int flip = coin.Sample();
```

---

## 12.6 用扩展方法完善生态系统

为了让分布对象像 LINQ 一样流畅易用，我们为其构建丰富的扩展方法：
1. **`Samples()`**：将分布桥接为一个无限流式的样本序列 `IEnumerable<T>`。
2. **`Histogram()`** 与 **`ShowWeights()`**：直观打印分布的权重比率与 ASCII 字符直方图。

**代码清单 12.5 & 12.6 分布流式化与可视化扩展方法**

```csharp
public static class Extensions
{
    // 将分布转为惰性无限采样流
    public static IEnumerable<T> Samples<T>(this IDistribution<T> distribution)
    {
        while (true)
            yield return distribution.Sample();
    }

    public static string Comma<T>(this IEnumerable<T> ts) => string.Join(",", ts);
    public static string Newlines<T>(this IEnumerable<T> ts) => string.Join("
", ts);
    public static string PadLeft<T>(this T t, int width) => t!.ToString()!.PadLeft(width);

    // 默认采集 100,000 个样本绘制直方图
    public static string Histogram<T>(this IDiscreteDistribution<T> d) =>
        d.Samples().Take(100000).Histogram();

    public static string Histogram<T>(this IEnumerable<T> d)
    {
        const int barMax = 40;
        var dict = d.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
        int width = dict.Keys.Select(x => x!.ToString()!.Length).Max();
        int valueMax = dict.Values.Max();
        double scale = valueMax < barMax ? 1.0 : ((double)barMax) / valueMax;

        string Bar(T t) => new('*', (int)(dict[t] * scale));

        return dict.Keys
            .OrderBy(x => x)
            .Select(s => $"{s.PadLeft(width)}|{dict[s],-5}|{Bar(s)}")
            .Newlines();
    }

    public static string ShowWeights<T>(this IDiscreteDistribution<T> d)
    {
        int labelWidth = d.Support().Select(x => x!.ToString()!.Length).Max();
        return d.Support()
            .Select(s => $"{s.PadLeft(labelWidth)}:{d.Weight(s)}")
            .Newlines();
    }
}
```

现在可以写出极具表现力的流式代码：

```csharp
var DU6 = DiscreteUniform.Distribution(6);
Console.WriteLine(DU6.Samples().Take(10).Comma()); // 打印 10 个随机骰子结果
Console.WriteLine(DU6.Samples().Take(8).Sum());    // 连续投掷 8 次并求和
```

---

## 12.7 引入投影表示不均匀骰子投掷

硬币不仅有数字 0 和 1，更应该能输出 `"heads"` 或 `"tails"`；骰子不仅能掷出数字，更能掷出颜色（例如一面绿、两面红、三面蓝）。

为此，我们实现**投影分布（Projected Distribution）**：在底层离散分布的基础上挂载投影函数 `Func<T, R>`。在采样时直接映射结果；在计算新分布的支持集与权重时，通过 `GroupBy` 将可能的多对一映射合并求和，并约简为最简整数比。

**代码清单 12.7 投影离散分布**

```csharp
public sealed class Projected<T, R> : IDiscreteDistribution<R> where R : notnull
{
    private readonly IDiscreteDistribution<T> underlying;
    private readonly Func<T, R> projection;
    private readonly Dictionary<R, int> weights;

    public static IDiscreteDistribution<R> Distribution(
        IDiscreteDistribution<T> underlying,
        Func<T, R> projection)
    {
        // 投影后可能出现多个原元素对应同一新元素，执行权重合并
        var weights = underlying.Support()
            .GroupBy(projection, underlying.Weight)
            .ToDictionary(g => g.Key, g => g.Sum());

        int gcd = weights.Values.GCD();
        foreach (var key in weights.Keys)
            weights[key] /= gcd;

        if (weights.Count == 1)
            return Singleton<R>.Distribution(weights.Keys.First());

        return new Projected<T, R>(underlying, projection, weights);
    }

    private Projected(
        IDiscreteDistribution<T> underlying,
        Func<T, R> projection,
        Dictionary<R, int> weights)
    {
        this.underlying = underlying;
        this.projection = projection;
        this.weights = weights;
    }

    public R Sample() => projection(underlying.Sample());
    public IEnumerable<R> Support() => weights.Keys;
    public int Weight(R r) => weights.GetValueOrDefault(r, 0);
}
```

在 `Extensions` 中添加 `.Project(...)` 扩展方法后，投掷颜色骰子的代码无比直观：

```csharp
List<string> colors = ["green", "blue", "red", "blue", "red", "blue"];
var die = DiscreteUniform.Distribution(6).Project(i => colors[i]);

Console.WriteLine(die.ShowWeights());
Console.WriteLine(die.Histogram());
```

输出显示：`green:1`、`red:2`、`blue:3`，频率比率完全符合理论设计！

这正是统计学中最通用的有限离散分布——**范畴分布（Categorical Distribution）**。任何具有有限选项和任意权重的抽样，都可以抽象为范畴分布。

接下来，我们将对比四种为范畴分布采样的经典算法。

---

## 12.8 范畴分布算法一：构建大列表

最直接的朴素方案：若各类别权重和为 $W$，创建一个长度为 $W$ 的大列表，按权重填充对应元素，随后在该列表上均匀随机选取索引。

**代码清单 12.8 快速但空间低劣的大列表方案**

```csharp
static IDiscreteDistribution<T> MakeCategorical<T>(
    IList<T> categories, IList<int> weights)
{
    List<T> values = [];
    for (int i = 0; i < categories.Count; i += 1)
    {
        T category = categories[i];
        int weight = weights[i];
        for (int j = 0; j < weight; j += 1)
            values.Add(category);
    }
    return DiscreteUniform.Distribution(values.Count).Project(s => values[s]);
}
```

- **采样性能**：$O(1)$，极其高效。
- **构建与空间开销**：高达 $O(W)$（$W$ 为总权重）。若权重为 1,000,000，即使仅有 2 个类别，也必须在内存中分配百万个元素的数组，极易引发内存耗尽。

---

## 12.9 范畴分布算法二：爬梯子（累积分布）

想象一把不均匀间距的梯子：阶梯的高度对应累积权重（CDF）。若权重为 101, 99, 51, 49，阶梯高度分别为 101, 200, 251, 300。我们在 $[0, 300)$ 内均匀随机抽取高度，返回我们**未能逾越的最低阶梯编号**。

**代码清单 12.9 累积阶梯算法**

```csharp
public sealed class CategoricalLadder : IDiscreteDistribution<int>
{
    private readonly List<int> weights;

    public int Sample()
    {
        int height = DiscreteUniform.Distribution(weights.Sum()).Sample();
        int nextRungHeight = 0;
        int rung = 0;

        foreach (int weight in weights)
        {
            nextRungHeight += weight;
            if (height < nextRungHeight)
                return rung;
            rung += 1;
        }
        throw new UnreachableException();
    }
}
```

- **空间与构建复杂度**：降至 $O(n)$（$n$ 为类别数量），彻底摆脱了对权重绝对值 $W$ 的依赖。
- **采样性能**：线性扫描为 $O(n)$。若预先计算前缀和数组并改用**二分查找（Binary Search）**，可将采样耗时优化至 $O(\log n)$。

---

## 12.10 范畴分布算法三：拒绝拒绝采样

能否在不分配大内存的前提下做到 $O(1)$ 采样？有人提出了**拒绝采样（Rejection Sampling）**：在由类别数量 $n$ 和最大权重 $w_{\max}$ 构成的二维矩形靶盘上投掷均匀飞镖。若飞镖命中某类别的有效面积则返回；若命中空白区域（打了 X）则丢弃并重新投掷。

**代码清单 12.10 拒绝采样算法**

```csharp
public int Sample()
{
    var rows = DiscreteUniform.Distribution(weights.Count);
    var columns = DiscreteUniform.Distribution(weights.Max());

    while (true)
    {
        int row = rows.Sample();
        if (columns.Sample() < weights[row])
            return row; // 命中有效区域，否则死循环重试
    }
}
```

- **致命痛点**：若权重分布极度悬殊（如 `[1, 1, 1, 40]`），靶盘超过 90% 的面积都是空白。飞镖将频繁被拒绝，导致 `while` 循环反复轮询，最坏情况下采样耗时无上限！

---

## 12.11 范畴分布算法四：别名算法（Walker's Alias Method）

这是计算机科学中最为惊艳的概率算法之一——**沃克别名算法（Walker's Alias Algorithm）**。它巧妙改造了拒绝采样靶盘：**将所有过长类别的“富余面积”削切下来，填补到过窄类别的“亏损空间”中，将靶盘拼装为一个严丝合缝的 $n 	imes W$ 矩形，消除所有拒绝点！**

其核心数学事实保证：**任何具有 $n$ 个类别的非均匀分布，都可以被等价切分拼装为 $n$ 个独立的小柱体；每个柱体内部至多只包含两种类别（当前类别与其“别名”类别）！**

构建步骤：
1. 计算平均高度，将类别划分为“过窄”（Too Narrow）与“过宽”（Too Wide）两个工作池。
2. 每次从过窄池取出一个类别，从过宽池切出一块面积填满该行，构建一个**仅含两项的加权伯努利分布**。
3. 更新过宽类别的剩余宽度，直至所有行恰好被平衡填满。

**代码清单 12.11 极致 $O(1)$ 的沃克别名算法**

```csharp
public sealed class Categorical : IDiscreteDistribution<int>
{
    private readonly List<int> weights;
    private readonly IDiscreteDistribution<int> chooseRow;
    private readonly IDiscreteDistribution<int>[] distributions;

    public static IDiscreteDistribution<int> Distribution(params IEnumerable<int> weights) =>
        new Categorical(weights.ToList());

    private Categorical(List<int> weights)
    {
        if (weights.Any(x => x < 0) || weights.All(x => x == 0))
            throw new InvalidOperationException();

        int gcd = weights.GCD();
        for (int i = 0; i < weights.Count; i += 1)
            weights[i] /= gcd;

        this.weights = weights;
        int total = weights.Sum();
        int n = weights.Count;

        chooseRow = DiscreteUniform.Distribution(n);
        distributions = new IDiscreteDistribution<int>[n];

        var tooNarrow = new Dictionary<int, int>();
        var tooWide = new Dictionary<int, int>();

        for (int row = 0; row < n; row += 1)
        {
            int width = weights[row] * n;
            if (width == total)
                distributions[row] = Singleton<int>.Distribution(row);
            else if (width < total)
                tooNarrow.Add(row, width);
            else
                tooWide.Add(row, width);
        }

        while (tooNarrow.Count > 0)
        {
            (int narrowRow, int narrowWidth) = tooNarrow.First();
            tooNarrow.Remove(narrowRow);

            (int wideRow, int wideWidth) = tooWide.First();
            tooWide.Remove(wideRow);

            int fromWide = total - narrowWidth;
            // 每一行是一个伯努利分布：以 narrowWidth 产生当前行，以 fromWide 产生借调的别名行
            distributions[narrowRow] = Bernoulli.Distribution(narrowWidth, fromWide)
                .Project(x => x == 0 ? narrowRow : wideRow);

            int newWidth = wideWidth - fromWide;
            if (newWidth == total)
                distributions[wideRow] = Singleton<int>.Distribution(wideRow);
            else if (newWidth < total)
                tooNarrow[wideRow] = newWidth;
            else
                tooWide[wideRow] = newWidth;
        }
    }

    public IEnumerable<int> Support() =>
        Enumerable.Range(0, weights.Count).Where(x => weights[x] != 0);

    public int Weight(int i) => 0 <= i && i < weights.Count ? weights[i] : 0;

    // 真正的 O(1) 采样：先均匀选行，再在该行伯努利采样，零重试，零拒绝！
    public int Sample() => distributions[chooseRow.Sample()].Sample();
}
```

封装备受欢迎的通用泛型扩展：

```csharp
public static class Extensions
{
    public static IDiscreteDistribution<T> ToCategorical<T>(
        this IList<T> categories, params IEnumerable<int> weights) =>
        Categorical.Distribution(weights).Project(i => categories[i]);
}
```

无论是包含零权重的边缘情况，还是海量类别的庞大系统，别名算法都以 **$O(n)$ 预处理时间、$O(n)$ 额外空间以及极其强悍的绝对 $O(1)$ 采样速度**，成为现代统计采样工业实现的终极标杆！

---

## 12.12 过滤特定类别

在即将到来的贝叶斯条件概率推导中，一个核心诉求是：**当我们观测到某类情况不可能发生时，如何将该类别从分布中剥离，并自动将其余类别的剩余概率重新归一化？**

借助我们的架构，这只需要编写一个简洁的 `Filter` 扩展方法：

```csharp
public static class Extensions
{
    public static IDiscreteDistribution<T> Filter<T>(
        this IDiscreteDistribution<T> distribution,
        Func<T, bool> predicate)
    {
        var newSupport = distribution.Support().Where(predicate).ToList();
        var newWeights = newSupport.Select(t => distribution.Weight(t));
        return newSupport.ToCategorical(newWeights);
    }
}
```

测试过滤：构建一枚投掷出红、绿、蓝的骰子，并过滤掉所有绿色的结果：

```csharp
List<string> colors = ["green", "blue", "red"];
var die = colors.ToCategorical(1, 3, 2);

// 过滤掉 green，剩余 blue 与 red 按 3:2 自动按比例放大重新平衡！
var noGreen = die.Filter(roll => roll != "green");
Console.WriteLine(noGreen.Histogram());
```

输出显示：`green` 彻底消失，`blue` 与 `red` 严格维持了 60% 与 40% 的相对频率！

我们不仅彻底掌握了离散随机性的优雅建模与极速采样，更装备了一套能够自适应调整概率结构的动态机制。在第 13 章中，我们将见证这套工具如何化身为强大的贝叶斯推断引擎！

---

## 本章小结

- **频率学派**将概率视作长期的客观试验相对频率；**贝叶斯学派**将概率视作基于已知证据的主观置信度量，随着新证据的到来动态更新。
- 离散概率分布通过概率质量函数（PMF）为支持集中的每个元素赋予概率。采用非归一化的正整数相对权重能够彻底杜绝浮点舍入误差。
- 面向对象的分布抽象（`IDistribution<T>` 与 `IDiscreteDistribution<T>`）将随机性提升为可组合的一等公民，超越了命令式的 `Random.Next` 调用。
- 离散均匀分布等价于公平骰子；伯努利分布等价于不均匀硬币；投影分布与**范畴分布（Categorical Distribution）** 则是一切有限离散分布的母体。
- 范畴分布采样算法经历了四代演化：大列表法（$O(W)$ 空间瓶颈）、累积阶梯法（$O(\log n)$ 二分查找）、拒绝采样法（最坏情况无界循环）；以及最终巅峰的**沃克别名算法（Alias Method）**——以 $O(n)$ 预处理实现了无任何拒绝的纯粹 $O(1)$ 极速采样。
- 通过为分布挂载 `Filter` 谓词操作，我们能够随心所欲地裁剪支持集并重新平衡剩余概率，为贝叶斯条件推断铺平了道路。
