import React from 'react';
import { Collapse, Typography } from 'antd';
import { 
  DatabaseOutlined, 
  ExperimentOutlined, 
  BarChartOutlined, 
  ToolOutlined 
} from '@ant-design/icons';

const { Panel } = Collapse;

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, category: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.setData('application/category', category);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeCategories = [
    {
      title: '数据输入',
      key: 'input',
      icon: <DatabaseOutlined />,
      items: [
        { type: 'dataNode', label: '文件输入', category: 'Data' },
      ]
    },
    {
      title: '数据预处理',
      key: 'preprocessing',
      icon: <ToolOutlined />,
      items: [
        { type: 'algoNode', label: '缺失值处理', category: 'Preprocessing' },
        { type: 'algoNode', label: '标准化', category: 'Preprocessing' },
        // { type: 'algoNode', label: '特征选择', category: 'Preprocessing' },
      ]
    },
    {
      title: '分类算法',
      key: 'classification',
      icon: <ExperimentOutlined />,
      items: [
        { type: 'algoNode', label: '逻辑回归', category: 'Model' },
        { type: 'algoNode', label: '决策树', category: 'Model' },
        { type: 'algoNode', label: '随机森林', category: 'Model' },
        { type: 'algoNode', label: 'XGBoost', category: 'Model' },
        { type: 'algoNode', label: 'LightGBM', category: 'Model' },
        { type: 'algoNode', label: '支持向量机 SVM', category: 'Model' },
        { type: 'algoNode', label: 'KNN', category: 'Model' },
      ]
    },
    {
      title: '回归算法',
      key: 'regression',
      icon: <ExperimentOutlined />,
      items: [
        { type: 'algoNode', label: '线性回归', category: 'Model' },
        { type: 'algoNode', label: '岭回归', category: 'Model' },
        { type: 'algoNode', label: 'Lasso', category: 'Model' },
        { type: 'algoNode', label: '随机森林回归', category: 'Model' },
        { type: 'algoNode', label: 'GBDT回归', category: 'Model' },
      ]
    },
    {
      title: '聚类算法',
      key: 'clustering',
      icon: <ExperimentOutlined />,
      items: [
        { type: 'algoNode', label: 'K-Means', category: 'Model' },
        { type: 'algoNode', label: 'DBSCAN', category: 'Model' },
      ]
    },
    {
      title: '模型评估',
      key: 'evaluation',
      icon: <BarChartOutlined />,
      items: [
        { type: 'evalNode', label: '模型评估', category: 'Evaluation' },
      ]
    }
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
            <Typography.Title level={5} style={{ margin: 0 }}>组件库</Typography.Title>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
            <Collapse defaultActiveKey={['input', 'preprocessing', 'algorithm', 'evaluation']} ghost expandIconPosition="end">
                {nodeCategories.map(cat => (
                    <Panel header={<span>{cat.icon} <span style={{ marginLeft: 8 }}>{cat.title}</span></span>} key={cat.key}>
                        {cat.items.map((node, index) => (
                            <div
                                key={index}
                                onDragStart={(event) => onDragStart(event, node.type, node.label, node.category)}
                                draggable
                                style={{
                                    border: '1px solid #d9d9d9',
                                    padding: '8px 12px',
                                    marginBottom: '8px',
                                    borderRadius: '6px',
                                    cursor: 'grab',
                                    backgroundColor: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '13px',
                                    transition: 'all 0.3s'
                                }}
                                className="sidebar-node"
                            >
                                {node.label}
                            </div>
                        ))}
                    </Panel>
                ))}
            </Collapse>
        </div>
    </div>
  );
};

export default Sidebar;
