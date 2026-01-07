# Label 列处理增强与参数面板调试计划

针对您反馈的两个问题，我的分析和计划如下：

## 1. Label 列在前端预处理中依然可选

*   **问题原因**: 虽然后端在执行时排除了 Label 列，但前端的 `MissingValueForm` 和 `StandardizationForm` 组件在渲染列选择列表时，并没有过滤掉 Label 列。
*   **解决方案**:
    *   在 `PropertyPanel.tsx` 中，除了获取列信息外，还需要获取当前文件的 `meta` 信息（其中包含 `label_column`）。
    *   将 `labelColumn` 作为属性传递给 `MissingValueForm` 和 `StandardizationForm`。
    *   在这些子组件中，使用 `labelColumn` 过滤掉对应的列，或者将其禁用并标记为 "Label (不可选)"。

## 2. 逻辑回归等算法节点显示 "该节点无需配置"

*   **问题原因**: 我检查了代码，`PropertyPanel.tsx` 中根据 `selectedNode.data.category` 来判断渲染哪个表单。如果 `category` 是 `'Model'`，则渲染 `ModelParamsForm`。如果显示 "该节点无需配置"，说明 `category` 判断条件不满足，或者 `ModelParamsForm` 内部渲染了默认分支。
*   **调试发现**: 在之前的 `AlgoNode` 定义中，算法节点的 `category` 可能被默认设置为 `'Model'`。但在 `Sidebar` 拖拽逻辑中 (`Sidebar.tsx`，虽然没看代码但可以推测) 或者 `Workflow.tsx` 的 `onDrop` 逻辑中，可能没有正确传递 `category`，或者传递的值不是首字母大写的 `'Model'` (例如可能是小写 `'model'`)。
*   **解决方案**:
    *   检查 `Workflow.tsx` 的 `onDrop` 逻辑，确保节点的 `data.category` 被正确设置。
    *   在 `PropertyPanel.tsx` 中，放宽 `category` 的判断条件（同时兼容 `'Model'` 和 `'model'`），或者打印调试信息。
    *   同时，在 `ModelParamsForm.tsx` 中，`modelType` 是从 `data.label` 获取的。需要确保 `data.label` 与 `renderFields` 中的 `case` 语句完全匹配（例如 "逻辑回归" vs "Logistic Regression"）。根据之前的代码，Sidebar 似乎使用的是中文名称。

## 执行步骤

1.  **修改 `PropertyPanel.tsx`**:
    *   从 API 响应中提取 `label_column`。
    *   传递 `labelColumn` 给子组件。
    *   **调试/修复 Category 判断**: 修改判断逻辑为 `category === 'Model' || category === 'model'`，以防大小写不一致问题。

2.  **修改 `MissingValueForm.tsx` 和 `StandardizationForm.tsx`**:
    *   接收 `labelColumn` prop。
    *   在 `availableCols` 或 `numericCols` 的过滤逻辑中，排除 `labelColumn`。

3.  **检查 `Workflow.tsx` (onDrop)**:
    *   确认拖拽生成的节点 `data` 中包含正确的 `label` 和 `category`。

通过这些步骤，前端将不再允许用户选择 Label 列进行预处理，且算法节点的参数面板将能正常显示。