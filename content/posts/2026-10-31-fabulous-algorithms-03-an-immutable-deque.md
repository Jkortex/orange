---
title: "数据结构与算法的奇妙冒险（三）：不可变双端队列（Deque）"
date: 2026-10-31T01:03:00Z
description: "基于指称透明与结构共享，设计具有 O(1) 均摊复杂度的纯不可变双端队列。"
category: algorithms
column: fabulous-algorithms
tags: [双端队列, Deque, 均摊复杂度, 结构共享, 函数式]
---

# 第 3 章 不可变双端队列（Deque）

### 本章核心内容

- 将栈与队列熔于一炉：构建双端队列（Deque）
- 对比朴素链表实现与手指树（Finger Tree）实现的性能鸿沟
- 扩展双端队列，实现亚线性时间复杂度的超快拼接操作

---

不可变双端队列（Double-ended Queue，简称 **Deque**，读作“deck”）的接口是单向队列极其自然的延伸。然而，要设计出一种能够在列表两端都以极低代价添加和移除元素的数据结构，绝非易事。

尝试构建一个双向连接的链表看似诱人，但正如我们即将看到的，其性能表现极其拙劣。此外，在第 2 章中，基于双栈翻转的不可变队列在出队时存在最坏情况 $O(n)$ 的性能断崖；如果有一种结构能将最坏情况大幅降低，那无疑是极大的飞跃。简而言之，面对这一抽象数据类型，我们必须选用远比以往更智慧的数据结构。本章我们将探索的结构——**手指树（Finger Tree）**——其精巧与复杂度将远超前两章的内容。

所谓**手指树**，是一种精巧重组树状数据结构的技术，它使得树中的特定重点节点（称为**手指**，fingers）始终紧邻根节点，因而访问开销极小。通过将“手指”安放在树的最左侧和最右侧边缘，并以递归方式组织双端队列的中部，我们能够实现一个在最坏情况下各类操作仅需 $O(\log n)$ 时间而非 $O(n)$ 的不可变双端队列——这是一个极其震撼的工程突破。

更奇妙的是，手指树完美借助了 C# 的泛型类型系统来实现纯粹、类型安全的结构自嵌套。这一数据结构彻底重塑了我对现代语言泛型系统的理解。

最后，第 2 章中的 Hughes 链表虽然提供了 $O(1)$ 的列表拼接，但那其实是一种“语法障眼法”，仅仅是将 $O(n)$ 的开销推迟到终端求值时一次性偿还。在本章末尾，我们将实现一种在双端队列之间真正具备亚线性阶（sublinear）耗时的快速拼接算法。

---

## 3.1 不可变双端队列抽象数据类型

在设计物理数据结构之前，先确立**抽象数据类型**（ADT）：
- **栈**（Stack）：在列表左端执行推入（Push）、查看（Peek）与弹出（Pop）。
- **队列**（Queue）：在左端入队（Enqueue），在右端查看（Peek）与出队（Dequeue）。
- **双端队列**（Deque）：允许在左、右两端自由进行推入、查看与弹出。为保持术语统一，我们在接口中沿用栈的操作命名规范。

由此定义出核心操作：`PushLeft`、`PushRight`、`PopLeft`、`PopRight`，配合左右查看方法 `Left` 和 `Right`，以及判空属性 `IsEmpty`。所有操作无论队列包含多少元素都应当是廉价的。此外，双端队列作为有序序列，应当实现 `IEnumerable<T>`（按惯例统一自左向右枚举）。

代码清单 3.1 不可变双端队列接口：

```csharp
public interface IDeque<T> : IEnumerable<T>
{
    IDeque<T> PushLeft(T item);
    IDeque<T> PushRight(T item);
    IDeque<T> PopLeft();
    IDeque<T> PopRight();
    T Left();
    T Right();
    bool IsEmpty { get; }
}
```

---

## 3.2 拙劣的朴素链表实现

在第 2 章中，我们使用两个独立的栈来分别服务左端入队与右端出队，代价是偶发性触发 $O(n)$ 的整栈反转。若要在双端队列上两端均支持双向出入，靠多个栈来回倒腾将导致频繁翻转，性能彻底崩塌。

有人可能会提出一种朴素的递归定义：**双端队列要么为空，要么为单元素，要么由一个左端元素、一个中间双端队列和一个右端元素构成**。

代码清单 3.2 朴素空队列与单元素队列：

```csharp
public sealed class Deque<T> : IDeque<T>
{
    private sealed class EmptyDeque : IDeque<T>
    {
        public IDeque<T> PushLeft(T item) => new SingleDeque(item);
        public IDeque<T> PushRight(T item) => new SingleDeque(item);
        public IDeque<T> PopLeft() => throw new InvalidOperationException();
        public IDeque<T> PopRight() => throw new InvalidOperationException();
        public T Left() => throw new InvalidOperationException();
        public T Right() => throw new InvalidOperationException();
        public bool IsEmpty => true;
        public IEnumerator<T> GetEnumerator() { yield break; }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    public static IDeque<T> Empty { get; } = new EmptyDeque();

    private record SingleDeque(T item) : IDeque<T>
    {
        public IDeque<T> PushLeft(T newItem) =>
            new Deque<T>(newItem, Empty, item);
        public IDeque<T> PushRight(T newItem) =>
            new Deque<T>(item, Empty, newItem);
        public IDeque<T> PopLeft() => Empty;
        public IDeque<T> PopRight() => Empty;
        public T Left() => item;
        public T Right() => item;
        public bool IsEmpty => false;
        public IEnumerator<T> GetEnumerator() { yield return item; }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
```

紧接着实现包含多元素的骨架：

代码清单 3.3 朴素的多元素双端队列：

```csharp
    private readonly T left;
    private readonly IDeque<T> middle;
    private readonly T right;

    private Deque(T left, IDeque<T> middle, T right)
    {
        this.left = left;
        this.middle = middle;
        this.right = right;
    }

    public IDeque<T> PushLeft(T item) =>
        new Deque<T>(item, middle.PushLeft(left), right);

    public IDeque<T> PushRight(T item) =>
        new Deque<T>(left, middle.PushRight(right), item);

    public IDeque<T> PopLeft() =>
        middle.IsEmpty ?
            new SingleDeque(right) :
            new Deque<T>(middle.Left(), middle.PopLeft(), right);

    public IDeque<T> PopRight() =>
        middle.IsEmpty ?
            new SingleDeque(left) :
            new Deque<T>(left, middle.PopRight(), middle.Right());

    public T Left() => left;
    public T Right() => right;
    public bool IsEmpty => false;

    public IEnumerator<T> GetEnumerator()
    {
        yield return left;
        foreach (var item in middle)
            yield return item;
        yield return right;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

### 为什么该朴素实现性能极度恶劣？

这段代码表面上看逻辑工整，但性能是一场彻底的灾难：
- **完全丧失结构持久化（零结构共享）**：每当向左端执行 `PushLeft` 时，原本的 `left` 被推入 `middle.PushLeft`，从而触发 `middle` 的递归新建；整个链条上的每一个节点都必须重新分配！对于一个包含 $n$ 个元素的队列，每次压栈和出栈都需要分配 $O(n)$ 个全新对象，时间和额外空间复杂度退化为极其昂贵的 $O(n)$。
- **遍历引发意外二次方（$O(n^2)$）**：`GetEnumerator` 采用朴素递归，每次跨越 $O(n)$ 层的递归调用栈来层层搬运元素，导致枚举耗时高达 $O(n^2)$，极易引发调用栈溢出。

我们必须构思出一种真正具备高持久化、低均摊开销的树形结构。

---

## 3.3 手指树（Finger Tree）

想象一棵树：它拥有一个根节点，叶节点分布在各处。在常规树遍历中，离根越远的节点访问成本越高。**手指树的核心法则在于：将某些关键操作节点（即“手指”）强行保持在紧邻根节点的极浅位置；离手指越近的节点越浅，离手指越远的节点越深**。

对于双端队列而言，最频繁操作的显然是最左侧和最右侧的端点元素。因此，我们将**最左端**与**最右端**设为手指：越靠近两端的元素在树中的层级越浅，越靠近正中间的元素在树中越深。

朴素实现之所以惨败，是因为两端仅能容纳单元素，每次插入都会立即溢出（overflow）到中间，导致中间层层级联重建。为了打破这一瓶颈，核心破局之道在于：**为左右两端设立具有弹性的“缓冲带”——微型双端队列（Mini-Deque）**！

### 3.3.1 微型双端队列（Mini-Deque）

我们设计一个辅助数据结构 `IMini`：它是一个容量严格限制在 1、2、3 或 4 个元素之间的小型不可变双端队列。不存在空 mini，当在容量为 1 时出队或在容量为 4 时压栈均属于非法操作：

代码清单 3.4 微型双端队列 `IMini` 家族：

```csharp
public sealed class Deque<T> : IDeque<T>
{
    private interface IMini : IEnumerable<T>
    {
        public int Size { get; }
        public IMini PushLeft(T item);
        public IMini PushRight(T item);
        public IMini PopLeft();
        public IMini PopRight();
        public T Left();
        public T Right();
    }

    private record One(T item1) : IMini
    {
        public int Size => 1;
        public IMini PushLeft(T item) => new Two(item, item1);
        public IMini PushRight(T item) => new Two(item1, item);
        public IMini PopLeft() => throw new InvalidOperationException();
        public IMini PopRight() => throw new InvalidOperationException();
        public T Left() => item1;
        public T Right() => item1;
        public IEnumerator<T> GetEnumerator() { yield return item1; }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private record Two(T item1, T item2) : IMini
    {
        public int Size => 2;
        public IMini PushLeft(T item) => new Three(item, item1, item2);
        public IMini PushRight(T item) => new Three(item1, item2, item);
        public IMini PopLeft() => new One(item2);
        public IMini PopRight() => new One(item1);
        public T Left() => item1;
        public T Right() => item2;
        public IEnumerator<T> GetEnumerator()
        {
            yield return item1;
            yield return item2;
        }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private record Three(T item1, T item2, T item3) : IMini
    {
        public int Size => 3;
        public IMini PushLeft(T item) => new Four(item, item1, item2, item3);
        public IMini PushRight(T item) => new Four(item1, item2, item3, item);
        public IMini PopLeft() => new Two(item2, item3);
        public IMini PopRight() => new Two(item1, item2);
        public T Left() => item1;
        public T Right() => item3;
        public IEnumerator<T> GetEnumerator()
        {
            yield return item1;
            yield return item2;
            yield return item3;
        }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private record Four(T item1, T item2, T item3, T item4) : IMini
    {
        public int Size => 4;
        public IMini PushLeft(T item) => throw new InvalidOperationException();
        public IMini PushRight(T item) => throw new InvalidOperationException();
        public IMini PopLeft() => new Three(item2, item3, item4);
        public IMini PopRight() => new Three(item1, item2, item3);
        public T Left() => item1;
        public T Right() => item4;
        public IEnumerator<T> GetEnumerator()
        {
            yield return item1;
            yield return item2;
            yield return item3;
            yield return item4;
        }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
```

这些类使用 C# `record` 实现，极其直观且安全。

### 3.3.2 基于 Mini 聚合的手指双端队列全新定义

现在我们给出双端队列的革命性递归定义：**一个双端队列要么为空，要么为单元素，要么由左端的 Mini、中间存放“Mini 集合”的双端队列、以及右端的 Mini 共同组成！**

请注意：**中间的 `middle` 存放的不再是普通元素 `T`，而是块（Chunk）——即 `IMini`！**
这一设计带来了质的飞跃：
1. **绝大多数操作触碰不到中间层**：向左端推入元素时，只要左端的 Mini 元素少于 4 个（即为 1、2 或 3），只需生成一个稍大的 Mini，而中间的 `middle` 与右侧的 `right` 均原封不动完全复用！同样，弹出时只要 Mini 元素大于 1，中间层完全不需要触碰。超过三分之二的操作仅在顶层常数时间内瞬间完成。
2. **块级下沉，层级呈对数递减**：当左端的 Mini 已经达到 4 个元素、无法再容纳新元素时，我们将其中 3 个元素打包为一个紧凑的 `Three` 块，**作为一个单一单元整体压入中间的 `middle`**！在最初的实现中，我们维持一个严格不变式：中间层队列中存放的元素类型必须严格是三元素块 `Three`。

代码清单 3.5 手指树双端队列核心实现：

```csharp
public sealed class Deque<T> : IDeque<T>
{
    // ... EmptyDeque 与 SingleDeque ...

    private readonly IMini left;
    private readonly IDeque<IMini> middle; // 中间是存放 IMini 块的双端队列！
    private readonly IMini right;

    private Deque(IMini left, IDeque<IMini> middle, IMini right)
    {
        this.left = left;
        this.middle = middle;
        this.right = right;
    }

    public IDeque<T> PushLeft(T value) =>
        left.Size < 4 ?
            new Deque<T>(left.PushLeft(value), middle, right) :
            new Deque<T>(
                new Two(value, left.Left()),
                middle.PushLeft(left.PopLeft()), // 将 3 个元素构成的 Three 整体压入中间层！
                right);

    public IDeque<T> PushRight(T value) =>
        right.Size < 4 ?
            new Deque<T>(left, middle, right.PushRight(value)) :
            new Deque<T>(
                left,
                middle.PushRight(right.PopRight()),
                new Two(right.Right(), value));

    public IDeque<T> PopLeft()
    {
        if (left.Size > 1)
            return new Deque<T>(left.PopLeft(), middle, right);
        if (!middle.IsEmpty)
            return new Deque<T>(middle.Left(), middle.PopLeft(), right);
        if (right.Size > 1)
            return new Deque<T>(new One(right.Left()), middle, right.PopLeft());
        return new SingleDeque(right.Left());
    }

    public IDeque<T> PopRight()
    {
        if (right.Size > 1)
            return new Deque<T>(left, middle, right.PopRight());
        if (!middle.IsEmpty)
            return new Deque<T>(left, middle.PopRight(), middle.Right());
        if (left.Size > 1)
            return new Deque<T>(left.PopRight(), middle, new One(left.Right()));
        return new SingleDeque(left.Right());
    }

    public T Left() => left.Left();
    public T Right() => right.Right();
    public bool IsEmpty => false;

    public IEnumerator<T> GetEnumerator()
    {
        foreach (var item in left)
            yield return item;
        foreach (var mini in middle)
            foreach (var item in mini)
                yield return item;
        foreach (var item in right)
            yield return item;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

---

## 3.4 数据结构可视化

让我们通过连续压入字符的过程，直观审视手指树在内存中的演化：

```csharp
var deque = Deque<char>.Empty
    .PushLeft('U').PushRight('V').PushLeft('T').PushLeft('S')
    .PushLeft('R').PushRight('W').PushRight('X').PushRight('Y');
```

此时双端队列总共有 8 个元素：左端是容纳 `[R, S, T, U]` 的 `Four`，右端是容纳 `[V, W, X, Y]` 的 `Four`，中间的 `middle` 为纯粹的 `Empty`。整个结构仅有顶层一层，外侧的 Mini 充当极浅的手指。

紧接着，向左压入 `'Q'`，向右压入 `'Z'`：
- 左侧 `Four` 无法再容纳第 5 个元素，于是提取最右边的 3 个元素 `[S, T, U]` 组装为一个 `Three`，整体推入 `middle`，左侧剩余两个元素构成 `Two`（`[Q, R]`）。
- 右侧同理，溢出一个 `Three`（`[V, W, X]`）推入 `middle`。
此时中间层被唤醒，变为包含两个 `Three` 元素的子队列。

当继续向左推入字符直到压入 21 个元素时，第二层的左侧 Mini 也逐渐填满；当压入第 22 个元素时，第二层的 `Four` 再次溢出，将 3 个 `Three`（共 9 个底层字符）打包推入第三层！

这就是手指树的宏伟构造：
- **第一层**的 Mini 存放 1~4 个字符；
- **第二层**的 Mini 存放 1~4 个 `Three`（即 3~12 个字符）；
- **第三层**的 Mini 存放 1~4 个“三阶的三阶”（即 9~36 个字符）！

缓冲区的容量随着树深度的增加呈**指数级暴涨**，这确保了整棵树的深度增长极其缓慢！

---

## 3.5 双端队列的均摊性能分析

审视向左端连续压栈时的开销概率分布：
- 每 3 次压栈中，有 **2 次** 仅需在第一层 Mini 内部更新，中间层完全不动（成本为 1 次更新）；
- 每 9 次压栈中，有 **2 次** 仅需更新到第二层（成本为 2 次更新）；
- 每 27 次压栈中，有 **2 次** 仅需更新到第三层（成本为 3 次更新）；
- 每 $3^d$ 次压栈中，仅有 2 次需要触碰第 $d$ 层！

对于出队操作，其成本分布完全对称。

### 渐进性能指标

- **最坏情况时间复杂度**：在最极端的多层级联溢出情况下，操作所需的时间与额外内存空间正比于树的最大深度，即严格为 $O(\log_3 n)$！对比第 2 章队列在最坏情况下的 $O(n)$，对数阶 $O(\log_3 n)$ 的最坏上限无论在理论还是工程实践中都是极度低廉的。
- **均摊时间复杂度**：将罕见且低廉的最坏开销均摊到漫长的高频常数操作上，**压栈与出栈的均摊复杂度为坚不可摧的 $O(1)$**！
- **额外空间开销**：在最底层存储 $3^d$ 个元素，各层树节点累计的额外包装对象总数严格小于 $(3^d - 1)/2$。平均分摊到每个元素上的额外空间为 $O(1)$，全队列额外开销为严密的 $O(n)$。
- **持久化能力**：任何一次操作仅更新两端极少数节点，树的中部主体被跨版本百分之百共享。
- **免于平衡树维护**：手指树无需像红黑树或 AVL 树那样维护复杂的旋转平衡不变式，便天然实现了对数深度的保证。

---

## 3.6 我们是否滥用了类型系统？

仔细观察双端队列的内部字段：
```csharp
private readonly IDeque<IMini> middle;
```
对于包含深度为 4 的字符双端队列：
- 顶层类型是 `Deque<char>`；
- 其 `middle` 类型是 `IDeque<Deque<char>.IMini>`；
- 次级 `middle` 类型是 `IDeque<Deque<Deque<char>.IMini>.IMini>`……

随着深度递增，泛型类型的嵌套越来越深。这是否属于滥用类型系统？编译器与运行时能否承受？

在 C++ 等依赖模板源码展开的编译模型中，这种无界的递归模板实例化会导致编译器在编译期疯狂展开代码直至内存崩溃。

然而在 C# 与 Java 中，**泛型是真正的一等泛型（True Generics）**。CLR 运行时对引用类型的泛型代码进行智能共享；更重要的是，由于树的深度为 $O(\log_3 n)$，哪怕存储上千万个元素，树深也仅仅只有十多层，生成的具体嵌套类型屈指可数，CLR 与 JIT 编译器处理起来轻松自如。类型系统在编译期完美守卫了每一层的结构契约。

---

## 3.7 双端队列的高效拼接（Concatenation）

列表拼接是极其常见的操作。在手指树中，我们能否在亚线性时间内拼接两个双端队列？

核心思路非常优雅：如果要拼接队列 $X$ 与队列 $Y$：
- $X$ 的左端作为新队列的左端；
- $Y$ 的右端作为新队列的右端；
- 剩下的 $X$ 的右端 Mini 与 $Y$ 的左端 Mini，被拆解并重新缝合成一组 `Two` 和 `Three`，整体推入中间层，随后**递归拼接两个队列的 `middle`**！

为了支持这一操作，我们稍微放宽不变式：允许中间层不仅存放 `Three`，也允许存放 `Two`。我们在 `IMini` 接口中增加一个 `TwosAndThrees` 方法：

代码清单 3.6 Mini 之间的拼接分解：

```csharp
private interface IMini : IEnumerable<T>
{
    // ...
    public IEnumerable<IMini> TwosAndThrees(IMini mini);
}

private record One(T item1) : IMini
{
    // ...
    public IEnumerable<IMini> TwosAndThrees(IMini mini) => mini switch
    {
        One or Two => [mini.PushLeft(Left())],
        _ => [PushRight(mini.Left()), mini.PopLeft()]
    };
}

private record Two(T item1, T item2) : IMini
{
    // ...
    public IEnumerable<IMini> TwosAndThrees(IMini mini) => mini switch
    {
        One => [PushRight(mini.Left())],
        Two or Three => [this, mini],
        _ => [PushRight(mini.Left()), mini.PopLeft()]
    };
}

private record Three(T item1, T item2, T item3) : IMini
{
    // ...
    public IEnumerable<IMini> TwosAndThrees(IMini mini) => mini switch
    {
        One => [PopRight(), mini.PushLeft(Right())],
        Two or Three => [this, mini],
        _ => [this, mini.PopRight().PopRight(), mini.PopLeft().PopLeft()]
    };
}

private record Four(T item1, T item2, T item3, T item4) : IMini
{
    // ...
    public IEnumerable<IMini> TwosAndThrees(IMini mini) => mini switch
    {
        One or Two => [PopRight(), mini.PushLeft(Right())],
        Three => [PopRight().PopRight(), PopLeft().PopLeft(), mini],
        _ => [PopRight().PopRight(), PopLeft().PopLeft().PushRight(mini.Left()), mini.PopLeft()]
    };
}
```

随后在多元素双端队列中实现递归拼接：

代码清单 3.7 双端队列的递归拼接实现：

```csharp
public sealed class Deque<T> : IDeque<T>
{
    // ...
    public IDeque<T> Concatenate(IDeque<T> items) =>
        items is Deque<T> r ?
            new Deque<T>(
                left,
                middle.PushRightMany(right.TwosAndThrees(r.left))
                      .Concatenate(r.middle), // 递归拼接两者的 middle！
                r.right) :
            this.PushRightMany(items);
}

static class Extensions
{
    public static IDeque<T> PushRightMany<T>(
        this IDeque<T> deque, IEnumerable<T> items) =>
        items.Aggregate(deque, (d, item) => d.PushRight(item));
}
```

递归的每一步都将中间边界的元素化解为 2~3 个 Mini 块推入次级队列，并将规模缩减至对中间层的拼接。

---

## 3.8 引入拼接后的性能表现

放宽不变式允许 `Two` 存在后，树的最坏深度仅从 $O(\log_3 n)$ 微调至 $O(\log_2 n)$，依然是稳健的对数阶。

对于双端队列拼接操作：
- 若其中一个队列为空，耗时严格为 $O(1)$；
- 若涉及两个多元素双端队列，递归调用深度严格受限于树的深度 $O(\log n)$。在每一层上，`TwosAndThrees` 与有限次推入均为 $O(1)$ 均摊操作。
- 因此，**两个双端队列拼接的最坏时间与额外空间复杂度均为极其优异的 $O(\log n)$**！

在无需延迟求值障眼法的前提下，手指树直接赋予了列表真正的亚线性极速拼接能力。

---

## 3.9 为什么叫手指树（Finger Tree）？

手指树（Finger Tree）最初由 Ralf Hinze 与 Ross Paterson 在函数式算法领域发扬光大。所谓“手指”，是指在数据结构中保留的指向特定内部位置的直接引用；手指树通过重塑平衡结构，使得针对手指邻近区域的操作开销仅与**操作点到手指的距离的对数**成正比。

对于双端队列，由于频繁操作的两端正是天然的手指位置，手指树展现出了惊人的亲和力。若进一步扩展该结构（例如在每个节点附加度量元数据 Monoid），手指树还可以用来高效构建持久化优先队列、区间树（Interval Tree）和支持 $O(\log n)$ 随机切片与索引的强力序列。

---

## 本章小结

- 朴素的双向单链表递归在不可变环境下缺乏结构持久化共享，会导致压栈出栈退化为 $O(n)$，枚举遍历退化为 $O(n^2)$。
- 手指树（Finger Tree）通过将两端设为浅层手指、中间设为指数级扩容块缓冲区的递归树，将两端操作的最坏开销压制在对数阶 $O(\log n)$，均摊复杂度严格保持在 $O(1)$。
- 采用 Mini-Deque（容量 1~4）作为边缘缓冲区，使三分之二以上的压出栈操作仅在顶层纯内存完成，大幅提升了缓存局部性与执行效率。
- 现代具备真实泛型系统的语言（如 C# CLR）能够完美支撑多层递归类型自嵌套，以极低的运行时开销确保高度类型安全。
- 借助 `TwosAndThrees` 边缘重组算法，手指树双端队列能够以 $O(\log n)$ 的亚线性惊人速度完成两个大型队列的直接拼接。
