---
title: "数据结构与算法的奇妙冒险（九）：贪心迭代代码美化排版"
date: 2026-10-31T01:09:00Z
description: "深入代码格式化与排版引擎底层，使用贪心算法与动态规划优化折行与缩进的美观度与计算代价。"
category: algorithms
column: fabulous-algorithms
tags: [贪心算法, 代码排版, 动态规划, 文本折行, 编译器]
---

# 第 9 章 贪心迭代代码美化排版

### 本章要点

- 定义“代码美化排版”（Pretty-Printing）问题
- 利用贪心算法快速求得近优解
- 通过显式栈消除深度递归以防止栈溢出
- 使用访问者模式（Visitor Pattern）实现关注点分离

面向软件开发者的现代编辑器通常都会为多种编程语言提供自动化代码格式化功能。对于那些空格和换行规则较为宽松的语言，这项特性尤为实用。诸如 C、Java 和 C# 等语言完全不在意你写出紧凑得令人窒息的代码：

```csharp
double Frob(int x){int y = Qux(x); return Rezrov(y+1);}
```

或者像这样随性散乱的代码：

```csharp
  double Frob(int x)
{ int y = Qux(  x);
    return Rezrov(y +1 )  ; }
```

在许多编程语言中，程序员拥有按照个人偏好格式化代码的极大自由。然而，我们绝大多数人写代码并不是为了自娱自乐；在工业界的职业生涯中，我们几乎总是在与团队同事共同维护庞大的既有代码库。在我工作过的每一个团队中，防止代码风格陷入混乱的规则基本如出一辙：
- 每个人在提交新文件之前，都必须使用同一套自动化代码格式化工具进行排版。
- 严禁随意更改现有文件的格式，除非该提交的唯一目的就是修正排版以符合规范。

这些都是合情合理的工程准则，但你是否曾好奇过：那些通常被称为“美化排版器”（Pretty Printer）的自动化代码格式化工具，底层究竟是如何运作的？在本章中，我们将审视现代代码编辑器必须权衡处理的各种棘手边界情况，随后提出一个简化的问题模型，并用一种优雅、高效、非递归的贪心算法来求解它。

底层的数据结构非常清晰——包含约半打不同节点类型的有向无环图，但该算法却能衍生出相当复杂的排版行为。我们还将探讨编译器开发者如何借助访问者模式（Visitor Pattern）将代码美化排版逻辑与语法分析树（Parse Tree）彻底解耦。

---

## 9.1 美化排版问题

如果我们想让一段源代码变得更美观，首先必须理解代码的逻辑结构。这属于**词法分析器**（Lexer，将原始字符串切分为标记序列）和**语法分析器**（Parser，从标记序列中推导出语法分析树）的工作范畴。**语法分析树**明确标识了代码的哪些部分是语句、表达式、字面量等。语法分析是一个极其庞大的领域，已有大量专著详述，因此本书不再赘述。

当我们拿到一棵语法分析树后，代码美化排版的核心任务就是：**如何赏心悦目地将这棵树重新转换为纯文本**。

究竟怎样才算赏心悦目？我们需要在以下三个目标之间找到合理的平衡：
1. **防止超出屏幕横向折行或出现水平滚动条**：除非万不得已，任何行的长度都不应超过给定上限（通常为 80 或 100 个字符）。
2. **通过清晰的缩进帮助读者快速理解代码的层级结构**。
3. **减少垂直方向的代码占用行数**：尽可能少地插入不必要的换行符。

这些目标之间往往存在冲突，通常我们按照上述顺序来排定优先级。许多开发者会认为以下格式是有问题的，因为它片面追求减少换行，却牺牲了代码层次结构的易读性：

```csharp
if (outdated) Update(); CreateReport();
```

相比之下，下面两种方案都是显著的改进，尽管不同人对哪一种更优各有偏好：

```csharp
// 方案 A
if (outdated) Update();
CreateReport();

// 方案 B
if (outdated)
    Update();
CreateReport();
```

你可以根据自己对“缩进层次”与“垂直紧凑性”的权衡权重为其中任意一种方案辩护。而当考虑到具体编程语言的各种怪癖语法时，问题还会变得更加棘手。例如，如果表达式中间夹杂着行尾注释，美化排版器该如何应对？

```csharp
if (outdated) Update // TODO: 重命名此方法
(); CreateReport();
```

理智的开发者大概率不会写出这种代码，但美化排版器必须能够健壮地处理任意合法代码。此时最合理的排版或许是：

```csharp
if (outdated)
    Update // TODO: 重命名此方法
    ();
CreateReport();
```

另一个常见难题是块状注释（定界注释）在折行时究竟应该向左粘附还是向右粘附：

```csharp
Foo(); /* ABC */ Bar(); /* DEF */ Frob();
```

如果排版器决定将其拆分成多行，`/* ABC */` 应该跟在前面的分号后，还是放在 `Bar()` 之前？观察以下两种可能，你更倾向于哪一种？

```csharp
// 选项一：向左粘附
Foo(); /* ABC */
Bar(); /* DEF */
Frob();

// 选项二：向右粘附
Foo();
/* ABC */ Bar();
/* DEF */ Frob();
```

这是我们在开发 C# 编译器和 IDE 时必须解决的真实工程痛点。但在本章中，为了不让各个语言繁杂琐碎的语法细节喧宾夺主，我们将对问题进行合理的精简抽象：
- 假设排版输出中不包含任何注释。
- 空白字符仅允许使用空格和换行符，不允许使用制表符（Tab）。
- 缩进深度固定为每层 4 个空格。
- 假设不存在强制换行（即我们专注于不含注释的表达式排版，而非包含固定换行分界的语句块）。

在阅读本章代码时，你可以随时思考如何扩展这套框架以支持强制换行和行尾注释逻辑。

---

## 9.2 贪心算法与找零钱问题

所谓**贪心算法**（Greedy Algorithm），是指将一个大问题拆解为若干更小的子问题，为每个子问题寻找局部最优解，并将这些局部最优解组合起来以求解整体大问题。该算法之所以被称为“贪心”，是因为求解子问题的步骤只在乎自私地追求*当前子问题*的最优，而不考虑对全局长远的影响。

贪心算法的最大优势是实现通常极其直接高效；缺点则是局部最优解的组合往往并不等于全局最优解。**找零钱问题**就是阐述这一特性的经典范例。

在美国，收银机中流通的硬币通常有 25 美分（Quarter）、10 美分（Dime）、5 美分（Nickel）和 1 美分（Penny）。给定找零金额，我们希望用最少数量的硬币完成找零。

假设你需要找零 73 美分。贪心算法优先尽可能多地使用面值最大的硬币：
1. 给出两枚 25 美分，剩余 23 美分。
2. 给出两枚 10 美分，剩余 3 美分。
3. 此时无法使用 5 美分，给出三枚 1 美分。
4. 最终找零为：两枚 25 美分、两枚 10 美分、零枚 5 美分和三枚 1 美分，共计 7 枚硬币。

对于标准的美制硬币体系，贪心算法总是能求得全局最优解——**除非收银机里没有 5 美分硬币**。假设没有 5 美分硬币，需要找零 41 美分：
- 贪心算法会找出一枚 25 美分、一枚 10 美分和六枚 1 美分，共计 8 枚硬币。
- 但全局最优解显然是四枚 10 美分加一枚 1 美分，仅需 5 枚硬币！

你可以利用第 8 章介绍的回溯算法为任意币种组合求解全局最优找零，但回溯算法在无法快速剪枝时开销极高。在工程实践中，一个能够瞬间给出可接受良好答案的贪心算法，往往远比一个极度缓慢但能求出理论完美最优解的算法更为实用。

在 IDE 中编辑大型代码文件时，我们通常期望排版引擎能够以近乎实时的速度完成格式化。借助近优的贪心算法立即获得整洁的代码，远比为了毫无感知差异的微小美观度提升而卡顿等待更有价值。

---

## 9.3 贪心美化排版算法

代码美化排版算法的历史几乎与需要打印排版代码的编程语言一样悠久。本章展示的算法是 Christian Lindig 在 2000 年发表的论文《Strictly Pretty》中算法的简化版本；而 Lindig 的算法衍生自 Philip Wadler 1998 年的名篇《A Prettier Printer》，Wadler 又进一步借鉴了 Derek Oppen 在 1980 年首创的设计。

> **注意**  
> Wadler 的灵感还来自于 John Hughes（我们在第 2 章提到过的 Hughes List 的发明者）1995 年的经典论文《The Design of a Pretty-printing Library》。该论文探讨了一种更为复杂的回溯排版算法。我强烈建议阅读这篇论文，它不仅关乎美化排版，更是一篇关于如何进行优雅函数式库设计的典范教程。

我们的贪心代码美化排版算法分为两个阶段：
1. **阶段一**：将语法分析树转换为一种全新的数据结构，我们称之为 **Doc（文档）**。Doc 结构通过将拼接、缩进、逻辑分组、空格和换行规则与待排版的源代码文本共同编码，精确描述我们对排版的期望意图。每个概念在底层都对应有向图中的一个节点。
2. **阶段二**：通过贪心算法将 Doc 结构转换为最终排版文本，在遍历过程中尽可能多地将内容塞入当前行。

为了更清晰地理解整个体系，我们先在 9.3.1 和 9.3.2 节定义 Doc 数据结构，在 9.3.3 和 9.3.4 节实现将 Doc 渲染为文本的核心阶段二，最后在 9.4 节实现将语法分析树转化为 Doc 的阶段一。

### 9.3.1 文档数据结构（Doc）

我们首先定义抽象基类 `Doc`，以及五个不可变的派生类型：

**代码清单 9.1 Doc 数据结构**

```csharp
using System.Text;

abstract record class Doc
{
    // 为简便起见，每层缩进固定为 4 个空格
    public static readonly int IndentSpaces = 4;
    public static readonly Doc Empty = new TextDoc("");
    public static readonly Doc Space = new OptBreakDoc(" ");
    public static readonly Doc OptBreak = new OptBreakDoc("");

    // 静态工厂方法，简化 Doc 树的构建
    public static TextDoc Text(string text) => new TextDoc(text);
    public static GroupDoc Group(Doc doc) => new GroupDoc(doc);
    public static IndentDoc Indent(Doc doc) => new IndentDoc(doc);
    public static ConcatDoc Concat(Doc left, Doc right) =>
        new ConcatDoc(left, right);

    // 重载加号操作符作为拼接的快捷语法，类似字符串拼接
    public static ConcatDoc operator +(Doc left, Doc right) =>
        Concat(left, right);

    // 判断 Doc 能否在不发生折行的情况下容纳于指定宽度内
    private bool Fits(int width) { /* 后文实现 */ return false; }

    // 将 Doc 排版渲染为最终字符串
    public string Pretty(int width) { /* 后文实现 */ return ""; }
}

sealed record class TextDoc(string text) : Doc;
sealed record class OptBreakDoc(string text) : Doc;
sealed record class GroupDoc(Doc doc) : Doc;
sealed record class IndentDoc(Doc doc) : Doc;
sealed record class ConcatDoc(Doc left, Doc right) : Doc;
```

各派生类型的具体语义如下：
- `TextDoc`：仅包含纯文本字符串，且假定字符串中不含换行符。
- `OptBreakDoc`：可选换行点。文本可以保持原样输出，也可以在必要时被替换为一个换行符。我们预置了两个常用实例：`Space`（表示一个空格，或在折行时变成换行符）与 `OptBreak`（表示无空格的可选换行点）。
- `GroupDoc`：逻辑分组。在同一分组内部，所有未嵌套在更深层子分组中的可选换行点具有**原子联动性**：要么全部保持原样留在单行内，要么全部断开转为换行符。例如在一组由逗号分隔的参数列表中，我们优先尝试将它们全部排在一行；如果塞不下，则在每一个逗号后统一插入换行符，而不是突兀地只折断其中某一个。
- `IndentDoc`：缩进修饰。导致其子节点内的所有换行符在折行后自动追加缩进空格。
- `ConcatDoc`：将两个 Doc 节点前后拼接。

基类中还包含两个关键方法：`Fits`（判断在不发生换行时是否能塞进指定宽度）与 `Pretty`（将 Doc 转换为排版字符串）。

现在来看一个具体范例。假设我们希望排版表达式 `Foo.Bar(xx + yy * zz)`，我们该如何表达排版规则？
- 在 `Foo` 和点号之间允许换行，但点号和 `Bar` 之间不允许断开。如果点号前发生换行，换行后的 `.Bar` 需要缩进。
- 左括号后允许换行。若发生换行，括号内部的内容整体缩进；右括号前绝不单独换行，紧贴参数列表末尾。
- 运算符 `+` 和 `*` 两侧应有空格修饰，且在需要时允许被换行替换；折行后右侧运算量自动缩进。

**代码清单 9.2 声明排版偏好规则**

```csharp
using static Doc;

TextDoc foo = new("Foo"), bar = new("Bar"), xx = new("xx"),
    yy = new("yy"), zz = new("zz"), dot = new("."), plus = new("+"),
    star = new("*"), lparen = new("("), rparen = new(")");

var mult = Group(Indent(Group(yy + Space + star) + Space + zz));
var sum = Group(Indent(Group(xx + Space + plus) + Space + mult));
var parens = Group(Indent(lparen + OptBreak + sum + rparen));
var foobar = Group(foo + Indent(Group(OptBreak + dot + bar)));
var callfb = Group(foobar + parens);

// 设置一个极小宽度以清晰观察排版断行行为
int width = 20;
Console.WriteLine(callfb.Pretty(width));
```

> **注意**  
> 软件设计中至关重要的一课是：**优秀的库能够让领域概念以高度浓缩、直观且声明式的方式直接映射为代码**。我们通过一组简单的节点类型，就将换行偏好、缩进规则、原子分组等抽象排版意图表达得淋漓尽致。

原始表达式共计 21 个字符。如果行宽限制为 20 个字符，排版器输出的结果如下（第二行仅占 17 个字符）：

```text
Foo.Bar(
    xx + yy * zz)
```

为什么换行符恰好落在此处？背后的贪心理辑如下：
1. 最外层分组（`callfb`）超过了 20 字符，但其直属层级没有可选断行点，于是下钻到其左右子分组 `foobar` 与 `parens`。
2. 左子分组 `foobar` 渲染为 `"Foo.Bar"` 仅占 7 字符，能够完整放入当前行，贪心地将其直接打印，当前行剩余 13 字符空间。
3. 右子分组 `parens` 宽 14 字符，无法塞入剩余的 13 字符中。该分组在左括号后包含一个 `OptBreak`，因此打印左括号后立即触发换行。
4. 该 `OptBreak` 位于 `IndentDoc` 内部，因此换行后自动追加 4 个空格缩进。
5. 当前行已使用 4 字符，剩余可用宽度为 16 字符。而未打印的表达式剩余部分恰好占 13 字符，完全能够容纳，无需再产生新的换行。排版顺利完成！

### 9.3.2 可视化文档：它究竟能嵌套多深？

在上述例子中，原本仅有 21 个字符的一行代码，转换生成的 Doc 有向图深度竟然高达 17 层！

由于 `Group` 和 `Indent` 属于极其频繁的修饰节点且都只有一个子节点，Doc 图往往呈现出“极其深邃但并不宽阔”的形态。随着源文件规模的扩大，Doc 图的嵌套深度可能会迅速攀升到数千层。

这立刻为算法实现敲响了警钟：**如果采用朴素的递归遍历，极易引发调用栈溢出（Stack Overflow）**。

### 9.3.3 阶段二：无递归实现 Fits()

在许多面向对象设计中，人们倾向于把 `Fits` 和 `Pretty` 实现为派生类的虚方法重写并进行递归。然而在 .NET 或 Java 运行时中，线程默认分配的调用栈空间非常有限（通常为 1MB~4MB）。深度递归一旦超出限制，会导致无法捕获的进程崩溃。

因此，我们坚决避免方法递归调用，转而**通过在堆上分配显式的 `Stack` 数据结构来追踪待处理的任务节点**。

`Fits(width)` 方法回答这样一个问题：“若该 Doc 子树内的所有后代可选换行点均不发生折行，它所占用的字符宽度是否小于等于 `width`？”
- `TextDoc`：若其文本长度小于等于剩余宽度则容纳。
- `GroupDoc` 或 `IndentDoc`：只需将其子节点推入工作栈继续检查。
- `OptBreakDoc`：假定其不发生换行，按其原有文本字符长度计入占用。
- `ConcatDoc`：左子节点必须先被处理，因此先将右子节点压栈，再将左子节点压栈。

**代码清单 9.3 非递归版本的 Fits 方法**

```csharp
abstract record class Doc
{
    private bool Fits(int width)
    {
        // 使用显式的工作栈替代函数调用栈
        var docs = new Stack<Doc>();
        docs.Push(this);
        int used = 0;

        while (true)
        {
            // 已累计使用的水平宽度超出限制，判定无法容纳
            if (used > width)
                return false;

            // 所有节点均已扫描完毕且未超限，判定可以容纳
            if (docs.Count == 0)
                return true;

            Doc doc = docs.Pop();
            switch (doc)
            {
                case TextDoc td:
                    used += td.text.Length;
                    break;
                case GroupDoc gd:
                    docs.Push(gd.doc);
                    break;
                case IndentDoc id:
                    docs.Push(id.doc);
                    break;
                case OptBreakDoc bd:
                    // 贪心测试：假定可选换行点不发生断行，只累加其文本长度
                    used += bd.text.Length;
                    break;
                case ConcatDoc cd:
                    // 左节点先出栈处理，因此右节点先入栈
                    docs.Push(cd.right);
                    docs.Push(cd.left);
                    break;
            }
        }
    }
}
```

分析该算法的资源开销：
- **空间复杂度**：由于只利用显式工作栈，函数调用栈深度为常数 $O(1)$。工作栈 `docs` 的最大深度绝不会超过 `ConcatDoc` 的总数量。即使面对数万个节点，堆上的 `Stack<Doc>` 也仅需微不足道的几百 KB 内存，极其稳健。
- **时间复杂度**：若结果返回 `false`，算法通常在扫描若干字符超出 `width` 时就会立即提前短路退出；若返回 `true`，说明该子表达式完全可以在单行内显示，而能单行显示的表达式通常体量较小。因此在典型情况下，`Fits` 的执行极其迅速。

### 9.3.4 阶段二续：无递归实现 Pretty()

在生成最终文本时，由于涉及大量碎片字符串的拼接，我们使用 `StringBuilder` 保证拼接耗时关于输出长度呈线性关系。

在非递归遍历中，我们需要在处理子节点时携带三个维度的上下文状态：
1. **当前分组是否能够单行容纳**（布尔值 `fits`）：指示内部的 `OptBreak` 应该输出空格还是替换为换行符。
2. **当前缩进深度**（整数 `indent`）：换行后需要追加的空格数量。
3. **当前处理的节点**（`Doc`）。

我们通过在工作栈中保存 `(bool fits, int indent, Doc doc)` 三元组来完美传递这些上下文状态。

此外，为了确保任何孤立的 `OptBreakDoc` 都处于合法分组的管理下，我们在入口处统一将待排版的根节点包装在一个外层 `GroupDoc` 中。

**代码清单 9.4 非递归版本的 Pretty 方法**

```csharp
using System.Text;

abstract record class Doc
{
    public string Pretty(int width)
    {
        var sb = new StringBuilder();
        int used = 0; // 当前行已使用的字符数

        // 工作栈存储 (当前组是否放得下, 当前缩进空格数, 待处理Doc节点)
        var docs = new Stack<(bool, int, Doc)>();
        docs.Push((true, 0, new GroupDoc(this)));

        while (docs.Count > 0)
        {
            (bool fits, int indent, Doc doc) = docs.Pop();
            switch (doc)
            {
                case TextDoc td:
                    sb.Append(td.text);
                    used += td.text.Length;
                    break;

                case GroupDoc gd:
                    // 贪心探测：该子分组能否塞进当前行剩余的宽度中？
                    docs.Push((gd.doc.Fits(width - used), indent, gd.doc));
                    break;

                case IndentDoc id:
                    // 深入一层缩进修饰，增加每层标准的缩进空格数
                    docs.Push((fits, indent + IndentSpaces, id.doc));
                    break;

                case OptBreakDoc bd:
                    if (fits)
                    {
                        // 若所在分组无需换行，输出原本字符（如单个空格）
                        sb.Append(bd.text);
                        used += bd.text.Length;
                    }
                    else
                    {
                        // 若所在分组塞不下，输出换行符并追加对应层级的缩进空格
                        sb.AppendLine();
                        sb.Append(' ', indent);
                        used = indent;
                    }
                    break;

                case ConcatDoc cd:
                    // 左侧内容先输出，因此右侧先入栈
                    docs.Push((fits, indent, cd.right));
                    docs.Push((fits, indent, cd.left));
                    break;
            }
        }

        return sb.ToString();
    }
}
```

现在测试不同宽度限制下的排版效果：

```csharp
Console.WriteLine(callfb.Pretty(30));
Console.WriteLine(callfb.Pretty(20));
Console.WriteLine(callfb.Pretty(15));
```

输出展现了极佳的自适应折行能力：

```text
// 宽度 30
Foo.Bar(xx + yy * zz)

// 宽度 20
Foo.Bar(
    xx + yy * zz)

// 宽度 15
Foo.Bar(
    xx +
        yy * zz)
```

> **注意**  
> 细心的读者可能会发现，在宽度限制为 15 时，最后一行 `        yy * zz)` 实际上占据了 16 个字符（8 个缩进空格 + 8 个代码字符）。这是 Bug 吗？并不是，这是规则设定的必然取舍。我们在规则中明确规定了“右括号前不单独折行”。分组 `yy * zz` 恰好放进了当前行剩余的 8 个字符中，贪心算法利用了该空间，导致紧随其后的右括号造成了 1 个字符的溢出。排版算法在追求性能、限制宽度、维持缩进与减少换行之间找到了折中。在工程世界中，**“足够好”（Good enough）就是最好**。

整体来看，排版的时间复杂度关于 Doc 节点总数呈线性 $O(n)$，完全足以瞬间格式化数千行代码。

---

## 9.4 阶段一：基于访问者模式转换语法分析树

回顾整个排版流水线：
- **阶段 0**：解析器将源代码解析为语法分析树（Parse Tree）。
- **阶段 1**：将语法分析树转化为携带排版规则意图的 Doc 树。
- **阶段 2**：将 Doc 树渲染为最终纯文本。

我们已经完成了阶段 2，现在解决阶段 1。首先定义一组用于表示基础表达式的不可变语法树类型：

**代码清单 9.5 初始的语法分析树类层次结构**

```csharp
abstract record class Expr;
sealed record class Id(string name) : Expr;
sealed record class Paren(Expr expr) : Expr;
sealed record class Add(Expr left, Expr right) : Expr;
sealed record class Mult(Expr left, Expr right) : Expr;
sealed record class Member(Expr obj, string name) : Expr;
sealed record class Call(Expr receiver, params IList<Expr> arguments) : Expr;
```

这足以表达如 `Foo.Bar((x + y.z) * q, A.B.C)` 这样的嵌套表达式。

那么，排版转换逻辑应该写在哪里？最直觉的做法是在基类 `Expr` 中增加虚方法：

```csharp
abstract record class Expr
{
    public abstract Doc ToDoc();
}
```

但这在工业级软件架构中存在三个致命痛点：
1. **康威定律与团队职责隔离**：负责编写编译器的团队与负责编写 IDE 编辑器格式化插件的团队往往分属不同组织。如果使用虚方法，编辑器团队的每次格式化规则变更都必须直接修改编译器团队的核心语法树代码，这极不合理。
2. **多排版策略冲突**：不同开发者对代码美观的理解千差万别。如果未来需要支持 Google 风格、微软风格或紧凑风格，难道要在语法树基类上不断堆积 `ToAliceDoc()`、`ToBobDoc()` 吗？
3. **语法树职责膨胀**：语法分析树是编译器的核心数据载体，代码高亮、静态分析（Linter）、常量折叠、类型检查、优化、IL 代码生成等十几个子系统都要操作这棵树。如果每个功能都在语法树上加一个抽象虚方法，基类很快就会变得臃肿不堪、无法维护。

**访问者模式（Visitor Pattern）** 正是优雅破解此困局的经典利器。

### 9.4.1 实现访问者模式（双重分派）

访问者模式允许我们在不修改现有类层次结构的前提下，为整个层次结构“外挂”任意多组功能各异的虚拟方法。

我们首先定义一个泛型访问者接口：

**代码清单 9.6 访问者接口**

```csharp
interface IExprVisitor<T>
{
    T Visit(Id id);
    T Visit(Paren paren);
    T Visit(Add add);
    T Visit(Mult mult);
    T Visit(Member member);
    T Visit(Call call);
}
```

如果客户端持有一个基类类型的变量 `Expr expr`，C# 编译器在编译期无法通过重载决议直接定位到具体的重载版本 `visitor.Visit(expr)`。为了解决这个问题，语法树只需提供一个固定模板方法——通常命名为 `Accept`：

```csharp
abstract record class Expr
{
    public abstract T Accept<T>(IExprVisitor<T> visitor);
}

sealed record class Id(string name) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this); // 此时 this 的静态编译类型明确为 Id！
}
```

调用流程如下：

```csharp
Expr expr = new Id("foo");
IExprVisitor<Doc> visitor = new ExprToDoc();
Doc result = expr.Accept(visitor);
```

追踪此过程发生的两次分派（Double Dispatch）：
1. 运行时根据 `expr` 的实际动态类型（`Id`）多态调用 `Id.Accept`。
2. 在 `Id.Accept` 内部，编译器明确知道 `this` 的静态类型为 `Id`，从而精准绑定到接口的 `visitor.Visit(Id)` 重载。

> **注意**  
> 访问者模式更本质的名称其实是**双重分派模式（Double-Dispatch Pattern）**：最终执行的具体方法取决于两个对象的运行时类型——即接收者 `expr` 与访问者 `visitor`。

为语法树补充完整的 `Accept` 样本代码：

**代码清单 9.7 具备访问者模式支持的完整语法分析树**

```csharp
abstract record class Expr
{
    public abstract T Accept<T>(IExprVisitor<T> visitor);
}

sealed record class Id(string name) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}

sealed record class Paren(Expr expr) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}

sealed record class Add(Expr left, Expr right) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}

sealed record class Mult(Expr left, Expr right) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}

sealed record class Member(Expr obj, string name) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}

sealed record class Call(Expr receiver, params IList<Expr> args) : Expr
{
    public override T Accept<T>(IExprVisitor<T> visitor) =>
        visitor.Visit(this);
}
```

### 9.4.2 从语法分析树到 Doc

现在我们可以把所有排版意图独立收拢在一个专门的访问者类 `ExprToDoc` 中：

**代码清单 9.8 将语法分析树转换为 Doc 的访问者实现**

```csharp
using static Doc;

sealed class ExprToDoc : IExprVisitor<Doc>
{
    // 复用标点符号文本节点
    private static readonly Doc comma = Text(",");
    private static readonly Doc lparen = Text("(");
    private static readonly Doc rparen = Text(")");
    private static readonly Doc star = Text("*");
    private static readonly Doc plus = Text("+");
    private static readonly Doc dot = Text(".");

    // 1. 标识符直接转换为纯文本
    public Doc Visit(Id id) => Text(id.name);

    // 2. 括号表达式：左括号后支持可选换行，换行后内容缩进
    public Doc Visit(Paren paren) =>
        Group(Indent(lparen + OptBreak + paren.expr.Accept(this)) + rparen);

    // 3. 二元运算符辅助逻辑：运算符跟左操作数绑定，两侧加空格，折行则缩进
    private Doc BinOp(Expr left, Doc op, Expr right) =>
        Group(Indent(Group(left.Accept(this) + Space + op) +
            Space + right.Accept(this)));

    public Doc Visit(Add add) => BinOp(add.left, plus, add.right);
    public Doc Visit(Mult mult) => BinOp(mult.left, star, mult.right);

    // 4. 成员访问（点号）：点号前支持可选换行并缩进
    public Doc Visit(Member member) =>
        Group(member.obj.Accept(this) +
            Indent(Group(OptBreak + dot + Text(member.name))));

    // 5. 逗号分隔列表与方法调用
    private Doc CommaList(IList<Expr> items)
    {
        Doc result = Empty;
        for (int i = 0; i < items.Count; i += 1)
        {
            result += items[i].Accept(this);
            if (i != items.Count - 1)
                result += comma + Space;
        }
        return result;
    }

    private Doc ParenList(IList<Expr> items) =>
        items.Count == 0 ?
            lparen + rparen :
            Group(Indent(lparen + OptBreak + CommaList(items) + rparen));

    public Doc Visit(Call call) =>
        call.receiver.Accept(this) + ParenList(call.args);
}

static class Extensions
{
    public static Doc ToDoc(this Expr expr) =>
        expr.Accept(new ExprToDoc());

    public static string Pretty(this Expr expr, int width) =>
        expr.ToDoc().Pretty(width);
}
```

组装一棵复杂的语法树并在不同宽度限制下进行美化排版：

```csharp
var f = new Member(new Member(new Id("Frobozz"), "Frobulator"), "Frobulate");
var b = new Member(new Id("Blob"), "Width");
var c = new Member(new Id("Cob"), "Width");
var g = new Member(new Id("Glob"), "Length");
var q = new Member(new Member(new Id("Qbert"), "Quux"), "Qix");
var m = new Mult(new Paren(new Add(b, c)), g);
var call = new Call(f, m, q);

// 限制宽度 80
Console.WriteLine(call.Pretty(80));

// 限制宽度 40
Console.WriteLine(call.Pretty(40));

// 限制宽度 29
Console.WriteLine(call.Pretty(29));
```

输出展现了惊艳的自适应层次折行能力：

```text
// 宽度 80
Frobozz.Frobulator.Frobulate(
    (Blob.Width + Cob.Width) * Glob.Length,
    Qbert.Quux.Qix)

// 宽度 40
Frobozz.Frobulator.Frobulate(
    (Blob.Width + Cob.Width) *
        Glob.Length,
    Qbert.Quux.Qix)

// 宽度 29
Frobozz.Frobulator.Frobulate(
    (Blob.Width + Cob.Width) *
        Glob.Length,
    Qbert.Quux.Qix)
```

至此，一个工业级的美化排版原型引擎已然诞生！

---

## 本章小结

- 美化排版是一个历史悠久的经典工程问题：其核心在于在行宽限制、垂直紧凑性与通过缩进展现代码层次结构之间达成精妙平衡。
- 排版流水线分为三层：阶段 0 由解析器产出语法树；阶段 1 将语法树翻译为描述折行和缩进规则的 Doc 数据结构；阶段 2 将 Doc 渲染为适应页面宽度的最终文本。
- 贪心算法通过局部最优推进（即能排在当前行就绝不主动折行），能够在极快时间内生成高水准的排版文本，极其适合 IDE 中的实时动态格式化。
- Doc 树的嵌套深度可能远超语法分析树。在面临调用栈溢出风险的运行时中，必须使用显式分配在堆上的栈结构消除方法递归。
- 访问者模式（双重分派）能够将美化排版、类型推导、代码生成等操作从语法树数据结构中彻底解耦，完美遵循单一职责原则。
- 优秀的软件架构应当允许开发者以富有表现力的声明式代码表达特定领域的排版规则。
