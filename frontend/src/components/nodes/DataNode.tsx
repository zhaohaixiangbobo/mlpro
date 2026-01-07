import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Select, Card, Button, Tooltip, Tag } from 'antd';
import { ReloadOutlined, DeleteOutlined, FileExcelOutlined, DatabaseOutlined } from '@ant-design/icons';
import { listFiles } from '../../services/api';

const DataNode: React.FC<NodeProps> = ({ data, id, selected }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(data.filename || null);

  const fetchFiles = () => {
    listFiles().then(res => {
        const fileList = res.files || [];
        setFiles(fileList);
    }).catch(err => {
        console.error("Failed to list files in DataNode:", err);
    });
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
      if (data.filename) {
          setSelectedFile(data.filename);
      }
  }, [data.filename]);

  const handleChange = (value: string) => {
    setSelectedFile(value);
    data.onChange(id, { ...data, filename: value });
  };

  return (
    <Card 
        size="small" 
        title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><DatabaseOutlined style={{ marginRight: 6, color: '#1890ff' }} /> 数据输入</span>
                <div style={{ display: 'flex' }}>
                    <Tooltip title="刷新">
                        <Button type="text" icon={<ReloadOutlined />} size="small" onClick={fetchFiles} />
                    </Tooltip>
                    {data.onDelete && (
                         <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => data.onDelete(id)} className="nodrag" />
                    )}
                </div>
            </div>
        } 
        style={{ 
            width: 240, 
            border: selected ? '2px solid #1890ff' : '1px solid #d9d9d9',
            borderRadius: '8px',
            boxShadow: selected ? '0 0 10px rgba(24, 144, 255, 0.3)' : '0 2px 5px rgba(0,0,0,0.05)'
        }}
        headStyle={{ background: '#e6f7ff', borderBottom: '1px solid #bae7ff', borderRadius: '8px 8px 0 0' }}
    >
      <div className="nodrag" style={{ padding: '4px 0' }}>
        <Select 
            style={{ width: '100%' }} 
            placeholder="选择数据源文件" 
            value={selectedFile}
            onChange={handleChange}
            onDropdownVisibleChange={(open) => open && fetchFiles()}
            getPopupContainer={triggerNode => triggerNode.parentNode}
            suffixIcon={<FileExcelOutlined />}
        >
            {files.map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
        </Select>
        {selectedFile && (
             <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
                 类型: <Tag color="blue">{selectedFile.split('.').pop()?.toUpperCase() || 'FILE'}</Tag>
             </div>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: '#1890ff', width: 10, height: 10 }}
      />
    </Card>
  );
};

export default DataNode;
