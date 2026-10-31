---
title: "数据结构与算法的奇妙冒险（十五）：连续概率分布采样实战"
date: 2026-10-31T01:15:00Z
description: "逆变换采样法、拒绝采样法与 Box-Muller 变换：如何在受限硬件上高效采样正态分布与指数分布。"
category: algorithms
column: fabulous-algorithms
tags: [连续分布, 蒙特卡洛, 采样算法, Box-Muller, 概率统计]
---

# 第 15 章 连续概率分布采样实战

### 本章要点

- 针对均匀分布与正态分布的专用高效采样算法
- 逆变换采样法（Inverse Transform Method）的数学推导与通用实现
- 拒绝采样法（Rejection Sampling）的几何直觉、包络构造与截断优化
- 连续概率密度函数（PDF）与累积分布函数（CDF）的程序化建模

在全书第三部分的前几章中，我们已经攻克了离散概率范畴内的两项核心任务：生成服从特定离散分布的随机样本，以及运用贝叶斯定理根据新观测证据动态校正先验置信度。

在本书最后的两个巅峰章节中，我们将直面一个更具挑战性的数学难题：**将这两项核心能力拓展到一维连续概率分布（Continuous Probability Distributions）——即取值于实数域的随机连续变量**。

本章将聚焦于从各类特定连续分布中高效抽样的核心算法与几何推导；而第 16 章将带领我们攻克连续变量上的全自动贝叶斯后验推断。

---

## 15.1 什么是连续概率分布？

连续分布的支持集是一个**连续的实数区间**，因此对其采样输出的是实数（浮点数）。例如工业生产流水线制造的圆形零件，其直径受机床振动影响会出现微小的随机波动，测得的直径是一个取自连续区间的实数。此外，概率本身也是实数。在反作弊系统中，我们常常需要建模形如“某新账号是机器人的概率约为 90%”这样对概率本身的连续信念估计，并随用户后续行为持续修正。

离散分布使用概率质量函数（PMF）刻画，而连续分布则由**概率密度函数（Probability Density Function，简称 PDF）** 表征：它接收一个实数，返回一个非负实数，且曲线下方的总积分面积有限。

观察一个在 0.0 到 1.0 之间非零、其余区域皆为零的经典 PDF 范例：

```csharp
double P(double x) =>
    (0.0 <= x && x <= 1.0) ?
        Math.Pow(x, 0.5) * Math.Pow(1.0 - x, 1.5) :
        0.0;
```

形如 $P(x) = x^a(1-x)^b$ 的分布被称为 **Beta 分布**，它经常在随机生成概率置信度的先验模型中担任核心角色。

从连续分布中抽样，在几何上等价于：**向该 PDF 曲线与横轴所围成的阴影区域内均匀投掷一枚二维飞镖，落点的 $x$ 坐标就是本次采样的样本值！**

样本落在某个区间 $[x_1, x_2]$ 内的概率，精确等于该区间下方对应的曲线积分面积除以曲线下方的总面积。

> **注意**  
> 若曲线下方的全域积分总面积恰好严格等于 1.0，该 PDF 被称为**归一化概率密度函数（Normalized PDF）**。若已知 PDF 已归一化，我们无需额外除以总面积。但在实际工程数值计算中，我们往往直接处理**非归一化的 PDF（Non-normalized PDF）**。

连续 PDF 的一个优良几何特性是：我们可以极快估算样本落在目标值 $s$ 附近的微小邻域 $[s, s+\epsilon]$ 内的概率——它近似等于宽为 $\epsilon$、高为 $P(s)$ 的窄矩形面积除以总面积。

如何编写程序从任意给定的连续分布中抽取样本？我们将系统推演三种经典算法：
1. **特定分布的专用几何算法**（如用于正态分布的 Box-Muller 变换）；
2. **逆变换采样算法**（基于累积分布函数与分位数函数）；
3. **拒绝采样算法**（基于包络分布的投针检验）。

---

## 15.2 连续均匀分布采样

**连续均匀分布（Continuous Uniform Distribution）** 在给定的最小值和最大值区间内生成等概率的实数。若区间为 $[0.0, 1.0]$，称为**标准连续均匀分布**。

在连续领域中，实数无法被穷举枚举，且权重为连续密度值而非整数。因此我们需要重构专属于连续分布的接口：

**代码清单 15.1 浮点加权分布接口与标准连续均匀分布**

```csharp
public interface IWeightedDistribution<T> : IDistribution<T>
{
    double Weight(T value);
}

public interface IContinuousDistribution : IWeightedDistribution<double>
{ }

public sealed class ContinuousUniform : IContinuousDistribution
{
    private readonly double min;
    private readonly double max;
    private readonly Random rnd = new();

    public static readonly ContinuousUniform Standard = new(0.0, 1.0);

    public static ContinuousUniform Distribution(double min, double max) =>
        new(min, max);

    private ContinuousUniform(double min, double max)
    {
        if (min >= max)
            throw new ArgumentException("区间下限必须严格小于上限！");
        this.min = min;
        this.max = max;
    }

    public double Weight(double x) => (min <= x && x <= max) ? 1.0 : 0.0;

    public double Sample() => rnd.NextDouble() * (max - min) + min;
}
```

为了直观观察连续分布的形态，我们需要支持垂直方向的 ASCII 字符直方图绘制，将连续区间划分为 40 个纵向柱体：

**代码清单 15.2 连续分布的垂直 ASCII 直方图**

```csharp
static class Extensions
{
    public static string Histogram(
        this IContinuousDistribution d, double low, double high) =>
        d.Samples().Take(100000).Histogram(low, high);

    public static string Histogram(
        this IEnumerable<double> d, double low, double high)
    {
        const int width = 40;
        const int height = 20;
        int[] columns = new int[width];

        foreach (double sample in d)
        {
            int column = (int)(width * (sample - low) / (high - low));
            if (0 <= column && column < width)
                columns[column] += 1;
        }

        int max = columns.Max();
        double scale = max < height ? 1.0 : ((double)height) / max;
        var sb = new StringBuilder();

        for (int row = height - 1; row >= 0; row -= 1)
        {
            foreach (var b in columns)
                sb.Append(b * scale > row ? '*' : ' ');
            sb.AppendLine();
        }

        return sb.ToString();
    }
}
```

打印标准连续均匀分布：

```csharp
Console.WriteLine(ContinuousUniform.Standard.Histogram(0.0, 1.0));
```

输出的直方图在整个区间上呈现出几乎完全平齐的矩形方块，反映了样本在每个微小区间内的绝对均匀性。

---

## 15.3 正态分布采样：Box-Muller 变换

**正态分布（Normal Distribution，或高斯分布 Gaussian Distribution）** 是自然界与工业工程中无处不在的钟形曲线。零件尺寸、热噪声、测量误差大多服从正态分布。

正态分布由两个核心参数决定：**均值（Mean，$\mu$）** 标志分布的中心对称轴；**标准差（Standard Deviation，$\sigma$）** 衡量离散离散程度。其非归一化的标准正态 PDF 为：

$$P(x) = \exp\left(-rac{x^2}{2}ight)$$

正态分布的尾部衰减极其剧烈，距离均值超过 4 个标准差之外的极端样本在统计学上微乎其微。

计算机底层通常只提供均匀伪随机数生成器，如何将其转化为完美的正态分布？

数学家乔治·博克斯（George Box）与默文·穆勒（Mervin Muller）在 1958 年提出了惊艳的 **Box-Muller 变换算法**：
1. 从标准连续均匀分布中抽取两个独立样本 $U_1, U_2 \in (0, 1]$。
2. 将其转化为极坐标下的随机半径与随机相角：
   $$R = \sqrt{-2 \ln(U_1)}, \quad \Theta = 2\pi U_2$$
3. 将该极坐标点投影回笛卡尔平面直角坐标系：
   $$X = R \cos(\Theta), \quad Y = R \sin(\Theta)$$
4. **数学上已严格证明：$X$ 与 $Y$ 彼此独立，且严格服从均值为 0、标准差为 1 的标准正态分布！**

**代码清单 15.3 基于 Box-Muller 变换的正态分布实现**

```csharp
using static System.Math;

public sealed class Normal : IContinuousDistribution
{
    private readonly double mean;
    private readonly double stddev;

    public readonly static Normal Standard = Distribution(0, 1);

    public static Normal Distribution(double mean, double stddev) =>
        new Normal(mean, stddev);

    private Normal(double mean, double stddev)
    {
        this.mean = mean;
        this.stddev = stddev;
    }

    // Box-Muller 极坐标变换生成标准正态样本
    private static double StandardSample()
    {
        var radius = Sqrt(-2.0 * Log(ContinuousUniform.Standard.Sample()));
        var angle = ContinuousUniform.Distribution(0, 2 * PI).Sample();
        return radius * Cos(angle);
    }

    private static double StandardWeight(double x) => Exp(-x * x / 2.0);

    // 通过线性平移与尺度缩放获得任意指定均值与标准差的正态样本
    public double Sample() => stddev * StandardSample() + mean;

    public double Weight(double x) => StandardWeight((x - mean) / stddev);
}
```

测试模拟零件均值 60.0mm、标准差 0.1mm 的制造流水线：

```csharp
Console.WriteLine(Normal.Distribution(60.0, 0.1).Histogram(59.6, 60.4));
```

控制台完美浮现出对称优雅的高斯钟形曲线：

```text
                  ****
                 *****
                 ******
                ********
                ********
               **********
              ************
             **************
            ****************
           ******************
          ********************
         **********************
        ************************
****************************************
```

---

## 15.4 逆变换采样法

Box-Muller 算法虽然精妙，但它仅适用于正态分布。若面对一个任意给定的已知连续分布，我们该如何进行通用采样？

我们在第 12 章曾介绍过离散分布的“爬梯子”算法（累积分布前缀和）。**逆变换采样法（Inverse Transform Method）** 正是该思想在连续微积分世界中的直接对应：

1. **累积分布函数（Cumulative Distribution Function，简称 CDF）**：对归一化 PDF $P(t)$ 在 $(-\infty, x]$ 上进行积分：
   $$F(x) = \int_{-\infty}^{x} P(t) \, dt$$
   CDF $F(x)$ 严格单调不减，左端趋近于 0.0，右端趋近于 1.0。它输出的是“样本小于等于 $x$ 的累积概率”。
2. **分位数函数（Quantile Function）**：CDF 的反函数，记作 $Q(p) = F^{-1}(p)$。CDF 接收实数返回概率；**分位数函数则接收概率 $p \in [0, 1]$，返回对应的实数分位点 $x$**。
3. **逆变换黄金法则**：从标准连续均匀分布中抽取一个随机概率值 $p \sim 	ext{Uniform}(0, 1)$，代入分位数函数计算 $x = Q(p)$。**得到的 $x$ 严格服从以 $P$ 为密度的目标连续分布！**

**代码清单 15.4 通用逆变换采样包装器**

```csharp
public class FromQuantile : IContinuousDistribution
{
    private readonly Func<double, double> pdf;
    private readonly Func<double, double> quantile;

    public FromQuantile(Func<double, double> pdf, Func<double, double> quantile)
    {
        this.pdf = pdf;
        this.quantile = quantile;
    }

    public double Sample() => quantile(ContinuousUniform.Standard.Sample());
    public double Weight(double x) => pdf(x);
}
```

以物理学与重尾金融建模中极其关键的**柯西分布（Cauchy Distribution）** 为例：其形态类似钟形曲线，但具有远比正态分布更宽广肥厚的尾部（Fat Tails）。

其归一化 PDF、积分得到的 CDF 与反函数分位数函数推导如下：
- $	ext{PDF}(x) = rac{1}{\pi (1 + x^2)}$
- $	ext{CDF}(x) = rac{rctan(x)}{\pi} + 0.5$
- **$	ext{Quantile}(p) = 	an\left(\pi (p - 0.5)ight)$**

**代码清单 15.5 仅用数行代码实现的标准柯西分布**

```csharp
using static System.Math;

public sealed class Cauchy : FromQuantile
{
    private static double PDF(double x) => 1.0 / (1.0 + x * x);
    private static double Quantile(double p) => Tan(PI * (p - 0.5));

    public readonly static Cauchy Standard = new();
    private Cauchy() : base(PDF, Quantile) { }
}
```

打印柯西分布在 $[-4.0, 4.0]$ 上的直方图，清晰展现了其在远离中心的广大区域依然拥有可观出现概率的厚尾特性。

---

## 15.5 拒绝采样法（Rejection Sampling）

只要能够解析求出 CDF 的反函数（分位数函数），逆变换采样就是最完美的通用方案。然而，在面对复杂的实际工程模型时，绝大多数 PDF 的微积分原函数根本无法用初等解析式表达。我们常常只能数值计算一个非归一化的 $P(x)$。

此时，**连续拒绝采样法（Rejection Sampling）** 登场。其运行前提只需要三项条件：
1. **目标 PDF 函数**：能够计算任意 $x$ 处的非归一化权重 $P_{	ext{target}}(x)$。
2. **易于采样的辅助分布（Helper/Proposal Distribution）**：其支持集包含目标分布的支持集（例如标准正态分布）。
3. **包络缩放因子（Scale Factor，$M$）**：一个常数标量，确保缩放后的辅助分布在任何位置都**严格盖过**目标分布：
   $$M 	imes P_{	ext{helper}}(x) \ge P_{	ext{target}}(x), \quad orall x$$

几何直觉：我们向缩放后的辅助分布曲线下方的几何区域内均匀投掷飞镖（横坐标由辅助分布生成，纵坐标在 $[0, M 	imes P_{	ext{helper}}(x)]$ 间均匀抽取）。**若飞镖落在目标曲线下方，接受该点；若落在两曲线之间的留白空白区域，果断拒绝并重新投掷！**

**代码清单 15.6 连续拒绝采样器实现**

```csharp
public sealed record class Rejection(
    Func<double, double> Target,
    IContinuousDistribution Helper,
    double Scale
) : IContinuousDistribution
{
    public double Weight(double x) => Target(x);

    public double Sample()
    {
        while (true)
        {
            // 步骤 1：从易于采样的建议分布中抽取候选 x
            double x = Helper.Sample();
            double weight = Weight(x);

            if (weight == 0.0)
                continue; // 落在目标支持集外直接拒绝

            // 步骤 2：在该 x 处的建议分布包络顶峰高度下均匀抽取随机高度 y
            double max = Helper.Weight(x) * Scale;
            double y = ContinuousUniform.Distribution(0.0, max).Sample();

            // 步骤 3：投针测试：落点是否位于目标 PDF 曲线下方？
            if (y <= weight)
                return x; // 接受样本！
        }
    }
}
```

测试一个由两个高斯波峰叠加而成的复合双峰分布（Gaussian Mixture）：

```csharp
// 目标双峰分布：exp(-x^2) + exp(-10*(x-1)^2)
Func<double, double> target = x =>
    Exp(-x * x) + Exp((1.0 - x) * (x - 1.0) * 10.0);

// 以标准正态分布为辅助，缩放因子设为 2.5 形成完整包络
var mixture = new Rejection(target, Normal.Standard, 2.5);
Console.WriteLine(mixture.Histogram(-2.0, 3.0));
```

打印出的直方图精确呈现出左低右高的不对称经典双峰形态！

### 15.5.1 拒绝采样的绝妙副产物：分布截断（Clamping）

拒绝采样的一个极为实用的特化场景是**区间截断（Truncation / Clamping）**。

例如，用正态分布模拟某种残次品故障率时，理论上的无穷尾部会出现负数或大于 100% 的荒谬数字。我们希望在保留正态核心形态的同时，强行切除两端不合常理的尾部：

**代码清单 15.7 优雅的分布截断扩展**

```csharp
public static class Extensions
{
    public static IContinuousDistribution Clamp(
        this IContinuousDistribution original, double min, double max) =>
        new Rejection(
            d => (min <= d && d <= max) ? original.Weight(d) : 0.0,
            original,
            1.0 // 辅助分布就是原分布自身，缩放因子仅需 1.0！
        );
}
```

截断后的正态分布两翼戛然而止，既保留了原汁原味的曲率，又剔除了非法状态。

### 15.5.2 拒绝采样法的阿喀琉斯之踵

尽管拒绝采样极其通用，但在高维或复杂场景下面临两大致命瓶颈：
1. **抽样效率无法保证（潜在的无界循环）**：如果包络分布与目标分布贴合不够紧密，留白区域将无比庞大。飞镖将频繁被拒绝，导致 `while` 循环出现严重性能退化。
2. **难以自动化构建紧密包络**：寻找一个完美的辅助分布及其缩放因子 $M$ 往往极度依赖数学家的经验与手动调参；在未知高维复杂分布中，几乎不可能全自动求得一个既处处盖过目标又不至于过度留白的包络。

面对这一困境，统计物理与计算机科学大师们给出了终极答案：**马尔可夫链蒙特卡洛（MCMC）与 Metropolis-Hastings 算法**。在第 16 章，我们将见证这把能够无需任何包络、无需分位数函数、直接在任意高维连续后验空间自由漫游采样的终极利刃！

---

## 本章小结

- **连续概率分布**由概率密度函数（PDF）刻画，样本落在区间的概率等于局部积分面积占总面积的比例。
- **连续均匀分布**是连续采样的基石；针对高斯分布，**Box-Muller 变换**利用极坐标投影将两个独立均匀随机数高效转化为严格的正态样本。
- **逆变换采样法**通过将均匀随机概率注入**累积分布函数（CDF）的反函数——分位数函数（Quantile Function）**，能够精确高效地采样包括柯西分布在内的任意已知单变量连续分布。
- **连续拒绝采样法**通过引入易采样的辅助分布与缩放包络，利用几何投针检验，使得我们能够为无初等积分解的非归一化复合密度函数进行采样，并能自然实现分布的区间截断。
- 拒绝采样的效率高度受制于包络留白面积，且高维下难以自动化调参，这促使我们向全书压轴的马尔可夫链采样技术迈进。
