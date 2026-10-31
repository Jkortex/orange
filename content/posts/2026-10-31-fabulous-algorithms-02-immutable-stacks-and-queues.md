---
title: "数据结构与算法的奇妙冒险（二）：不可变栈与不可变队列"
date: 2026-10-31T01:02:00Z
description: "深入剖析为何选择不可变性，实现协变不可变栈以及基于双栈翻转的纯函数式不可变队列与撤销重做。"
category: algorithms
column: fabulous-algorithms
tags: [不可变栈, 不可变队列, 协变性, 撤销重做, 函数式数据结构]
---

# 第 2 章 不可变栈与不可变队列

### 本章核心内容

- 领略不可变数据结构的显著优势与微小代价
- 实现不可变栈与不可变队列
- 探索构建撤销/重做（Undo-Redo）栈的高效方案
- 深入分析时间与空间复杂度及均摊分析
- 实现奇妙的 Hughes 链表（Hughes List）

---

本章将拓展第 1 章介绍的不可变单链表，构建一系列能够展示不同概念的列表结构。如果你具备函数式编程语言背景，这些思想或许并不陌生；但对于习惯面向对象编程的开发者来说，它们往往较为少见，却能为你的解题工具箱提供极其强大的武器。

我们将从构建不可变栈入手，对第 1 章的单链表进行若干关键改进。在掌握不可变栈之后，我们将以此为基础构建不可变队列，并揭示最坏情况性能与长时间均摊（amortized）平均性能之间的微妙差异。接着，我们将探讨不可变数据结构如何让撤销/重做（Undo-Redo）逻辑变得优雅简单，以及如何在不可变数据结构之上封装出易用的可变接口。

最后，我们将探索 Hughes 链表（Hughes List）。这是一种初看之下似乎完全不包含任何数据、却具有与常规栈截然相反的性能特征的栈实现。在各个小节中，我们都将遵循工程规范：先定义待解决的问题，设计抽象数据类型与接口，提供具体实现，并进行严谨的复杂度分析。

在正式动笔之前，我必须先阐述清楚：究竟是哪些不可抗拒的优势，彻底颠覆了我对编程的认知，使我在面对可变与不可变结构时强烈偏向后者？

---

## 2.1 为什么选择不可变性？

如果你面前有两个数据结构，一个可变，一个不可变，除此之外功能完全相同——你究竟为什么要偏爱那个在功能上“有所欠缺”（无法原地修改）的结构呢？按常理推断，我们总是希望手头的工具功能越丰富越好。然而在绝大多数情况下，我的首选强烈倾向于不可变数据结构。为什么？

### 2.1.1 正确性（Correctness）

事物变动越少，状态便越稳定。我所知道的使用不可变数据结构最令人信服的理由是：**我们过去对某个不可变对象所推导出的任何事实，在当下以及未来都将永远保持为真**。

这绝非空洞的学术理论。在我在微软 C# 编译器团队工作的那些年里，我修复过数不清的 Bug（其中不少正是我自己引入的），其根源都在于我们在分析和优化语法树的过程中对其进行了原地修改。最常见的错误模式是：在变量中缓存了一个分析事实，随后原地修改了底层数据结构从而推翻了该事实，但由于忘记重新计算变量，导致后续优化阶段使用了一个早已过期的陈旧事实。当我们为 Roslyn 编译器项目彻底重写整个 C# 编译器时，我们坚决贯彻了全面采用不可变数据结构的架构原则，整整几个大类的经典 Bug 由此在物理层面上彻底绝迹。

使用不可变数据结构编写的代码，通常远比依赖可变结构的代码更容易进行单元测试、调试和维护。仅此一点就足以驱动我全面拥抱不可变性，但不可变性的优势远不止于此。

### 2.1.2 历史状态保留（Historical Preservation）

在许多应用程序中，不可变性赋予了我们轻松推演过去的能力。银行不会维护一个直接就地增加或减少账户余额的可变数据库；相反，它们维护的是**复式记账账本**（ledger）——记录该账户每一笔交易的历史明细。在账本上唯一合法的操作是在末尾追加一笔新交易，篡改或覆盖既有历史记录在规则上是绝对不允许的。版本控制系统（如 Git）完整保留了代码仓库所有变更的完整历史轨迹，从而使得任何一次提交都可以安全回滚。在这些系统中，不可变数据结构扮演着基石角色。在 2.6 节中，我们将看到如何利用这一特性在程序中轻松实现撤销/重做逻辑。

### 2.1.3 安全防范与 TOCTOU

在安全领域，攻击者可以通过就地篡改已通过校验的数据来实现权限提升。安全专家将这种漏洞称为 **TOCTOU**（Time of Check / Time of Use，检查时间与使用时间差漏洞）。假设某程序中低权限的非受信代码调用了如下高权限系统代码：

```csharp
Resource? AccessResource(ResourceName name)
{
    if (CallerHasAccess(name))
        return FetchResource(name);
    return null;
}
```

恶意代码可以实施如下攻击：
1. 创建一个 `ResourceName` 对象。
2. 启动第二个后台线程，在一个无限循环中持续原地篡改该 `ResourceName` 对象，让它在用户有权访问的“合法资源名”与无权访问的“受限资源名”之间快速反复切换。
3. 主线程循环调用 `AccessResource`，直到返回的资源属于受限资源。

最终，恶意代码必然会迎来命中注定的竞态时刻：线程调度恰好使得“合法资源检查”刚通过、而“实际获取资源”尚未执行的微小时间窗口内，资源名称被篡改成了受限资源。于是，高权限代码在不知不觉中将保护资源拱手交给了本无权访问的代码。

解决此问题的方法有许多，纵深防御原则提倡结合所有防御手段。而**默认将对象设计为不可变**，使低权限代码在调用流转中根本无法在空中修改参数内容，便是一种极佳的防御手段。如果一个数据结构没有必须原地修改的充分理由，请将其设为不可变。

### 2.1.4 更安全的多线程并发

编写多线程代码最棘手的核心难题之一，就是处理针对共享可变状态的数据竞态（Race Condition）。不可变对象的一大非凡优势在于：你可以在无需加锁的情况下跨越任意多个线程安全共享。因为没有任何线程能够原地修改该对象，无论操作系统如何调度线程，所有线程在任何时间点对该对象内容的观测都是完全一致的。

### 2.1.5 记忆化以提升时间性能（Memoization）

> “做同一件事两次并期望得到完全相同的结果，是神志清醒的明证。”

正如前面所指出的，当我们针对不可变数据结构计算出某个事实后，该事实将永恒有效。如果计算该事实的函数耗时极高，且后续代码很可能多次需要该计算结果，我们便可以通过**记忆化**（memoization，建立函数参数与结果的查找缓存表），以空间换时间。我们将在第 4 章探讨 Gosper 的 HashLife 算法时淋漓尽致地发挥记忆化的威力。

### 2.1.6 持久化以优化空间效率（Structural Sharing / Persistence）

当向不熟悉不可变特性的开发者介绍不可变数据结构时，他们往往会产生这样的第一直觉反弹：“如果我需要修改对象，却又不能原地改动，那我岂不是每次都必须克隆出一个包含修改的新版本？这不会导致内存占用直接翻倍吗？”

答案是：**恰恰相反**。

如果使用可变数据结构（例如整数数组），当修改其中一个元素时，确实不需要分配新内存。但如果你需要**同时保留修改前与修改后的两个版本**呢？在这种情况下，你必须对整个数组进行深拷贝，一个保存修改版，一个保存原版。

这种情况在工程实践中极为普遍。正如本章及后续章节所展示的，在内存中同时保留同一数据结构的原始版本与变更版本往往非常实用。

正是由于不可变数据结构具备**内容永恒不变更**的铁律，我们在构建新版本时可以极其放心地**最大化复用旧版本的内部节点与结构**。这种能够高效共享子结构以节省内存的特性被称为**持久化数据结构**（persistent data structures，或结构共享）。我们将在 2.2 节中亲眼见证这方面的第一个典型范例。

### 2.1.7 函数式编程思维

不可变数据结构通常被称为**纯函数式**（purely functional）数据结构，因为函数式语言（F#、OCaml、Lisp、Scheme、Haskell 等）倡导将程序组织为一系列接受参数并返回值、没有任何原地修改或副作用的纯函数组合。不可变编程的支持者推崇其高可读性、正确性、可测试性、易调试性、易维护性、健壮性、安全性与并发性能。而批评者则认为现实世界时刻在变，因此对现实世界的建模最自然的表达应当是可变状态。

现代通用工程语言（如 C#）赋予了我们兼收并蓄的能力，允许我们按需自由融合函数式与命令式风格。在早期职业生涯中，运用函数式思维来审慎驯服面向对象编程固有的复杂性，是对我的工程素养影响最为深远的一次蜕变。

---

## 2.2 不可变栈（Immutable Stack）

在第 1 章中，我们实现了一个不可变单链表。现在我们采用更严谨的软件工程方法对其进行迭代：在编码之前，首先设计**抽象数据类型**（ADT，Abstract Data Type）。我们从用户需求出发，明确其合法与非法状态、支持的操作以及各操作的语义契约，进而定义出接口。

> **提示**  
> 许多现代语言的标准库中已经内置了优秀的不可变集合（例如 C# 的 `System.Collections.Immutable` 命名空间）。在生产代码中，优先使用标准库通常是最佳选择。接下来的章节旨在揭示底层机制，为我们后续攻克标准库中未涵盖的更高级结构打下坚实基础。

首先审视可变栈的核心操作：
1. 创建新栈。
2. 压入元素（Push）。
3. 查看栈顶元素（Peek，仅当栈非空）。
4. 弹出栈顶并返回该元素（Pop，仅当栈非空）。
5. 检查栈是否为空（IsEmpty）。
6. 支持枚举遍历序列元素。

要设计不可变版本，第一步是找出在可变版本中哪些操作会引发状态变更。在此处，只有压栈和出栈会改变栈。在不可变栈中，这些操作不再原地修改对象，而是**返回一个应用了该操作的新栈对象**。由此我们定义出如下接口：

代码清单 2.1 不可变栈接口：

```csharp
interface IImStack<T> : IEnumerable<T>
{
    IImStack<T> Push(T item);
    T Peek();
    IImStack<T> Pop();
    bool IsEmpty { get; }
}
```

针对该接口，单链表是最天然的实现载体。然而在 C 风格的传统实现中，节点持有值和指向下一个节点的指针，末尾为空指针（`null`）。正如第 1 章所述，这存在两个显著缺陷：空栈本应是一个能够正常调用接口方法的合法对象，而非冷冰冰的空引用；且代码中充斥的 `null` 是空指针异常的根源。

采用面向对象中的**空对象模式**（Null Object Pattern），我们可以将空栈设计为一个**全局唯一的单例对象**（Singleton），非空栈则保存元素与尾指针。空栈与非空栈展现出不同的多态行为，这完全符合将不同行为拆分至实现共同接口的不同子类的面向对象原则。

代码清单 2.2 不可变栈的高质量单链表实现：

```csharp
class ImStack<T> : IImStack<T>
{
    // 空栈使用私有嵌套类实现，作为外层类的内部细节
    private class EmptyStack : IImStack<T>
    {
        public EmptyStack() { }
        // 对空栈执行 Push 会产生包含单个元素的非空栈
        public IImStack<T> Push(T item) => new ImStack<T>(item, this);
        public T Peek() => throw new InvalidOperationException("空栈无法执行 Peek 操作。");
        public IImStack<T> Pop() => throw new InvalidOperationException("空栈无法执行 Pop 操作。");
        public bool IsEmpty => true;
        public IEnumerator<T> GetEnumerator()
        {
            yield break;
        }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    // 全局唯一单例空栈
    public static IImStack<T> Empty { get; } = new EmptyStack();

    private readonly T item;
    private readonly IImStack<T> tail;

    // 构造函数设为私有：构建新栈的唯一合法途径是在既有栈上执行 Push
    private ImStack(T item, IImStack<T> tail)
    {
        this.item = item;
        this.tail = tail;
    }

    public IImStack<T> Push(T item) => new ImStack<T>(item, this);
    public T Peek() => item;
    public IImStack<T> Pop() => tail;
    public bool IsEmpty => false;

    public IEnumerator<T> GetEnumerator()
    {
        for (IImStack<T> s = this; !s.IsEmpty; s = s.Pop())
            yield return s.Peek();
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

这段实现有若干值得称道之处：
- 空栈与非空栈彻底隔绝。空栈的 `Peek` 和 `Pop` 会直接抛出清晰的异常，而无需任何显式的空值检查。
- 所有构造函数均对外部私有。外部构建栈的唯一途径是从单例 `Empty` 开始依次调用 `Push`。
- **全篇没有任何 `null`、可空标记 `?` 或感叹号断言 `!`**。从源头上消除了空引用的存在空间。

为了便于直观打印和测试，我们定义一组流畅的格式化扩展方法：

代码清单 2.3 辅助格式化扩展方法：

```csharp
static class Extensions
{
    public static string Comma<T>(this IEnumerable<T> items) =>
        string.Join(", ", items);

    public static string Bracket<T>(this IEnumerable<T> items) =>
        "[" + items.Comma() + "]";
}
```

现在我们实际演练一下这个不可变栈，观察在不同引用下的独立性与共享性：

```csharp
var s1 = ImStack<int>.Empty;
var s2 = s1.Push(10);
var s3 = s2.Push(20);
var s4 = s2.Push(30); // 再次基于 s2 分支压栈！
var s5 = s4.Pop();
var s6 = s5.Pop();

Console.WriteLine(s1.Bracket()); // []
Console.WriteLine(s2.Bracket()); // [10]
Console.WriteLine(s3.Bracket()); // [20, 10]
Console.WriteLine(s4.Bracket()); // [30, 10]
Console.WriteLine(s5.Bracket()); // [10]
Console.WriteLine(s6.Bracket()); // []
```

输出完全符合预期。值得注意的是：我们在 `s2` 的基础上分别压入了 20（形成 `s3`）和 30（形成 `s4`）。`s2` 自身的内容毫发无损！而在内存底层，包含值 10 的节点只被分配了一次，被 `s2`、`s3`、`s4` 和 `s5` 共同安全地共享引用（图 2.1）。单例 `Empty` 更是被整个系统全局共享。

![图 2.1 栈变量与节点共享结构示意图](/media/posts/fabulous-algorithms/img-01738.jpeg)
*图 2.1：每个变量引用一个特定的不可变栈。拥有相同尾部的栈直接复用共享底层的不可变节点，空栈全局唯一单例。*

### 性能与复杂度分析

- **时间复杂度**：无论是空栈还是非空栈，`Push`、`Peek`、`Pop` 和 `IsEmpty` 均为纯粹的指针分配与字段读取，严格为 $O(1)$ 常数时间。
- **枚举遍历**：遍历包含 $n$ 个元素的栈总共调用 $n$ 次 $O(1)$ 的操作，耗时为严格的线性阶 $O(n)$。
- **空间复杂度**：包含 $n$ 个元素的栈占用 $O(n)$ 的节点对象。借助结构持久化（结构共享），共享公共尾部的不同栈分支不需要复制任何共享节点。枚举器本身仅维护一个局部游标，额外内存分配为 $O(1)$。

---

## 2.3 协变不可变栈（Covariant Immutable Stack）

使用基于接口建模的不可变抽象数据类型，还有一个极其优雅的杀手级特性：**协变性**（Covariance）。

在面向对象中，将派生类对象 `Giraffe`（长颈鹿）赋值给基类类型变量 `Animal`（动物）是天经地义的。但能否将 `IEnumerable<Giraffe>` 赋值给 `IEnumerable<Animal>` 类型的变量？常识告诉我们：“长颈鹿是动物，因此长颈鹿序列自然是动物序列”，这种直觉完全正确。当类型系统允许这种赋值成立时，被称为**泛型协变**。在 C# 中，协变要求类型参数必须是引用类型，且只支持在特定接口和委托上声明。

更关键的是，编译器只允许在绝对类型安全的前提下将接口标记为协变。可变接口 `IList<T>` 就**绝对不能**声明为协变。让我们看看如果假设 `IList<T>` 允许协变会发生何等灾难：

代码清单 2.4 假设 `IList<T>` 协变引发的灾难：

```csharp
// 假设 IList<T> 声明为协变（现实中编译器严厉禁止）：
IList<Tiger> tigers = new List<Tiger>();
IList<Animal> animals = tigers; // 危险的协变引用传递！

animals.Add(new Giraffe());     // 灾难发生：IList<Animal>.Add 接受 Animal，放入长颈鹿合法！
Tiger tiger = tigers[0];        // 此时老虎列表中实际存放的是长颈鹿！
Console.WriteLine(tiger.ToString()); // 打印出 Giraffe，类型系统彻底崩溃！

class Animal { public override string ToString() => GetType().Name; }
class Tiger : Animal { }
class Giraffe : Animal { }
```

这展示了为什么 `IList<T>` 绝不可协变：一旦允许协变，程序就会彻底践踏“变量只能持有与其声明类型兼容的对象”这一类型安全的铁律。

为什么 `IEnumerable<T>` 可以安全协变？因为 `IEnumerable<T>` 只提供**读取**序列元素的方法（`T` 仅作为输出），而 `IList<T>` 包含向集合**写入**修改的方法（`Add(T)`，`T` 处于输入位置）。**结论是：可变性粉碎了协变性**。

现代编译器规定：只有当泛型参数**仅仅出现在输出位置**（只读）时，接口才能安全地声明为协变（使用 `out T`）。

回到我们的 `IImStack<T>`：因为它的 `Push(T item)` 接收了一个处于输入位置的 `T`，导致编译器拒绝将其标记为协变。如果可变性阻碍了协变，不可变数据结构理应能够拥抱协变！如何破解这一限制？

答案极其巧妙：**将引发冲突的 `Push(T)` 从接口中剥离出来，改写为扩展方法**！

代码清单 2.5 协变不可变栈的实现：

```csharp
// 使用 out 关键字将不可变栈声明为协变接口
interface IImStack<out T> : IEnumerable<T>
{
    T Peek();
    IImStack<T> Pop();
    bool IsEmpty { get; }
}

class ImStack<T> : IImStack<T>
{
    // ... 内部结构保持不变 ...
    
    // 提供静态工厂方法以供扩展方法调用
    public static IImStack<T> Push(T item, IImStack<T> tail) =>
        new ImStack<T>(item, tail);
}

static class Extensions
{
    // 将 Push 作为扩展方法挂载到 IImStack<T> 上
    public static IImStack<T> Push<T>(this IImStack<T> stack, T item) =>
        ImStack<T>.Push(item, stack);
}
```

现在测试代码：

```csharp
IImStack<Tiger> s1 = ImStack<Tiger>.Empty;
IImStack<Tiger> s2 = s1.Push(new Tiger());
IImStack<Tiger> s3 = s2.Push(new Tiger());

// 此时发生完全类型安全的协变转换！
IImStack<Animal> s4 = s3; 
IImStack<Animal> s5 = s4.Push(new Giraffe());

Console.WriteLine(s5.Bracket()); // 输出: [Giraffe, Tiger, Tiger]
```

运行输出完全符合预期！由于数据结构的不可变性，向被视作 `Animal` 栈的 `s4` 压入长颈鹿，会生成一个包含 `Giraffe` 和既有 `Tiger` 的新 `IImStack<Animal>` 栈；而底层的老虎栈 `s3` 依然纯净无瑕。不可变性让协变性大显身手。

---

## 2.4 不可变队列（Immutable Queue）

栈是后进先出（LIFO），而队列是先进先出（FIFO）：最先入队的元素最早出队。这一看似平平无奇的顺序颠倒，却对不可变数据结构的设计提出了极具挑战性的性能课题。

我们首先定义不可变队列的抽象接口：

代码清单 2.6 不可变队列接口：

```csharp
interface IImQueue<T> : IEnumerable<T>
{
    IImQueue<T> Enqueue(T item);
    T Peek();
    IImQueue<T> Dequeue();
    bool IsEmpty { get; }
}
```

在单链表中，向同一端执行插入和删除都是轻而易举的 $O(1)$ 操作，这使它成为栈的完美宿主；但队列需要在一端入队、在**另一端**出队。

核心洞见在于：**如果一个单栈能让我们在列表的一端进行廉价操作，那么要在列表的两端进行廉价操作，我们需要两个栈！**

具体设计策略如下：
1. 维护两个内部不可变栈：一个用于低成本入队的 **入队栈**（enqueues），一个用于低成本出队的 **出队栈**（dequeues）。入队操作直接压入入队栈；出队操作直接从出队栈弹出。
2. 当出队栈被掏空时，将入队栈中的所有元素一次性**整体反转**，作为新的出队栈。

代码清单 2.7 双栈实现的不可变队列：

```csharp
class ImQueue<T> : IImQueue<T>
{
    // 单例空队列：两栈皆空
    public static IImQueue<T> Empty { get; } =
        new ImQueue<T>(ImStack<T>.Empty, ImStack<T>.Empty);

    private readonly IImStack<T> enqueues;
    private readonly IImStack<T> dequeues;

    private ImQueue(IImStack<T> enqueues, IImStack<T> dequeues)
    {
        this.enqueues = enqueues;
        this.dequeues = dequeues;
    }

    // 核心不变式：只要队列非空，出队栈 dequeues 就绝不能唯空！
    public IImQueue<T> Enqueue(T item) =>
        IsEmpty ?
        new ImQueue<T>(enqueues, dequeues.Push(item)) :
        new ImQueue<T>(enqueues.Push(item), dequeues);

    public T Peek() => dequeues.Peek();

    public IImQueue<T> Dequeue()
    {
        IImStack<T> newdeq = dequeues.Pop();
        if (!newdeq.IsEmpty)
            return new ImQueue<T>(enqueues, newdeq);
        if (enqueues.IsEmpty)
            return Empty;
        // 当出队栈耗尽时，将入队栈全部反转注入出队栈！
        return new ImQueue<T>(ImStack<T>.Empty, enqueues.Reverse());
    }

    public bool IsEmpty => dequeues.IsEmpty;

    public IEnumerator<T> GetEnumerator()
    {
        foreach (var item in dequeues)
            yield return item;
        foreach (var item in enqueues.Reverse())
            yield return item;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

static class Extensions
{
    public static IImStack<T> Reverse<T>(this IImStack<T> stack)
    {
        var result = ImStack<T>.Empty;
        for (; !stack.IsEmpty; stack = stack.Pop())
            result = result.Push(stack.Peek());
        return result;
    }
}
```

请仔细体味此处的精妙不变式（Invariant）：**只要队列非空，出队栈 `dequeues` 绝不能为空**。
- 当向空队列入队第一个元素时，直接将其放入出队栈中，确保出队栈非空。后续元素才压入入队栈。
- 因此，判断队列是否为空只需检查 `dequeues.IsEmpty`，`Peek` 也能在 $O(1)$ 时间直接读取 `dequeues.Peek()`，无需任何条件判断。
- 当出队导致 `dequeues` 变为空且 `enqueues` 非空时，触发一次 `enqueues.Reverse()`，重新填满出队栈并重置入队栈。

```csharp
var q1 = ImQueue<int>.Empty;
var q2 = q1.Enqueue(10);
var q3 = q2.Enqueue(20);
var q4 = q3.Enqueue(30);
var q5 = q4.Dequeue();
var q6 = q5.Dequeue();
var q7 = q6.Dequeue();

Console.WriteLine(q1.Bracket()); // []
Console.WriteLine(q2.Bracket()); // [10]
Console.WriteLine(q3.Bracket()); // [10, 20]
Console.WriteLine(q4.Bracket()); // [10, 20, 30]
Console.WriteLine(q5.Bracket()); // [20, 30]
Console.WriteLine(q6.Bracket()); // [30]
Console.WriteLine(q7.Bracket()); // []
```

![图 2.2 六个不可变队列与内部双栈的结构共享状态](/media/posts/fabulous-algorithms/img-02429.jpeg)
*图 2.2：六个不可变队列及其底层六个不可变栈的引用关系。不可变持久化使得多个队列状态共存时最大化复用既有栈节点。*

### 均摊分析（Amortized Analysis）及其现实隐患

对于入队操作，仅仅是在入队栈上执行一次压栈，时间与空间均为严格的 $O(1)$。

然而在 `Dequeue` 中，如果出队栈为空，会触发一次针对包含 $n$ 个元素的入队栈的 `Reverse()`，耗时为 $O(n)$。这是否意味着出队性能不可接受？

在单线程纯线性使用模式下，我们可以采用**均摊分析**：
考察每个进入队列的元素：
1. 被 `Enqueue` 压入入队栈（$O(1)$）。
2. 在某次 `Dequeue` 触发翻转时从入队栈弹出（$O(1)$）。
3. 被压入出队栈（$O(1)$）。
4. 最终出队时从出队栈弹出（$O(1)$）。

生命周期中每个元素被压栈两次、出栈两次，全过程总耗时为恒定的常数步。因此，**每个元素的均摊出队开销是标准的常数阶 $O(1)$**。

**然而，在持久化不可变数据结构中，这个均摊保证存在致命陷阱！**  
假设我们入队了 10 万个元素，此时出队栈变空。如果在不可变环境下，我们在该队列状态上调用一次 `Dequeue()`（触发耗时 10 万步的翻转），拿到结果后弃之不用，或者将该队列状态保存起来，在同一个队列实例上**反复执行多次 `Dequeue()`**——每一次调用都将遭受全额 $O(n)$ 的重度惩罚！均摊的前提是“昂贵操作产生的新状态会被消费”，但在不可变分支共享的世界中，历史状态可以被反复重放。我们将在第 3 章通过 Finger Tree 解决该问题。

---

## 2.5 可变包装器（Mutable Wrappers）

不可变数据结构优势显著，但有时业务代码依然需要一个能够原地指向当前状态的可变变量。解决此矛盾的利器是构建**包裹在不可变数据结构之上的可变外壳**：

代码清单 2.9 基于不可变队列的可变队列包装器：

```csharp
class Queue<T> : IEnumerable<T>
{
    private IImQueue<T> q = ImQueue<T>.Empty;

    public void Enqueue(T item)
    {
        q = q.Enqueue(item);
    }

    public T Peek() => q.Peek();

    public T Dequeue()
    {
        T item = Peek();
        q = q.Dequeue();
        return item;
    }

    public bool IsEmpty => q.IsEmpty;
    public IEnumerator<T> GetEnumerator() => q.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

我们还可以为该包装类增加一个 `Freeze()` 方法，随时导出当前不可变快照。这种模式集可变调用的便捷语法与不可变快照隔离的优势于一身。

---

## 2.6 撤销与重做（Undo and Redo）

在应用程序中实现健壮的撤销/重做逻辑历来是软件工程的经典痛点。如果采用传统的命令模式（Command Pattern），必须为每一种操作编写配对的 UndoCommand 与 RedoCommand，繁琐且极易出错；如果采用状态快照克隆，全量深拷贝的内存与时间开销将迅速退化为 $O(n^2)$。

而一旦我们将程序状态建模为**不可变对象**，撤销与重做就变成了小菜一碟：

代码清单 2.10 通用 UndoRedo 状态管理器：

```csharp
class UndoRedo<T>
{
    private IImStack<T> undo = ImStack<T>.Empty;
    private IImStack<T> redo = ImStack<T>.Empty;

    public T State { get; private set; }

    public UndoRedo(T initial)
    {
        State = initial;
    }

    // 执行状态变更
    public void Do(T newState)
    {
        undo = undo.Push(State);
        State = newState;
        redo = ImStack<T>.Empty; // 执行新操作后清空重做历史
    }

    public bool CanUndo => !undo.IsEmpty;

    public T Undo()
    {
        if (!CanUndo)
            throw new InvalidOperationException("无可撤销的操作。");
        redo = redo.Push(State);
        State = undo.Peek();
        undo = undo.Pop();
        return State;
    }

    public bool CanRedo => !redo.IsEmpty;

    public T Redo()
    {
        if (!CanRedo)
            throw new InvalidOperationException("无可重做的操作。");
        undo = undo.Push(State);
        State = redo.Peek();
        redo = redo.Pop();
        return State;
    }
}
```

利用这一通用管理器，我们可以轻易写出一个支持完整撤销/重做的队列包装器：

代码清单 2.11 支持撤销重做的队列：

```csharp
class UndoRedoQueue<T> : IEnumerable<T>
{
    private UndoRedo<IImQueue<T>> q =
        new UndoRedo<IImQueue<T>>(ImQueue<T>.Empty);

    public void Enqueue(T item) => q.Do(q.State.Enqueue(item));
    public T Peek() => q.State.Peek();
    public T Dequeue()
    {
        T item = q.State.Peek();
        q.Do(q.State.Dequeue());
        return item;
    }

    public bool IsEmpty => q.State.IsEmpty;
    public bool CanUndo => q.CanUndo;
    public void Undo() => q.Undo();
    public bool CanRedo => q.CanRedo;
    public void Redo() => q.Redo();

    public IEnumerator<T> GetEnumerator() => q.State.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

测试使用：

```csharp
var u = new UndoRedoQueue<int>();
u.Enqueue(10);
u.Enqueue(20);
u.Enqueue(30);
u.Undo();   // 回退到 [10, 20]
u.Redo();   // 恢复到 [10, 20, 30]
u.Dequeue(); // 变为 [20, 30]
u.Undo();   // 撤销出队，瞬间恢复到 [10, 20, 30]！
```

更神奇的是：**重做操作在不可变结构下是纯粹免费的！** 即使原操作本身消耗了 $O(n)$ 时间（例如触发了全栈翻转），由于其翻转后的队列对象已经被原封不动保存在撤销/重做栈中，执行 Redo 仅仅是移动一下指针，耗时严格为 $O(1)$！

---

## 2.7 Hughes 链表：先低成本构建，后续延迟买单

Hughes 链表（Hughes List，在函数式圈子中常被称为 Difference List / DList）是由瑞典计算机科学家 John Hughes 发明的一种极富创造力的数据结构。它彻底颠覆了常规认知：**在两端追加或拼接列表只需 $O(1)$，而查看或弹出元素却需要 $O(n)$**。

### 2.7.1 扩展方法与栈拼接

首先我们将之前的 `Reverse` 改造为通用的 `ReverseOnto`（将一个栈反转并直接压到另一个栈之上）：

代码清单 2.13 `ReverseOnto` 及列表拼接：

```csharp
static class Extensions
{
    public static IImStack<T> ReverseOnto<T>(
        this IImStack<T> stack, IImStack<T> tail)
    {
        var result = tail;
        for (; !stack.IsEmpty; stack = stack.Pop())
            result = result.Push(stack.Peek());
        return result;
    }

    public static IImStack<T> Reverse<T>(this IImStack<T> stack) =>
        stack.ReverseOnto(ImStack<T>.Empty);

    public static IImStack<T> Concatenate<T>(
        this IImStack<T> xs, IImStack<T> ys) =>
        ys.IsEmpty ? xs : xs.Reverse().ReverseOnto(ys);

    public static IImStack<T> Append<T>(this IImStack<T> stack, T item) =>
        stack.Concatenate(ImStack<T>.Empty.Push(item));
}
```

在常规不可变栈中，将两个长度为 $n$ 的栈拼接在一起，必须先反转左栈再反转回右栈，耗时严格为 $O(n)$。在频繁拼接的场景下，这会引发性能瓶颈。

### 2.7.2 柯里化与偏函数应用（Currying and Partial Application）

为了理解 Hughes 链表，先回顾函数式编程中的**柯里化**（Currying）：
任何接受两个参数的函数，都可以改写为接受一个参数并返回另一个单参数函数的形式：

```csharp
Func<int, int, int> adder = (x, y) => x + y;
Func<int, Func<int, int>> curried = x => y => adder(x, y);

Func<int, int> add4 = curried(4);
Console.WriteLine(add4(3)); // 7
Console.WriteLine(add4(0)); // 4！传入 0 取出了偏函数绑定的原始存储值！
```

向绑定了 $x$ 的偏函数传入加法单位元 `0`，取出的就是保存的 $x$。
同理：**对一个预先绑定了前置链表的拼接函数传入空列表，得到的就是该前置链表本身！**

### 2.7.3 Hughes 链表的实现

Hughes 链表的核心思想是：**不在内存中显式保存链表节点，而是保存一个接受后续列表并将其拼接于当前列表之后的函数委托！**

代码清单 2.14 Hughes 链表实现：

```csharp
struct HList<T> : IEnumerable<T>
{
    delegate IImStack<T> Concat(IImStack<T> stack);

    private readonly Concat c;

    private HList(Concat c) => this.c = c;
    private static HList<T> Make(Concat c) => new HList<T>(c);

    // 空 Hughes 链表就是恒等函数：给它什么栈，它就返回什么栈
    public static HList<T> Empty { get; } = Make(stack => stack);
    public bool IsEmpty => ReferenceEquals(c, Empty.c);

    public static HList<T> FromStack(IImStack<T> fromStack) =>
        fromStack.IsEmpty ?
            Empty :
            Make(stack => fromStack.Concatenate(stack));

    // 传入空栈，瞬间解开全部函数组合，求出物理栈！
    public IImStack<T> ToStack() => c(ImStack<T>.Empty);
    public T Peek() => ToStack().Peek();
    public HList<T> Pop() => FromStack(ToStack().Pop());

    // 拼接两个 Hughes 链表就是纯粹的函数复合：f(g(x))，耗时严格 O(1)！
    private static HList<T> Concatenate(HList<T> hl1, HList<T> hl2) =>
        hl1.IsEmpty ? hl2 : Make(stack => hl1.c(hl2.c(stack)));

    public static HList<T> Single(T item) =>
        Make(stack => stack.Push(item));

    public HList<T> Push(T item) => Concatenate(Single(item), this);
    public HList<T> Append(T item) => Concatenate(this, Single(item));
    public HList<T> Concatenate(HList<T> hl) => Concatenate(this, hl);

    public IEnumerator<T> GetEnumerator() => ToStack().GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

### 2.7.4 数据究竟存储在哪里？

初看之下，整个 `HList<T>` 内部除了一根指向委托的指针 `Concat c` 之外没有任何数据字段。那么元素到底藏在哪里？

揭开编译器的黑盒：当我们在 C# 中书写 `Make(stack => hl1.c(hl2.c(stack)))` 时，编译器在幕后生成了一个捕获闭包类：

```csharp
private class Closure
{
    public HList<T> hl1;
    public HList<T> hl2;
    public IImStack<T> M(IImStack<T> stack) => this.hl1.c(this.hl2.c(stack));
}
```

**这个闭包类本质上就是一个二叉树节点！** `hl1` 与 `hl2` 分别是左子树与右子树。编译器自动利用闭包机制，将所有的拼接操作构建为一棵二叉表达式语法树（图 2.3）。所谓的 $O(1)$ 拼接，无非是分配了一个持有两个子节点引用的闭包对象！

直到调用 `ToStack()` 时，整棵二叉树才被自底向上递归求值，在一次连贯的遍历中将所有元素以最优的结合顺序装配进目标栈中。

![图 2.3 Hughes 链表幕后闭包构成的二叉调用图](/media/posts/fabulous-algorithms/img-02434.jpeg)
*图 2.3：Hughes 链表幕后其实是一张闭包构成的二叉图。Lambda 自动生成的闭包类字段 hl1 和 hl2 指向被拼接的左右子列表。*

> **面试趣闻：$O(1)$ 反转单链表**  
> 如果结合 Hughes 链表与 `ReverseOnto`：
> ```csharp
> public static HList<T> Reverse(IImStack<T> fromStack) =>
>     fromStack.IsEmpty ? Empty : Make(stack => fromStack.ReverseOnto(stack));
> ```
> 构造该委托只需要 $O(1)$。下次若再有面试官要求你以 $O(1)$ 时间反转链表，你可以淡定地告诉他：借助 Hughes 链表的函数式抽象，完全可以在常数时间内完成反转逻辑的构建。

---

## 本章小结

- 不可变数据结构具备强大的正确性保障：过去计算的事实永恒有效，天然免疫 TOCTOU 竞态并具备开箱即用的线程安全性。
- 持久化（结构共享）使得不可变数据结构在空间占用上极其克制，不同状态间可以最大化复用公共子结构。
- 通过将引发类型冲突的写入方法剥离为扩展方法，不可变集合能够极其安全地实现泛型协变。
- 基于双栈翻转的不可变队列展现了均摊复杂度的威力，但在不可变分支共享的极端重放场景下需警惕性能退化。
- 在不可变状态外层包裹可变外壳，是兼顾易用语法与瞬时撤销/重做（Undo/Redo）的极简工业级方案。
- Hughes 链表通过将链表表征为偏函数拼接，将高频的列表拼接与两端追加开销降至 $O(1)$，将成本延迟至终端求值阶段，展现了函数式抽象的高超技艺。
