# 机器学习平台 (MLPro) 开发计划

## 1. 项目初始化

* [ ] 创建项目根目录结构

* [ ] **Backend**: 初始化 Python FastAPI 项目

  * 依赖管理 (`requirements.txt`)

  * 基础目录结构 (`app/`, `api/`, `core/`, `services/`)

* [ ] **Frontend**: 初始化 React + TypeScript 项目（非vite)

  * 安装核心依赖 (Ant Design, React Flow, Axios)

  * 基础目录结构 (`src/components`, `src/pages`, `src/store`)

    <br />

## 2. 核心功能实现 (MVP)

### 2.1 数据管理

* [ ] **后端**: 实现文件上传接口 (支持 .csv, .xlsx)

* [ ] **后端**: 实现简单的数据预览与统计 (Pandas)

* [ ] **前端**: 数据上传页面与预览表格

### 2.2 可视化工作流 (Vibe Coding 核心)

* [ ] **前端**: 集成 React Flow，实现画布与拖拽框架

* [ ] **前端**: 定义基础节点类型 (数据输入, 算法, 评估)

* [ ] **后端**: 定义 Pipeline 数据结构与解析逻辑

### 2.3 算法与执行引擎

* [ ] **后端**: 封装 Scikit-learn 基础算法 (如 逻辑回归, 决策树)

* [ ] **后端**: 实现 Pipeline 执行引擎 (按顺序执行节点)

* [ ] **前端**: 触发运行与状态显示

## 3. 可视化与报告

* [ ] **前端**: 集成 ECharts/Ant Design Charts 展示结果

* [ ] **后端**: 生成评估指标 (Accuracy, ROC, etc.)

## 4. 文档与规范

* [ ] 更新 README.md

* [ ] 添加代码注释

