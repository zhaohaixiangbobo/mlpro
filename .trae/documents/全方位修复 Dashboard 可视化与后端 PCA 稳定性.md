# 修复 PCA 错误与 Dashboard 样式/数据问题

**问题汇总**:
1.  **PCA 500 Error**: 后端处理数据时未过滤 `inf` 值或样本过少，导致崩溃。
2.  **雷达图样式**: 超出边框、颜色单一、不美观。
3.  **分类指标缺失**: 详情表中缺少 Recall 等指标。
4.  **表格样式**: 需要加粗最佳值。
5.  **Weighted F1 为 0**: 前端读取 JSON 键名错误 (`weighted_avg` vs `weighted avg`)。
6.  **回归图表**: 坐标轴反了，且应该用 MAE 更直观。

**实施计划**:

## 1. Backend 修复 (`ml_service.py`)
*   **增强 `get_pca_data`**:
    *   增加 `df.replace([np.inf, -np.inf], np.nan).dropna()` 处理异常值。
    *   增加样本量检查 (`len(df) < 2` 时返回空或抛出友好错误)。
    *   确保标签列与清洗后的数据索引对齐。

## 2. Frontend 修复 (`Dashboard.tsx`)

### 2.1 样式与布局优化
*   **雷达图 (`Radar`)**:
    *   **布局**: 调整 `padding` 或 `radius` 防止溢出。
    *   **颜色**: 显式设置 `color` 属性为不同颜色数组，区分不同算法。
    *   **区域填充**: 开启 `area` 配置，增加透明度，提升美观度。
*   **回归图表 (`Bar`)**:
    *   **指标更换**: 改用 **MAE** (Mean Absolute Error) 作为横轴（越小越好），因为 R2 接近 1 时差异不明显。
    *   **坐标轴**: 交换 x/y 轴配置，确保横向条形图符合直觉。
    *   **排序**: 按 MAE 升序排列（越短越好）。

### 2.2 数据展示修正
*   **键名修复**: 将所有 `weighted_avg` 替换为 `['weighted avg']`。
*   **表格增强**:
    *   在分类详情表中添加 `Precision`, `Recall` 列。
    *   **高亮最佳值**: 使用 `render` 函数，计算该列的最大值（或最小值），如果当前单元格等于最佳值，则加粗并标红。

### 2.3 细节调整
*   **PCA 散点图**: 确保 `Scatter` 图表配置了 `meta: { x: { nice: true }, y: { nice: true } }` 以自动调整坐标轴范围，防止点溢出。

**代码变更预览 (Frontend)**:
```typescript
// 修复 Weighted F1 读取
const weightedF1 = record.result.report?.['weighted avg']?.['f1-score'];

// 雷达图美化
<Radar
  // ...
  color={['#5B8FF9', '#5AD8A6', '#5D7092']} // 多色
  area={{ style: { fillOpacity: 0.2 } }}
/>
```
