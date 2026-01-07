# MLPro - 机器学习算法平台

## 项目简介
MLPro 是一个基于 React + FastAPI 的拖拉拽机器学习平台。支持数据导入、可视化建模、算法训练与评估。

## 功能特性
- **数据管理**: 
  - 支持 CSV/Excel 上传与预览，自动统计缺失值与数据分布。
  - 支持文件下载与删除，以及数据集的自动划分。
- **可视化工作流**: 
  - 基于 React Flow 的拖拽式建模。
  - 支持**自动加载**最近保存的工作流。
  - 丰富的节点类型：数据输入、预处理、机器学习模型、模型评估。
  - 专业的 UI 设计：不同类型节点拥有独立的视觉风格与图标标识。
- **算法集成**: 内置逻辑回归、决策树、K-Means、随机森林等经典算法 (Scikit-learn)。
  - 支持回归算法的 R2 Score、MAE 等多种评估指标。
  - 完善的参数校验与错误提示机制。
- **结果展示**: 
  - 实时查看模型准确率、混淆矩阵等评估指标。
  - 支持一键导出 **Word/PDF** 格式的算法分析报告，包含 EDA 统计、多模型性能对比图表（雷达图、柱状图）及详细指标数据。

## 技术栈
- **Frontend**: React, TypeScript, Vite, Ant Design, React Flow, Axios
- **Backend**: Python, FastAPI, Pandas, Scikit-learn

## 快速开始

### 1. 后端启动
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
后端服务运行在: http://localhost:8000

### 2. 前端启动
```bash
cd frontend
npm install
npm run dev
```
前端服务运行在: http://localhost:5173

## 目录结构
```
mlpro/
├── backend/            # FastAPI 后端
│   ├── app/
│   │   ├── api/        # 接口路由
│   │   ├── services/   # 业务逻辑 (ML算法)
│   │   └── main.py     # 入口文件
│   └── requirements.txt
├── frontend/           # React 前端
│   ├── src/
│   │   ├── components/ # 组件 (Nodes, Sidebar)
│   │   ├── pages/      # 页面 (DataImport, Workflow)
│   │   └── services/   # API 调用
└── README.md
```

## 最近更新 (Latest Updates)
- **报告导出功能**:
  - 新增 **Word/PDF 报告导出**：在“可视化结果”页面支持一键导出分析报告。
  - **内容丰富**：报告包含数据 EDA 统计表、多算法性能对比图（分类雷达图、回归/聚类柱状图）以及详细指标表格。
  - **聚类支持**：全面支持聚类模型（K-Means 等）的指标提取与可视化展示。
  - **中文支持**：内置中文字体处理，确保 PDF/Word 报告中文字符显示正常。
- **可视化增强**:
  - **PCA 降维可视化**: 增加 Tooltip 说明，明确点代表样本而非簇中心；优化颜色映射逻辑；增强后端对 NaN/Inf 数据的处理能力，防止 500 错误。
  - **回归评估图表**: 将横向条形图调整为**垂直柱状图 (Column Chart)**，修复坐标轴视觉体验，符合常规阅读习惯。
  - **分类评估优化**: 修复雷达图溢出与颜色单一问题；表格自动加粗高亮最佳指标；修复 Weighted F1 显示问题。
- **系统稳定性**:
  - 修复 Pydantic V2 `orm_mode` 兼容性警告。
  - 增强后端数据预处理与异常捕获机制。
