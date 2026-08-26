import React, { useState, useEffect } from 'react';
import { Upload, Button, Table, Card, Row, Col, Statistic, message, Tag, Tooltip, Space, Popconfirm, Select, Dropdown, Modal, Segmented } from 'antd';
import { UploadOutlined, ScissorOutlined, TagOutlined, DeleteOutlined, DownloadOutlined, ExperimentOutlined, DeleteRowOutlined } from '@ant-design/icons';
import { uploadData, getPreview, listFiles, setLabel, deleteFile, downloadFile, deleteRows, loadDemoData } from '../services/api';
import SplitModal from '../components/SplitModal';

const ENCODING_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030' },
  { value: 'gbk', label: 'GBK' },
  { value: 'latin-1', label: 'Latin-1' },
];

const DELIMITER_OPTIONS = [
  { value: ',', label: '逗号 (,)' },
  { value: '\t', label: '制表符 (Tab)' },
  { value: ';', label: '分号 (;)' },
  { value: ' ', label: '空格 ( )' },
];

const DEMO_OPTIONS = [
  { key: 'iris', label: '鸢尾花分类 (Iris)' },
  { key: 'wine', label: '葡萄酒分类 (Wine)' },
  { key: 'diabetes', label: '糖尿病回归 (Diabetes)' },
];

const DataImport: React.FC = () => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [fileFilter, setFileFilter] = useState<'all' | 'source' | 'derived'>('all');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Upload options
  const [encoding, setEncoding] = useState('auto');
  const [delimiter, setDelimiter] = useState(',');

  // Preview pagination
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [deletingRows, setDeletingRows] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const res = await listFiles();
      if (res.files) {
          setFileList(res.files);
          if (res.files.length > 0 && !currentFile) {
              handlePreview(res.files[0].filename, 1, 20);
          }
      }
    } catch (_) {
      console.error("load files error");
    }
  };

  // 文件角色元信息（角色 → 展示文案/颜色）
  const ROLE_META: Record<string, { label: string; color: string }> = {
    source: { label: '原始数据', color: 'blue' },
    train: { label: '训练集', color: 'orange' },
    test: { label: '测试集', color: 'orange' },
    validation: { label: '验证集', color: 'orange' },
    auto_test: { label: '自动测试集', color: 'green' },
    prediction: { label: '预测结果', color: 'purple' },
  };

  const filteredFiles = fileFilter === 'all'
    ? fileList
    : fileFilter === 'source'
      ? fileList.filter((f: any) => f.role === 'source')
      : fileList.filter((f: any) => f.role !== 'source');

  const currentFileMeta = fileList.find((f: any) => f.filename === currentFile);
  const isDerivedCurrent = !!currentFileMeta && currentFileMeta.role !== 'source';

  const handleCleanupDerived = async () => {
    const derived = fileList.filter((f: any) => f.role !== 'source');
    if (derived.length === 0) {
      message.info("没有可清理的派生文件");
      return;
    }
    setLoading(true);
    let ok = 0;
    for (const f of derived) {
      try {
        await deleteFile(f.filename);
        ok++;
      } catch (_) { /* ignore */ }
    }
    setLoading(false);
    message.success(`已清理 ${ok}/${derived.length} 个派生文件`);
    if (currentFile && derived.some((f: any) => f.filename === currentFile)) {
      setCurrentFile(null);
      setPreviewData([]);
      setMeta(null);
    }
    loadFiles();
  };

  const fetchPreview = async (filename: string, page: number, size: number) => {
    const res = await getPreview(filename, page, size);
    setPreviewData(res.preview.map((r: any, i: number) => ({ ...r, __idx: (page - 1) * size + i })));
    setPreviewTotal(res.total);
    return res;
  };

  const handlePreview = async (filename: string, page: number = 1, size: number = 20) => {
    try {
      setLoading(true);
      setCurrentFile(filename);
      setPreviewPage(page);
      setPreviewPageSize(size);
      setSelectedRowKeys([]);
      const res = await fetchPreview(filename, page, size);

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

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      setLoading(true);
      const res = await uploadData(file, encoding, delimiter);
      message.success(`${file.name} 上传成功 (${res.encoding || 'auto'})`);
      onSuccess("ok");
      loadFiles();
      handlePreview(file.name, 1, 20);
    } catch (err) {
      message.error(`${file.name} 上传失败。请检查编码/分隔符设置是否正确`);
      onError(err);
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

  const handleDeleteRows = async () => {
      if (!currentFile || selectedRowKeys.length === 0) return;
      Modal.confirm({
          title: `确认删除选中的 ${selectedRowKeys.length} 行数据？`,
          content: '删除后不可恢复（会同时更新该文件的行数统计）。',
          okText: '删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: async () => {
              try {
                  setDeletingRows(true);
                  const res = await deleteRows(currentFile, selectedRowKeys);
                  message.success(`已删除 ${res.deleted} 行数据`);
                  setSelectedRowKeys([]);
                  // Clamp page if we deleted past the end
                  const maxPage = Math.max(1, Math.ceil((previewTotal - res.deleted) / previewPageSize));
                  const nextPage = Math.min(previewPage, maxPage);
                  await handlePreview(currentFile, nextPage, previewPageSize);
              } catch (error: any) {
                  message.error(error?.response?.data?.detail || "删除行失败");
              } finally {
                  setDeletingRows(false);
              }
          },
      });
  };

  const handleDemoData = async ({ key }: { key: string }) => {
      setDemoLoading(true);
      try {
          const res = await loadDemoData(key);
          message.success(`示例数据已加载: ${res.filename}`);
          loadFiles();
          handlePreview(res.filename, 1, 20);
      } catch (error: any) {
          message.error(error?.response?.data?.detail || "示例数据加载失败");
      } finally {
          setDemoLoading(false);
      }
  };

  const uploadProps = {
    customRequest: handleUpload,
    showUploadList: false,
  };

  const demoMenu = {
      items: DEMO_OPTIONS,
      onClick: handleDemoData,
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
                disabled={meta?.label_column === record.name || isDerivedCurrent}
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
          <Card title="文件列表">
            <Space style={{ width: '100%', marginBottom: 12 }} wrap size={[8, 8]}>
              <Upload {...uploadProps}><Button icon={<UploadOutlined />} size="small">上传</Button></Upload>
              <Dropdown menu={demoMenu} disabled={demoLoading}>
                <Button icon={<ExperimentOutlined />} loading={demoLoading} size="small">示例数据</Button>
              </Dropdown>
              <Select
                  value={encoding}
                  onChange={setEncoding}
                  style={{ width: 104 }}
                  size="small"
                  options={ENCODING_OPTIONS}
              />
              <Select
                  value={delimiter}
                  onChange={setDelimiter}
                  style={{ width: 120 }}
                  size="small"
                  options={DELIMITER_OPTIONS}
              />
            </Space>
            <Space style={{ width: '100%', marginBottom: 8 }} wrap size={[8, 8]}>
              <Segmented
                  size="small"
                  value={fileFilter}
                  onChange={(v) => setFileFilter(v as any)}
                  options={[
                      { label: '全部', value: 'all' },
                      { label: '原始数据', value: 'source' },
                      { label: '派生文件', value: 'derived' },
                  ]}
              />
              <Popconfirm
                  title="确定清理所有派生文件吗？(划分文件/自动测试集/预测结果，保留原始数据)"
                  onConfirm={handleCleanupDerived}
                  okText="确定"
                  cancelText="取消"
              >
                  <Button size="small" danger icon={<DeleteOutlined />} loading={loading}>清理派生文件</Button>
              </Popconfirm>
            </Space>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>上传 CSV 时生效：编码 &amp; 分隔符</div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredFiles.map((f: any) => {
                    const info = ROLE_META[f.role] || { label: f.role || '原始数据', color: 'default' };
                    return (
                        <div
                            key={f.filename}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                background: currentFile === f.filename ? '#e6f7ff' : 'transparent',
                                borderBottom: '1px solid #f0f0f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            onClick={() => handlePreview(f.filename)}
                        >
                            <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Tag color={info.color} style={{ marginRight: 6, flexShrink: 0, lineHeight: '18px' }}>{info.label}</Tag>
                                    <Tooltip title={f.parent ? `由 ${f.parent} 生成` : '原始上传文件'}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
                                    </Tooltip>
                                </div>
                                {f.parent && <div style={{ fontSize: 11, color: '#999', marginTop: 2, paddingLeft: 2 }}>来源: {f.parent}</div>}
                            </div>
                            <div style={{ display: 'flex' }}>
                                <Tooltip title="下载文件">
                                    <Button
                                        type="text"
                                        icon={<DownloadOutlined />}
                                        size="small"
                                        onClick={(e) => handleDownload(e, f.filename)}
                                        style={{ marginRight: 4 }}
                                    />
                                </Tooltip>
                                <Popconfirm
                                    title="确定删除此文件及其衍生数据集吗?"
                                    onConfirm={(e) => handleDelete(e as any, f.filename)}
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
                    );
                })}
            </div>
          </Card>
        </Col>

        <Col span={16}>
            {currentFile && (
                <Card
                title={<Tooltip title={currentFile}><span style={{ display: 'inline-block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>当前文件: {currentFile}</span></Tooltip>}
                extra={
                    <Space>
                        <Tooltip title={isDerivedCurrent ? '派生文件不支持再次划分' : undefined}>
                            <Button icon={<ScissorOutlined />} onClick={() => setSplitModalVisible(true)} disabled={isDerivedCurrent}>数据集划分</Button>
                        </Tooltip>
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
            <Card
                title={`数据预览`}
                extra={
                    <Space wrap size={[8, 8]}>
                        <span style={{ color: '#999' }}>共 {previewTotal} 行</span>
                        <Button
                            icon={<DeleteRowOutlined />}
                            danger
                            disabled={selectedRowKeys.length === 0 || deletingRows}
                            loading={deletingRows}
                            onClick={handleDeleteRows}
                        >
                            删除选中 ({selectedRowKeys.length})
                        </Button>
                    </Space>
                }
            >
                <Table
                    dataSource={previewData}
                    columns={columns}
                    rowKey="__idx"
                    scroll={{ x: true }}
                    loading={loading}
                    size="small"
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys as number[]),
                    }}
                    pagination={{
                        current: previewPage,
                        pageSize: previewPageSize,
                        total: previewTotal,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        onChange: (page, size) => { handlePreview(currentFile, page, size); },
                        onShowSizeChange: (page, size) => { handlePreview(currentFile, page, size); },
                    }}
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
