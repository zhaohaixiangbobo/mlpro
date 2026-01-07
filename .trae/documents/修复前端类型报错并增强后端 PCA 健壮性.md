# 修复 TS 类型错误与增强 PCA 稳定性

**问题汇总**:
1.  **Divider 类型错误**: Ant Design 的 `Divider` 组件在不同版本中 `orientation` 属性的类型定义可能有变（如从 string 变为枚举），导致 TS 报错。
2.  **PCA 功能失效**: 终端中的 Pydantic 警告 (`orm_mode` -> `from_attributes`) 是因为使用了 Pydantic V2 但代码仍用 V1 语法，但这只是警告。真正的 PCA 失败原因在后端逻辑不够健壮（如特征不足、数据全为空等）。

**实施计划**:

## 1. Frontend 修复 (`Dashboard.tsx`)
*   **修复类型错误**: 将 `<Divider orientation="left">` 修改为 `<Divider orientation="left" plain>` 或者简单地移除 `orientation` 属性（默认居中）。鉴于“算法详情报告”作为子标题，居中或左对齐皆可。为了彻底解决类型兼容性，我将尝试移除该属性或确认正确类型。
    *   *修正策略*: 直接移除 `orientation="left"`，因为 Ant Design 的类型定义有时会比较严格，默认样式（居中）是最安全的。或者使用行内样式替代。

## 2. Backend 修复 (`ml_service.py`)
*   **Pydantic 警告**: 虽然这不影响运行，但顺手修复它可以减少干扰。在 `ml_service.py` 或相关模型定义中，将 `orm_mode = True` 更新为 `from_attributes = True`。
*   **增强 PCA 逻辑**:
    *   **特征数量检查**: PCA 降维到 2 维至少需要 2 个特征。如果 `df_numeric.shape[1] < 2`，则无法进行 2D PCA。此时应直接返回空或降维到 1 维再补 0。
    *   **数据清洗**: 确保 `replace([np.inf, -np.inf], np.nan)` 执行在 `dropna` 之前。
    *   **错误捕获**: 在 `try-except` 中打印更详细的 traceback，以便在终端看到具体的 PCA 失败原因。

**代码变更预览 (Backend)**:
```python
# 检查特征数量
if df_numeric.shape[1] < 2:
    print("PCA Skipped: Not enough features (need >= 2)")
    return []

# Pydantic Config (如果在该文件有定义)
# class Config:
#     from_attributes = True
```
