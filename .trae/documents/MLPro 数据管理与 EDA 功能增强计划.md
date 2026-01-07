# MLPro 数据管理功能完善计划

本计划旨在完善数据管理模块，增加数据集划分、EDA 分析、Label 识别与管理功能，以支持更专业的机器学习流程。

## 1. 后端开发 (Backend)

### 1.1 数据元数据管理
*   **目标**: 为每个上传的数据文件维护元数据（Label 信息、特征类型、EDA 统计结果）。
*   **实现**: 采用 `.meta.json` 伴生文件方案。每当 `data.csv` 上传或生成时，创建 `data.csv.meta.json`。
*   **数据结构**:
    ```json
    {
      "filename": "data.csv",
      "is_train": true,
      "label_column": "target",  // null for unsupervised
      "columns": {
        "age": {"type": "numeric", "missing": 0, "outliers": 2},
        "gender": {"type": "category", "missing": 5, "outliers": 0}
      },
      "created_at": "..."
    }
    ```

### 1.2 增强数据 API (`app/api/data.py` & `app/services/data_service.py`)
*   **EDA 分析接口** (`POST /api/data/analyze/{filename}`):
    *   **特征类型识别**: 自动推断数值 (Numeric)、类别 (Category)、时间 (Datetime)。
    *   **数据质量**: 计算缺失值分布、基于 IQR 的离群点检测。
    *   **自动 Label 推荐**: 简单的启发式规则（如列名为 target/label，或最后一列）。
*   **数据集划分接口** (`POST /api/data/split`):
    *   **参数**: 源文件名、划分比例 (Train/Test/Val)、策略 (随机/分层)、分层列。
    *   **逻辑**: 使用 `sklearn.model_selection.train_test_split` 切分数据，并保存为新文件（如 `data_train.csv`），同时继承或更新元数据。
*   **Label 设置接口** (`POST /api/data/label`):
    *   用户手动指定或确认 Label 列，更新元数据。

## 2. 前端开发 (Frontend)

### 2.1 数据导入页面重构 (`src/pages/DataImport.tsx`)
*   **分区上传**:
    *   **训练集区域** (必选): 支持上传、预览、EDA、划分。
    *   **测试集区域** (可选): 支持上传单独的测试集。
*   **数据详情与 EDA 面板**:
    *   展示字段列表及其 EDA 指标（类型、缺失值、离群点）。
    *   **Label 管理**:
        *   列名高亮显示（红色 Tag）。
        *   操作栏提供“设为标签”按钮。
        *   顶部提示：当前检测到 Label 为 `xxx` 或 “未设置（无监督模式）”。
*   **数据集划分交互**:
    *   添加“数据集划分”按钮，弹出 Modal。
    *   **功能**:
        *   比例滑块 (例如 70% 训练, 15% 验证, 15% 测试)。
        *   划分方式切换 (随机 / 分层)。
        *   分层列选择器 (仅当选择分层时显示，默认选中类别列)。

## 3. 算法与工作流适配 (`src/pages/Workflow.tsx`)
*   **约束检查**:
    *   在运行工作流前，检查算法节点类型与数据节点 Label 状态的兼容性。
    *   若数据无 Label 但选择了监督学习算法（如逻辑回归），提示错误。

## 4. 任务清单
1.  **Backend**: 创建 `DataService`，实现 EDA 分析与 Label 推荐逻辑。
2.  **Backend**: 实现数据集划分 (`split_data`) 接口。
3.  **Frontend**: 重构 `DataImport` 页面，增加 EDA 表格展示与 Label 设置功能。
4.  **Frontend**: 实现数据集划分 Modal 组件。
5.  **Integration**: 联调前后端，确保 Label 信息正确流转。
