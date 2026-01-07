# Dashboard 参数显示与列宽优化方案

## 1. 补充缺失的默认参数
**问题**：部分算法（如决策树、随机森林、K-Means）在未手动修改参数时，Dashboard 中显示参数为空。
**原因**：前端仅展示了节点 `data.params` 中的内容，而如果用户未配置过，该字段可能为空，但后端实际上使用了默认参数运行。
**解决方案**：
- **导出默认参数**：将 `ModelParamsForm.tsx` 中的 `defaultParams` 对象导出。
- **合并参数显示**：在 `Dashboard.tsx` 中，将节点的 `params` 与 `defaultParams` 进行合并。展示逻辑为：`record.params || defaultParams[record.label] || {}`。这样即使节点无配置，也能显示算法实际使用的默认参数。

## 2. 优化主要参数列宽
**问题**：主要参数列在表格初始展示时占用的宽度过大。
**解决方案**：
- **设置固定宽度**：为“主要参数”列添加 `width: 200` 属性。
- **配合横向滚动**：由于之前已启用了表格的横向滚动 (`scroll.x`)，设置固定宽度后，该列不会强行撑开整个表格，而是保持在一个紧凑的宽度，用户可以通过横向滑动查看完整内容。

## 实施步骤
1.  **修改 `ModelParamsForm.tsx`**：在 `defaultParams` 定义前添加 `export` 关键字。
2.  **修改 `Dashboard.tsx`**：
    -   导入 `defaultParams`。
    -   在三个指标表格（分类、回归、聚类）的 `columns` 定义中：
        -   更新 `render` 函数，使用默认参数回退逻辑。
        -   给 `params` 列添加 `width: 200` 属性。
