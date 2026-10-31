---
title: "数据结构与算法的奇妙冒险（十六）：马尔可夫过程与 Metropolis-Hastings 采样算法"
date: 2026-10-31T01:16:00Z
description: "全书巅峰实战：马尔可夫链蒙特卡洛（MCMC）原理与 Metropolis-Hastings 算法在复杂高维空间采样中的应用。"
category: algorithms
column: fabulous-algorithms
tags: [马尔可夫链, MCMC, Metropolis算法, 随机过程, 采样]
---

# 第 16 章 马尔可夫过程与 Metropolis-Hastings 采样算法

### 本章要点

- 运用马尔可夫过程（Markov Processes）生成具有状态依赖的随机序列
- 基于词频转移的马尔可夫文本生成与现代大语言模型（LLM）的本质映射
- 破除维度灾难：无需归一化常数的连续贝叶斯后验概率密度推导
- Metropolis 采样算法的核心机制、接受率判定与对称建议转移
- 全书实战收官：在连续后验参数空间完成自动化贝叶斯推断

在这场关于程序中随机性应用的漫长探索之旅中，最后的终极关卡是：**如何从任意给定的连续概率分布中高效抽样**。

具体而言，我们希望构建一个描摹现实世界规律的先验分布模型，依据对真实世界的连续观测证据对模型进行条件约束，从而精确推导出能够动态更新认知模型的**连续后验分布（Continuous Posterior Distribution）**。

在充满未知与波动的现实世界中，构建自主决策系统的软件必须依赖严谨、符合数学原理的算法。本章的算法正是这套体系的基石。

**马尔可夫过程（Markov Process）**——今天语言模型用于生成文本的基础——同时也是现代计算物理与统计学中用于从连续后验分布中采样的 **Metropolis 算法** 的数学基石。让我们开启全书最后的巅峰冒险：先从广义的马尔可夫过程漫游起步，随后运用它彻底攻克连续概率后验采样的堡垒。

---

## 16.1 什么是马尔可夫过程？

先看几个生动的现实场景：
- 你漫步在陌生城市的十字路口。你随机选择一个方向前行，直到抵达下一个十字路口；随后你再次随机决定是停下脚步，还是挑选一个方向继续前行。
- 赌场里的赌徒口袋里揣着若干 1 美元筹码。只要筹码未空，他会在轮盘赌桌上下注随机数量的筹码，或者选择收手回家。
- 一位科技富豪试图向投资人证明自己发明了“通用人工智能”。他的工程师编写了一个基于上文预测下一个词的自动补全算法，随机生成一串看起来颇为顺畅的句子。

这些场景在数学本质上都是**马尔可夫过程**，以俄罗斯数学家安德雷·马尔可夫（Andrey Markov）命名。它们具备以下共性特征：
1. **初始状态随机性**：系统始于某个随机抽取的初始状态。状态可以是任何实体：空间中的物理坐标、口袋里的筹码数量、或者一个单词。状态既可以是离散的（如整数个筹码），也可以是连续的（如浮点数）。
2. **无记忆性状态转移（Memorylessness）**：系统在当前状态下，要么终止序列，要么根据**当前状态**随机转移到一个全新的后继状态。**新状态的候选概率分布仅仅取决于当前所处的状态，而与如何到达当前状态的漫长历史毫无关联！** 序列既可以是有限步终止的，也可以是无限演进的。
3. **样本形态**：马尔可夫过程抽取出的单个样本，是一个**状态序列（Sequence of States）**。

我们以泛型设计实现一个通用的马尔可夫过程：
- 状态类型泛化为类型参数 `T`。
- 马尔可夫过程是一个产生 `IEnumerable<T>` 序列的分布 `IDistribution<IEnumerable<T>>`。
- 初始状态从 `IDistribution<T> initial` 中抽样。
- **状态转移函数**接收当前状态并返回可能的新状态分布：`Func<T, IDistribution<T>> transition`。若转移函数返回空分布（第 14 章的 `Empty<T>`），序列自然终止。

**代码清单 16.1 通用马尔可夫过程**

```csharp
sealed class Markov<T> : IDistribution<IEnumerable<T>>
{
    private readonly IDistribution<T> initial;
    private readonly Func<T, IDistribution<T>> transition;

    public static Markov<T> Distribution(
        IDistribution<T> initial,
        Func<T, IDistribution<T>> transition) =>
        new Markov<T>(initial, transition);

    private Markov(
        IDistribution<T> initial,
        Func<T, IDistribution<T>> transition)
    {
        this.initial = initial;
        this.transition = transition;
    }

    public IEnumerable<T> Sample()
    {
        var distribution = initial;
        while (distribution is not Empty<T>)
        {
            var state = distribution.Sample();
            yield return state;
            distribution = transition(state);
        }
    }
}
```

测试经典的“赌徒破产问题”（Gambler's Ruin）：状态为你剩余的筹码数。若筹码归 0（输光）或达到 10（赢够止盈），则离场终止；否则抛硬币，以各 50% 概率筹码减一或加一：

```csharp
IDistribution<int> GamblersTransition(int pocket) =>
    (pocket == 0 || pocket == 10) ?
        Empty<int>.Distribution :
        DiscreteUniform.Distribution(2)
            .Project(x => x == 0 ? pocket - 1 : pocket + 1);

// 初始随机带 4~7 枚筹码入场
var initial = DiscreteUniform.Distribution(4).Project(x => x + 4);
var gamblersRuin = Markov<int>.Distribution(initial, GamblersTransition);

// 产生一次完整的赌博漫游序列
Console.WriteLine(gamblersRuin.Sample().Comma());
```

输出了一条典型的随机游走轨迹：

```text
5,4,3,4,5,6,5,4,3,2,1,2,1,2,1,0
```

对 100,000 次模拟的游走步长绘制直方图，展现出大多在 8~9 步出局，但尾部极其厚重（最长一次游走持续了 287 步）。

马尔可夫过程在自然科学与现代工业中无所不在：
- **微观布朗运动**：悬浮在液体中的花粉颗粒，下一步的位置是当前位置的随机扰动。
- **DNA 基因突变**：受辐射影响时，碱基序列的改变是在现有序列基础上的随机替换。
- **分布式工作队列（Work Queue）**：状态由当前队列中的任务数、工作节点数与在线客户端数构成；系统根据当前状态动态加减任务，能够精准推导系统最大排队长度与请求平均等待延迟。

---

## 16.2 马尔可夫文本生成

如果马尔可夫过程的状态是一个“单词”，那么该过程就会源源不断地生成由词构成的句子。

我们来构建一个简单的莎士比亚文风随机文本生成器：
1. 读取莎士比亚戏剧全集文本文件，切分为由单词构成的句子列表。
2. 初始分布统计每个句子首单词的出现频次。
3. 状态转移函数统计每一个单词后面紧随出现的各个单词的频率权重；遇到句号等句尾符号时返回空分布。
4. 对马尔可夫过程抽样，即可生成全新随机伪造的“莎士比亚风格句子”。

**代码清单 16.2 基础分词断句扩展方法**

```csharp
public static class Extensions
{
    static readonly char[] punct = "*()[]#:;_"".ToCharArray();

    public static IEnumerable<List<string>> Sentences(this IEnumerable<string> lines)
    {
        List<string> current = [];
        foreach (var line in lines)
        {
            foreach (var word in line.Split())
            {
                var trimmed = word.Trim(punct);
                if (trimmed.Length > 0)
                {
                    current.Add(trimmed);
                    char c = trimmed[trimmed.Length - 1];
                    // 遇到句号、感叹号、问号判定为句子结束
                    if (c == '.' || c == '!' || c == '?')
                    {
                        yield return current;
                        current = [];
                    }
                }
            }
        }
    }

    public static string Space<T>(this IEnumerable<T> ts) => string.Join(" ", ts);
}
```

构建可变频次统计器与马尔可夫建造者：

**代码清单 16.3 & 16.4 范畴分布构建器与马尔可夫过程构建器**

```csharp
sealed class CategoricalBuilder<T> where T : notnull
{
    private Dictionary<T, int> weights = [];

    public void Add(T t) => weights[t] = weights.GetValueOrDefault(t) + 1;

    public IDistribution<T> ToDistribution()
    {
        var keys = weights.Keys.ToList();
        return keys.ToCategorical(keys.Select(k => weights[k]));
    }
}

sealed class MarkovBuilder<T> where T : notnull
{
    private CategoricalBuilder<T> initial = new();
    private Dictionary<T, CategoricalBuilder<T>> transitions = new();

    public void AddInitial(T t) => initial.Add(t);

    public void AddTransition(T t1, T t2)
    {
        if (!transitions.ContainsKey(t1))
            transitions[t1] = new();
        transitions[t1].Add(t2);
    }

    public Markov<T> ToDistribution()
    {
        var init = initial.ToDistribution();
        var trans = transitions.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.ToDistribution());

        return Markov<T>.Distribution(init,
            k => trans.GetValueOrDefault(k, Empty<T>.Distribution));
    }
}
```

对莎士比亚文本完成统计并生成 8 个随机句子：

```csharp
var sentences = File.ReadLines("shakespeare.txt").Sentences();
var mb = new MarkovBuilder<string>();

foreach (var sentence in sentences)
{
    mb.AddInitial(sentence[0]);
    for (int i = 0; i < sentence.Count - 1; i += 1)
        mb.AddTransition(sentence[i], sentence[i + 1]);
}

var markov = mb.ToDistribution();
Console.WriteLine(markov.Samples().Take(8).Select(x => x.Space()).Newlines());
```

生成结果带有一股鲜明的莎士比亚风味，但通篇不知所云：

```text
PAGE.
Bear free itself, but not from his gleeks?
Pardon me, good man of courtesy, for some
sailor's wife hear it in so treacherous feet
were she was to break our present recompense.
Tongues spit all this noble Antony.
A public ear of what dignity,
Like sweet society, True honest kindness.
```

几打代码就构成了一个最原始的“语言模型”。为什么今天的**大语言模型（LLM）**能够写出极其通顺连贯的长篇大作？
- **上下文状态窗口（N-gram 与注意力机制）**：基础马尔可夫链是**无记忆的**，下一个词仅由前一个词决定，导致句尾与句首彻底脱节。现代 LLM 则将前面生成的几千甚至上万个词构成的全部上下文作为当前“状态”来预测下一个 Token。
- **海量语料与统计模式挖掘**：通过数以万亿计的参数学习深层语义嵌入与统计关联。

然而，无论参数规模有多大，**其底层的马尔可夫随机过程本质从未改变：它们都是在给定前序状态的条件下，依据条件概率分布随机采样出下一个 Token**。马尔可夫过程内部从未真正诞生过自主思考或表达意图——它没有通盘的思想规划，不会写到一半突然意识到之前的用词错误而回溯重写。所有的“意义”与“意图”，完全取决于阅读这些文字的人类心中的投射。

---

## 16.3 计算连续分布的后验概率

走出文本生成的插曲，让我们将马尔可夫过程应用到最硬核的数学领域：**在连续实数空间中求解贝叶斯后验推断**。

回顾连续贝叶斯定理：

$$P(A|	ext{evidence}) = rac{P(A) 	imes P(	ext{evidence}|A)}{P(	ext{evidence})}$$

- $P(A)$ 是参数的**连续先验密度函数** `prior.Weight(a)`。
- $P(	ext{evidence}|A)$ 是**似然函数** `likelihood(a).Weight(evidence)`。
- 分母 $P(	ext{evidence})$ 是一个归一化常量积分 $\int P(A) P(	ext{evidence}|A) \, dA$。

**最令人生畏的计算瓶颈就在于分母 $P(	ext{evidence})$**：在复杂的现实模型中，对高维或不可积的联合函数求解全域积分在解析上根本不可行！

然而，一个惊人的数学契机拯救了我们：**对于固定的观测证据而言，分母 $P(	ext{evidence})$ 只是一个恒定的数值标量！**

回顾第 15 章：如果一个采样算法能够直接在**非归一化概率密度函数（Non-normalized PDF）** 上运行，那么我们根本不需要知道这个分母常数到底是多少！后验的相对概率密度完全可以简写为：

$$	ext{PosteriorPDF}(a) = 	ext{prior.Weight}(a) 	imes 	ext{likelihood}(a).	ext{Weight}(	ext{evidence})$$

**代码清单 16.5 连续后验函数骨架**

```csharp
static class Extensions
{
    public static Func<B, IContinuousDistribution> Posterior<B>(
        this IContinuousDistribution prior,
        Func<double, IWeightedDistribution<B>> likelihood)
    {
        return (B evidence) =>
        {
            // 关键洞察：非归一化后验 PDF 直接等于先验密度乘以观测似然！
            Func<double, double> posteriorPDF = a =>
                prior.Weight(a) * likelihood(a).Weight(evidence);

            // 我们需要一个无需分母归一化、仅凭非归一化 PDF 就能极速采样的奇迹引擎！
            return Miracle.Distribution(posteriorPDF);
        };
    }
}
```

这个所需的“奇迹引擎”，正是 20 世纪科学计算最伟大的发明之一——**Metropolis 采样算法**！

---

## 16.4 Metropolis 采样算法

**Metropolis 算法**（由尼古拉斯·梅特罗波利斯 Nicolas Metropolis 于 1953 年提出，后经黑斯廷斯 Hastings 推广为 MCMC）是一种无需计算归一化常数、即可从任意已知非归一化 PDF 中抽取样本的马尔可夫链漫游算法。

其单步迭代流程出奇简洁：
1. **当前状态**：设当前已处于状态点 $x$。
2. **产生提议（Proposal）**：以当前状态 $x$ 为对称中心，借助一个易采样的建议分布（通常是以 $x$ 为均值、$\sigma$ 为标准差的高斯分布）抽取一个候选提议点 $x'$。
3. **计算接受率（Acceptance Ratio）**：计算提议点与当前点在目标非归一化 PDF 上的密度比值：
   $$lpha = rac{P(x')}{P(x)}$$
4. **随机接受裁决（Metropolis 准则）**：
   - 若 $P(x') \ge P(x)$（$lpha \ge 1$），提议点处于概率更高的“山峰”区域，**无条件绝对接受**：将新状态更新为 $x'$！
   - 若 $P(x') < P(x)$（$lpha < 1$），提议点落入概率较低的区域，**以概率 $lpha$ 接受它；以 $1-lpha$ 的概率拒绝它**！
   - 若被拒绝，则**保持当前状态 $x$ 不变，再次输出 $x$**！
5. 输出当前状态值作为本次采样的样本。

> **核心精妙之处**：
> - 算法在计算接受率时只涉及两点概率的比值 $rac{P(x')}{P(x)}$。原本难以求积的归一化分母常数在分子分母中被**精确抵消掉了**！
> - 与第 15 章拒绝采样中死循环等待直到投中不同，Metropolis 算法若拒绝了候选点，只需**复用当前点作为输出**，每一步迭代的耗时都是**绝对严格的常数 $O(1)$**！

首先实现一个根据给定概率判定正反面的硬币分布：

**代码清单 16.6 伯努利浮点硬币分布**

```csharp
public sealed record class Flip<T>(T Heads, T Tails, double PHeads) : IDistribution<T>
{
    public T Sample() =>
        ContinuousUniform.Standard.Sample() <= PHeads ? Heads : Tails;
}
```

将 Metropolis 算法实现为一个基于马尔可夫链状态序列的连续分布：

**代码清单 16.7 Metropolis 采样引擎**

```csharp
public sealed class Metropolis : IContinuousDistribution
{
    private readonly IEnumerator<double> enumerator;
    private readonly Func<double, double> target;

    public static Metropolis Distribution(
        Func<double, double> target,
        IDistribution<double> initial,
        Func<double, IDistribution<double>> proposal)
    {
        // 将 Metropolis 状态跳转封装为马尔可夫链的转移函数
        IDistribution<double> transition(double current)
        {
            double proposed = proposal(current).Sample();
            // 计算 Metropolis 接受率并裁决是否跳转
            double ratio = target(proposed) / target(current);
            return new Flip<double>(proposed, current, ratio);
        }

        var markov = Markov<double>.Distribution(initial, transition);
        return new Metropolis(target, markov.Sample().GetEnumerator());
    }

    private Metropolis(Func<double, double> target, IEnumerator<double> enumerator)
    {
        this.enumerator = enumerator;
        this.target = target;
    }

    public double Sample()
    {
        enumerator.MoveNext();
        return enumerator.Current;
    }

    public double Weight(double d) => target(d);
}
```

测试重新采样第 15 章的非归一化双峰混合高斯分布：

```csharp
var target = (double x) => Exp(-x * x) + Exp((1.0 - x) * (x - 1.0) * 10.0);
var initial = Normal.Standard;
// 建议分布：以当前位置为中心，标准差为 1.0 的正态步进
var proposal = (double current) => Normal.Distribution(current, 1.0);

var mixture = Metropolis.Distribution(target, initial, proposal);
Console.WriteLine(mixture.Histogram(-2.0, 3.0));
```

马尔可夫游走在没有任何包络调参的前提下，自发地在高密度的两个波峰周围密集流转，在低密度谷底快速穿过，生成的样本直方图与真实双峰曲线达成了惊人的一致！

---

## 16.5 基于 Metropolis 算法进行后验采样实战

现在，我们补全第 16.3 节留下的最后一块拼图：利用 Metropolis 引擎实现全自动的连续贝叶斯后验分布！

**代码清单 16.8 完整的连续后验采样扩展方法**

```csharp
public static class Extensions
{
    public static Func<B, IContinuousDistribution> Posterior<B>(
        this IContinuousDistribution prior,
        Func<double, IWeightedDistribution<B>> likelihood,
        double stddev = 1.0)
    {
        return (B evidence) =>
        {
            // 贝叶斯核心：后验非归一化密度 = 先验密度 * 似然函数在已知证据处的权重
            Func<double, double> posteriorPDF = a =>
                prior.Weight(a) * likelihood(a).Weight(evidence);

            // 以当前点为中心构建高斯建议转移
            Func<double, IContinuousDistribution> proposal =
                current => Normal.Distribution(current, stddev);

            // 直接将先验分布作为马尔可夫链的初始出发点
            return Metropolis.Distribution(posteriorPDF, prior, proposal);
        };
    }
}
```

### 实战：估计硬币的不公正度（连续参数推断）

假设某铸币厂制造的硬币并不均匀，我们希望推断某枚硬币正面朝上的真实真实概率 $	heta \in [0.0, 1.0]$。

1. **先验信念**：在未抛掷前，我们认为硬币大概率是公平的（中心在 0.5），但存在偏差可能。我们使用第 15 章构建的**截断正态分布**来表达这一先验：

```csharp
var prior = Normal.Distribution(0.5, 0.2).Clamp(0.0, 1.0);
```

2. **似然模型**：将硬币投掷 10 次，记录正面出现的次数。这服从**二项分布（Binomial Distribution）**：
   $$P(k \mid 	heta) = inom{n}{k} 	heta^k (1-	heta)^{n-k}$$

**代码清单 16.9 二项似然分布**

```csharp
using static System.Math;

public sealed class Binomial : IWeightedDistribution<int>
{
    private readonly int trials;
    private readonly double prob;
    private readonly IDistribution<bool> flip;

    public static Binomial Distribution(int trials, double prob) => new(trials, prob);

    private Binomial(int trials, double prob)
    {
        this.trials = trials;
        this.prob = prob;
        this.flip = new Flip<bool>(true, false, prob);
    }

    public double Weight(int successes) =>
        Pow(prob, successes) *
        Pow(1.0 - prob, trials - successes) *
        (double)trials.Choose(successes); // Choose 为第 6 章实现的组合数扩展

    public int Sample() => flip.Samples().Take(trials).Count(x => x);
}
```

3. **观测与后验推导**：
   我们将该硬币连续抛掷 10 次，**观测到多达 9 次正面！** 

```csharp
var likelihood = (double fairness) => Binomial.Distribution(10, fairness);
var posterior = prior.Posterior(likelihood);

// 绘制先验分布 vs 观测到 9 次正面后的后验分布
Console.WriteLine("--- 观察证据前的先验信念 ---");
Console.WriteLine(prior.Histogram(0.0, 1.0));

Console.WriteLine("--- 观察到 10 投 9 正面后的后验信念 ---");
Console.WriteLine(posterior(9).Histogram(0.0, 1.0));
```

直方图发生了震撼人心的形态变迁：

```text
--- 观察证据前的先验信念 ---
                 ******
               ***********
              *************
             ***************
            *****************
          *********************
        *************************
****************************************

--- 观察到 10 投 9 正面后的后验信念 ---
                            *****
                            ******
                           ********
                          **********
                         ************
                        **************
                       ****************
                     *******************
            ****************************
```

原本以 0.5 为中心的对称先验钟形曲线，被 9 次正面的强有力证据**强力向右拉扯**，形成了一个在 0.85 附近极其陡峭突起的全新后验信念峰值！

这不仅是在玩掷硬币游戏——**这就是现代机器学习与贝叶斯数据科学的终极底座**：
- 当先验是新注册账号为黑产木马的概率分布，似然是机器人行为模式在特定群体中的操作表现时，通过持续输入日志证据，系统就能动态求得该账号是恶意 Bot 的连续置信度。
- 面对复杂、多变且充斥着不确定性的真实世界，软件工程师有责任摒弃凭空猜测的硬编码规则，用严谨完备的贝叶斯推断守护系统决策的公正与精确。

---

## 本章小结

- **马尔可夫过程**生成具有无记忆转移特性的随机状态序列。每个后续状态的条件分布仅取决于当前状态。
- 马尔可夫链文本生成是现代大语言模型（LLM）的极简前驱，深刻揭示了自回归随机文本生成的统计本质。
- 在连续空间中求解贝叶斯后验概率时，分母全域归一化积分往往极其棘手；但后验的非归一化相对概率密度可直接表达为**先验密度与观测似然值的乘积**。
- **Metropolis-Hastings 算法**利用对称提议分布在目标空间中展开马尔可夫随机游走，根据未归一化的概率比值决定是否跳转，实现了无需积分计算的高效 $O(1)$ 步进采样。
- 将先验分布、似然模型与 Metropolis 采样器管道化连接，赋予了软件系统在面对连续现实世界证据时，**自主进行严谨贝叶斯信念更新（Bayesian Inference）** 的终极武器。
