# Dashboard 修复与优化计划

## 1. 修复参数列宽不生效
**问题**：您反馈设置 `width: 200` (或 100) 未生效。
**原因**：Ant Design Table 的 `width` 属性在启用 `scroll.x` 时，通常需要所有列都设置宽度或结合 `fixed` 属性才能严格生效。此外，内容过长可能会撑开列宽。
**解决方案**：
- 给 `params` 列的 `div` 容器添加显式的 CSS 样式 `width: 200px` (或您希望的 100px，但我建议至少 150px 以容纳内容) 和 `overflow-x: auto` (或 `hidden` + `Tooltip`)。
- **推荐方案**：
  - 将表格列定义的 `width` 设为 `150`。
  - 容器样式：`width: 150px; overflow-x: auto; white-space: nowrap;` (允许横向滚动查看) 或 `flex-wrap: nowrap` 并隐藏滚动条。
  - 鉴于之前您希望“单行显示”，我会强制 `div` 宽度并允许内部滚动。

## 2. 聚类算法最优值高亮
**问题**：聚类评估指标表格中的最优值未加粗。
**解决方案**：
- 计算指标最优值：
    - **轮廓系数 (Silhouette Score)**：越大越好 -> 高亮 MAX。
    - **CH 指标 (Calinski-Harabasz)**：越大越好 -> 高亮 MAX。
- 修改 `renderClusteringSection` 中的 `Table` 列渲染逻辑，添加类似分类和回归表格的高亮判断。

## 3. PCA 降维可视化超出边框
**问题**：PCA 散点图超出了 Card 容器。
**解决方案**：
- 类似于 MAE 图表的处理方式：
    - 给 `Card` 添加 `overflow: 'hidden'`。
    - 给 `Scatter` 图表外层包裹一个固定高度的 `div` (例如 `height: 400px`)。
    - 调整 `Scatter` 的 `appendPadding` 确保坐标轴标签不被截断。

## 实施步骤
1.  **修改 `renderClassificationSection`、`renderRegressionSection`、`renderClusteringSection`**：
    -   更新 `params` 列的 `render` 函数：给内部 `div` 添加 `style={{ width: 150, overflowX: 'auto', paddingBottom: 4 }}`，强制限制宽度并允许滑动。
2.  **修改 `renderClusteringSection`**：
    -   计算 `bestSilhouette` 和 `bestCH`。
    -   更新表格列 `render` 函数，添加高亮逻辑。
    -   更新 PCA 图表的容器样式，确保不溢出。

## 验证计划
- 完成修改后，我将启动前端开发服务器 (如果环境允许) 或建议您运行 `npm run dev` 来实际查看效果：
    1.  检查参数列是否严格限制在设定的宽度内。
    2.  检查聚类表格是否显示红色加粗的最优值。
    3.  检查 PCA 图表是否完整显示在 Card 内无溢出。
