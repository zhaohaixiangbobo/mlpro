import React, { useState, useEffect } from 'react';
import { Upload, Button, Table, Card, Row, Col, Statistic, message, Tag, Tooltip, Space, Popconfirm } from 'antd';
import { UploadOutlined, ScissorOutlined, TagOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { uploadData, getPreview, listFiles, setLabel, deleteFile, downloadFile } from '../services/api';
import SplitModal from '../components/SplitModal';

const DataImport: React.FC = () => {
  const [fileList, setFileList] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const res = await listFiles();
      if (res.files) {
          setFileList(res.files);
          if (res.files.length > 0 && !currentFile) {
              handlePreview(res.files[0]);
          }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setLoading(true);
      await uploadData(file);
      message.success(`${file.name} uploaded successfully`);
      onSuccess("ok");
      loadFiles();
      handlePreview(file.name);
    } catch (err) {
      message.error(`${file.name} upload failed.`);
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (filename: string) => {
    try {
      setLoading(true);
      setCurrentFile(filename);
      const res = await getPreview(filename, 1, 5);
      setPreviewData(res.preview);
      
      // Process columns to highlight Label
      const processedCols = res.columns.map((col: any) => {
          if (col.dataIndex === res.meta.label_column) {
              return {
                  ...col,
                  render: (text: any) => <span style={{ fontWeight: 'bold', color: 'red' }}>{text}</span>,
                  title: <span style={{ color: 'red' }}>{col.title} (Label)</span>,
                  className: 'label-column-cell'
              };
          }
          return col;
      });
      
      setColumns(processedCols);
      setMeta(res.meta);
    } catch (error) {
      message.error("Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, filename: string) => {
      e.stopPropagation(); // Prevent triggering row selection
      try {
          await deleteFile(filename);
          message.success(`已删除文件: ${filename}`);
          if (currentFile === filename) {
              setCurrentFile(null);
              setPreviewData([]);
              setMeta(null);
          }
          loadFiles();
      } catch (error) {
          message.error("删除失败");
      }
  };

  const handleDownload = async (e: React.MouseEvent, filename: string) => {
      e.stopPropagation();
      try {
          await downloadFile(filename);
          message.success(`开始下载: ${filename}`);
      } catch (error) {
          message.error("下载失败");
      }
  };

  const handleSetLabel = async (colName: string) => {
      if (!currentFile) return;
      try {
          const res = await setLabel(currentFile, colName);
          setMeta(res.meta);
          message.success(`Label 设置为: ${colName}`);
      } catch (error) {
          message.error("设置 Label 失败");
      }
  };
  
  const handleUnsetLabel = async () => {
      if (!currentFile) return;
      try {
          const res = await setLabel(currentFile, null);
          setMeta(res.meta);
          message.success("已清除 Label (无监督模式)");
      } catch (error) {
          message.error("设置失败");
      }
  };

  const uploadProps = {
    customRequest: handleUpload,
    showUploadList: false,
  };

  // Generate columns for EDA Table
  const edaColumns = [
      { title: '列名', dataIndex: 'name', key: 'name', 
        render: (text: string) => (
            <span>
                {text} 
                {meta?.label_column === text && <Tag color="red" style={{marginLeft: 8}}>LABEL</Tag>}
            </span>
        )
      },
      { title: '类型', dataIndex: 'type', key: 'type', 
        render: (type: string) => <Tag color={type === 'numeric' ? 'blue' : type === 'category' ? 'green' : 'orange'}>{type}</Tag> 
      },
      { title: '缺失值', dataIndex: 'missing', key: 'missing',
        render: (val: number, record: any) => <span>{val} ({record.missing_pct}%)</span>
      },
      { title: '离群点', dataIndex: 'outliers', key: 'outliers' },
      { title: '唯一值', dataIndex: 'unique', key: 'unique' },
      { title: '操作', key: 'action', 
        render: (_: any, record: any) => (
            <Button 
                size="small" 
                type={meta?.label_column === record.name ? 'primary' : 'default'}
                icon={<TagOutlined />}
                onClick={() => handleSetLabel(record.name)}
                disabled={meta?.label_column === record.name}
            >
                {meta?.label_column === record.name ? '当前标签' : '设为标签'}
            </Button>
        )
      }
  ];

  const edaDataSource = meta?.columns ? Object.entries(meta.columns).map(([key, val]: [string, any]) => ({
      name: key,
      ...val
  })) : [];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="文件列表" extra={<Upload {...uploadProps}><Button icon={<UploadOutlined />}>上传</Button></Upload>}>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {fileList.map(f => (
                    <div 
                        key={f} 
                        style={{ 
                            padding: '8px', 
                            cursor: 'pointer', 
                            background: currentFile === f ? '#e6f7ff' : 'transparent',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                        onClick={() => handlePreview(f)}
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8, flex: 1 }}>{f}</span>
                        <div style={{ display: 'flex' }}>
                            <Tooltip title="下载文件">
                                <Button 
                                    type="text" 
                                    icon={<DownloadOutlined />} 
                                    size="small"
                                    onClick={(e) => handleDownload(e, f)}
                                    style={{ marginRight: 4 }}
                                />
                            </Tooltip>
                            <Popconfirm
                                title="确定删除此文件及其衍生数据集吗?"
                                onConfirm={(e) => handleDelete(e as any, f)}
                                onCancel={(e) => e?.stopPropagation()}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    size="small"
                                    onClick={(e) => e.stopPropagation()} 
                                />
                            </Popconfirm>
                        </div>
                    </div>
                ))}
            </div>
          </Card>
        </Col>
        
        <Col span={16}>
            {currentFile && (
                <Card 
                    title={<span>当前文件: {currentFile}</span>}
                    extra={
                        <Space>
                            <Button icon={<ScissorOutlined />} onClick={() => setSplitModalVisible(true)}>数据集划分</Button>
                        </Space>
                    }
                >
                     {meta && (
                        <div style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={8}><Statistic title="总行数" value={meta.rows} /></Col>
                                <Col span={16}>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                        <span style={{ marginRight: 8, fontSize: 16, color: '#666' }}>当前模式:</span>
                                        {meta.label_column ? (
                                            <Tag color="red" style={{ fontSize: 16, padding: '4px 10px' }}>
                                                监督学习 (Label: {meta.label_column})
                                            </Tag>
                                        ) : (
                                            <Tag color="geekblue" style={{ fontSize: 16, padding: '4px 10px' }}>
                                                无监督学习 (无 Label)
                                            </Tag>
                                        )}
                                        {meta.label_column && (
                                            <Button size="small" type="link" onClick={handleUnsetLabel}>清除</Button>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    )}
                    
                    <h3>数据概览 (EDA)</h3>
                    <Table 
                        dataSource={edaDataSource} 
                        columns={edaColumns} 
                        pagination={false} 
                        size="small"
                        rowKey="name"
                        scroll={{ y: 300 }}
                    />
                </Card>
            )}
        </Col>
      </Row>

      {currentFile && (
        <Row style={{ marginTop: 16 }}>
            <Col span={24}>
            <Card title="原始数据预览 (前5行)">
                <Table 
                    dataSource={previewData} 
                    columns={columns} 
                    rowKey={(_record, index) => index?.toString() || ""}
                    scroll={{ x: true }}
                    loading={loading}
                    pagination={false}
                    size="small"
                />
            </Card>
            </Col>
        </Row>
      )}

      {currentFile && (
          <SplitModal 
            visible={splitModalVisible}
            onCancel={() => setSplitModalVisible(false)}
            onSuccess={() => { loadFiles(); }}
            filename={currentFile}
            columns={columns.map(c => c.key)}
          />
      )}
    </div>
  );
};

export default DataImport;
