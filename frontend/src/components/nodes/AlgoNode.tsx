import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Card, Button, Tag, Space, Typography } from 'antd';
import { 
    DeleteOutlined, 
    ExperimentOutlined, 
    ToolOutlined
} from '@ant-design/icons';
// 1. Ant Design 组件
import { Tooltip } from 'antd';
// 2. Ant Design 图标
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AlgoNode: React.FC<NodeProps> = ({ data, id, selected }) => {
  const category = data.category || 'Model';

  // Styles based on category
  let headerColor = '#f9f0ff';
  let borderColor = '#722ed1';
  let icon = <ExperimentOutlined />;
  let tagColor = 'purple';

  if (category === 'Preprocessing') {
      headerColor = '#fff7e6';
      borderColor = '#fa8c16';
      icon = <ToolOutlined />;
      tagColor = 'orange';
  } else if (category === 'Evaluation') {
      headerColor = '#fff1f0';
      borderColor = '#f5222d';
      tagColor = 'red';
  }

  // Active status color
  const statusColor = data.status === '成功' ? '#52c41a' : (data.status === '运行中' ? '#1890ff' : '#d9d9d9');

  return (
    <Card 
        size="small" 
        title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                    <span style={{ color: borderColor }}>{icon}</span>
                    <span>{data.label}</span>
                </Space>
                {data.onDelete && (
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        size="small" 
                        onClick={() => data.onDelete(id)} 
                        className="nodrag"
                    />
                )}
            </div>
        }
        style={{ 
            width: 200, 
            border: selected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
            borderRadius: '8px',
            boxShadow: selected ? `0 0 10px ${borderColor}40` : '0 2px 5px rgba(0,0,0,0.05)'
        }}
        headStyle={{ background: headerColor, borderBottom: `1px solid ${borderColor}40`, borderRadius: '8px 8px 0 0' }}
    >
      <div style={{ marginBottom: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>类型</Text>
                <Tag color={tagColor} style={{ marginRight: 0, fontSize: 10, lineHeight: '18px' }}>{category}</Tag>
            </div>
            
            {/* Show params placeholder for Model */}
            {category === 'Model'  || category === 'Preprocessing'  && (
                <div style={{ background: '#f5f5f5', padding: 4, borderRadius: 4, fontSize: 11, color: '#666' }}>
                    <div>params: {data.params ? Object.keys(data.params).length + ' configured' : 'default'}</div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: statusColor, fontSize: 12, display: 'flex', alignItems: 'center', marginRight: data.error ? 4 : 0 }}>
                        {data.status || '待运行'}
                    </span>
                    {data.status === '失败' && data.error && (
                        <Tooltip title={data.error}>
                            <InfoCircleOutlined style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 12 }} />
                        </Tooltip>
                    )}
                </div>
            </div>
            
            {/* Explicitly show error message for better visibility */}
            {data.status === '失败' && data.error && (
                <div style={{ marginTop: 4, padding: 4, background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                    <Text type="danger" style={{ fontSize: 10, display: 'block', wordBreak: 'break-all' }}>
                        {data.error}
                    </Text>
                </div>
            )}
          </Space>
      </div>
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: borderColor, width: 8, height: 8 }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: borderColor, width: 8, height: 8 }}
      />
    </Card>
  );
};

export default AlgoNode;
