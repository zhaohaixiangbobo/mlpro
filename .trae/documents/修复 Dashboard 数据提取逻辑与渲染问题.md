# 修复 Dashboard 数据加载与渲染问题

**问题诊断**:
1.  **数据源错误**: 经过代码审查，工作流 JSON 中的算法运行结果实际上是存储在 **`evalNode` (评估节点)** 中的，而不是 `algoNode` (算法节点)。`algoNode` 只负责存储参数和状态，`evalNode` 负责接收并展示结果。
    *   **现状**: 代码尝试从 `algoNode.data.result` 获取数据，导致获取为空，从而显示“该工作流中没有运行成功的算法结果”。
    *   **修复**: 需要通过遍历 `edges` (连线)，找到连接到 `algoNode` 的 `evalNode`，并从 `evalNode.data.result` 中提取评估数据。
2.  **L199 渲染问题**: 用户提到 `<Divider>` 部分“不行”，可能是因为：
    *   在没有数据时渲染了空结构或布局错乱。
    *   或者用户觉得“算法详情报告”这部分过于冗长，希望将其折叠或隐藏，只看对比。
    *   **改进**: 我将把这部分逻辑放入条件渲染中，确保只有在数据存在时才渲染，并且优化布局，避免在无数据时占据空间。

**实施计划**:

## 1. 修复数据提取逻辑 (`Dashboard.tsx`)
*   **重构 `handleWorkflowChange`**:
    *   获取所有 `algoNode` (category='Model')。
    *   遍历每个 `algoNode`，在 `edges` 中查找其输出连接的 `evalNode`。
    *   如果找到 `evalNode` 且包含 `result`，则将其视为一条有效记录。
    *   **数据结构合并**: 将 `algoNode` 的标签/参数与 `evalNode` 的结果合并，形成 `AlgoResult` 对象。

## 2. 优化渲染逻辑 (`Dashboard.tsx`)
*   **条件渲染**: 确保 `renderClassificationSection` 等函数在没有数据时返回 `null`，避免渲染空的 Divider。
*   **布局微调**: 检查 L199 周围的代码，确保 `Divider` 和 `Row` 的父容器样式正确。

## 3. 验证
*   加载 `test5.json` (或最新的工作流)，确认能否正确显示图表和表格。

**代码变更预览**:
```typescript
// 旧逻辑: 直接找 algoNode 里的 result
// const results = nodes.filter(n => n.type === 'algoNode' && n.data.result);

// 新逻辑: 找 algoNode -> edge -> evalNode -> result
const results = [];
nodes.filter(n => n.type === 'algoNode' && n.data.category === 'Model').forEach(algoNode => {
    // Find connected eval node
    const edge = edges.find(e => e.source === algoNode.id);
    if (edge) {
        const evalNode = nodes.find(n => n.id === edge.target && n.type === 'evalNode');
        if (evalNode && evalNode.data.result) {
            results.push({
                id: algoNode.id,
                label: algoNode.data.label,
                category: algoNode.data.category,
                params: algoNode.data.params,
                result: evalNode.data.result
            });
        }
    }
});
```
