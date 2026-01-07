# 后端修复与数据质量增强计划

针对您提出的三个问题，我制定了以下修复和优化计划：

## 1. 修复后端 500 错误 (AttributeError: 'RunRequest' object has no attribute 'preprocessing')

*   **问题原因**: 后端 `RunRequest` Pydantic 模型定义中缺少 `preprocessing` 字段，但前端传递了这个字段，导致在 `api/workflow.py` 中访问 `request.preprocessing` 时报错。
*   **修复方案**: 在 `backend/app/api/workflow.py` 的 `RunRequest` 类中添加 `preprocessing: List[dict] = []` 字段。

## 2. Label 列处理增强 (禁止缺失值 & 禁止预处理)

*   **数据管理限制**:
    *   在 `set_label` 接口 (`DataService`) 中增加检查：如果选定的 label 列存在缺失值，抛出异常，提示用户先处理缺失值。
*   **预处理逻辑增强**:
    *   在 `MLService.preprocess_data` 方法中，在执行任何预处理步骤前，先从 `meta` 中获取 `label_column`。
    *   在应用预处理（如均值填充、标准化）时，显式地从目标列列表中**排除** Label 列。这样可以防止 Label 被意外修改（例如被标准化为小数，导致分类算法报错）。

## 3. 完善算法参数配置 (ModelParamsForm)

*   **问题现状**: 您提到点击算法节点右侧参数面板空白。经检查 `ModelParamsForm.tsx`，目前只实现了 `逻辑回归`, `决策树`, `随机森林`, `K-Means` 的参数。如果您使用了其他算法（如 SVM, KNN, XGBoost 等），则会显示为空。
*   **优化方案**:
    *   检查并完善所有 10 大算法的参数配置界面。
    *   如果 `label` 不匹配任何已知 case，显示一个通用的 "暂无参数配置" 提示，而不是空白。
    *   确保 `PropertyPanel` 正确传递了 `data.label` 给 `ModelParamsForm`。

## 执行步骤

1.  **后端修复**: 修改 `backend/app/api/workflow.py`，更新 `RunRequest` 模型。
2.  **后端增强**: 修改 `backend/app/services/data_service.py` 的 `set_label` 方法，增加缺失值检查。
3.  **后端增强**: 修改 `backend/app/services/ml_service.py` 的 `preprocess_data` 方法，排除 label 列。
4.  **前端完善**: 检查 `ModelParamsForm.tsx`，确保所有支持的算法都有对应的配置表单（至少覆盖当前已实现的算法）。

请确认此计划。