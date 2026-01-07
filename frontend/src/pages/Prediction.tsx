import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Upload, Table, message, Row, Col, Typography, Steps, Divider, Tooltip } from 'antd';
import { CloudUploadOutlined, RobotOutlined, DownloadOutlined } from '@ant-design/icons';
import { listWorkflows, loadWorkflow, listFiles, uploadData, predict, downloadPrediction, getPreview } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Workflow {
    name: string;
    updated_at: number;
}

interface AlgoNode {
    id: string;
    label: string;
    status: string;
    preprocessing?: any[];
}

const Prediction: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
    
    const [algorithms, setAlgorithms] = useState<AlgoNode[]>([]);
    const [selectedAlgoId, setSelectedAlgoId] = useState<string | null>(null);
    
    const [fileList, setFileList] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [predictionResult, setPredictionResult] = useState<any>(null);

    // New state for paginated results
    const [tableData, setTableData] = useState<any[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);
    const [tableTotal, setTableTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);
    const [dataLoading, setDataLoading] = useState<boolean>(false);
    const [currentFilename, setCurrentFilename] = useState<string | null>(null);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem('mlpro_prediction_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.selectedWorkflow) {
                    // Trigger workflow loading to populate algorithms
                    handleWorkflowChange(parsed.selectedWorkflow, parsed.selectedAlgoId);
                }
                if (parsed.selectedFile) setSelectedFile(parsed.selectedFile);
                if (parsed.predictionResult) {
                    setPredictionResult(parsed.predictionResult);
                    if (parsed.predictionResult.filename) {
                        setCurrentFilename(parsed.predictionResult.filename);
                    }
                }
            } catch (e) {
                console.error("Failed to load saved state", e);
            }
        }
    }, []);

    // Save state whenever it changes
    useEffect(() => {
        const state = {
            selectedWorkflow,
            selectedAlgoId,
            selectedFile,
            predictionResult
        };
        localStorage.setItem('mlpro_prediction_state', JSON.stringify(state));
    }, [selectedWorkflow, selectedAlgoId, selectedFile, predictionResult]);

    useEffect(() => {
        fetchWorkflows();
        fetchFiles();
    }, []);

    // Fetch table data when filename or pagination changes
    useEffect(() => {
        if (currentFilename) {
            fetchTableData(currentFilename, currentPage, pageSize);
        }
    }, [currentFilename, currentPage, pageSize]);

    const fetchTableData = async (filename: string, page: number, limit: number) => {
        setDataLoading(true);
        try {
            const res = await getPreview(filename, page, limit);
            setTableData(res.preview);
            setTableTotal(res.total);
            
            // Define columns with formatting
            const cols = (res.columns || []).map((colObj: any) => {
                const col = colObj.dataIndex;
                const isPred = col === 'prediction';
                
                return {
                    title: (
                        <Tooltip title={col}>
                            <span>{col}</span>
                        </Tooltip>
                    ),
                    dataIndex: col,
                    key: col,
                    width: isPred ? 120 : 100,
                    fixed: isPred ? 'right' : undefined,
                    ellipsis: true,
                    render: (text: any) => {
                        let val = text;
                        
                        if (text === null || text === undefined) {
                            val = '-';
                        } else if (isPred && typeof text === 'number') {
                            // Only round prediction to 4 decimal places
                            val = text.toFixed(4);
                        }
                        
                        return isPred ? <b style={{color: '#1890ff'}}>{val}</b> : val;
                    }
                };
            });
            setTableColumns(cols);
        } catch (error) {
            console.error(error);
            message.error("获取结果数据失败");
        } finally {
            setDataLoading(false);
        }
    };

    const fetchWorkflows = async () => {
        try {
            const res = await listWorkflows();
            if (res.workflows) {
                setWorkflows(res.workflows);
            }
        } catch (error) {
            message.error("获取工作流列表失败");
        }
    };

    const fetchFiles = async () => {
        try {
            const res = await listFiles();
            if (res.files) {
                setFileList(res.files);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleWorkflowChange = async (value: string, restoreAlgoId?: string) => {
        setSelectedWorkflow(value);
        if (!restoreAlgoId) {
            setSelectedAlgoId(null);
        }
        setAlgorithms([]);
        setLoading(true);
        try {
            const data = await loadWorkflow(value);
            // Parse nodes to find successful AlgoNodes
            const nodes = data.nodes || [];
            const edges = data.edges || [];
            
            // Helper to trace back preprocessing
            const getPreprocessing = (nodeId: string) => {
                const steps: any[] = [];
                let currentId = nodeId;
                let depth = 0;
                while (depth < 20) {
                    const edge = edges.find((e: any) => e.target === currentId);
                    if (!edge) break;
                    const sourceNode = nodes.find((n: any) => n.id === edge.source);
                    if (!sourceNode) break;
                    
                    if (sourceNode.data.category === 'Preprocessing') {
                        // Reconstruct step
                        let method = sourceNode.data.params?.method;
                        if (!method) {
                            if (sourceNode.data.label === '缺失值处理') method = 'mean';
                            else if (sourceNode.data.label === '标准化') method = 'standard';
                            else if (sourceNode.data.label === '归一化') method = 'minmax';
                        }
                        steps.unshift({
                            method: method,
                            params: sourceNode.data.params || {}
                        });
                        currentId = sourceNode.id;
                    } else if (sourceNode.type === 'dataNode') {
                        break;
                    } else {
                        break;
                    }
                    depth++;
                }
                return steps;
            };

            const successAlgos = nodes
                .filter((n: any) => n.type === 'algoNode' && n.data.category === 'Model' && n.data.status === '成功')
                .map((n: any) => ({
                    id: n.id,
                    label: n.data.label,
                    status: n.data.status,
                    preprocessing: getPreprocessing(n.id)
                }));
            
            setAlgorithms(successAlgos);
            
            // Restore algo id if provided and exists in list
            if (restoreAlgoId && successAlgos.find((a: any) => a.id === restoreAlgoId)) {
                setSelectedAlgoId(restoreAlgoId);
            }

            if (successAlgos.length === 0) {
                message.warning("该工作流中没有已训练成功的模型");
            }
        } catch (error) {
            message.error("加载工作流详情失败");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
            setLoading(true);
            await uploadData(file);
            message.success(`${file.name} 上传成功`);
            onSuccess("ok");
            fetchFiles();
            setSelectedFile(file.name);
        } catch (err) {
            message.error(`${file.name} 上传失败`);
            onError(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePredict = async () => {
        if (!selectedAlgoId || !selectedFile) {
            message.error("请选择模型和预测文件");
            return;
        }

        const algo = algorithms.find(a => a.id === selectedAlgoId);
        if (!algo) return;

        try {
            setLoading(true);
            const res = await predict({
                node_id: selectedAlgoId,
                data_file: selectedFile,
                preprocessing: algo.preprocessing || [],
                algorithm_label: algo.label
            });
            
            if (res.status === 'success') {
                message.success("预测成功");
                setPredictionResult(res.result);
                setCurrentFilename(res.result.filename);
                setCurrentPage(1); // Reset pagination
            }
        } catch (error: any) {
            const msg = error.response?.data?.detail || "预测失败";
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (predictionResult && predictionResult.filename) {
            try {
                await downloadPrediction(predictionResult.filename);
                message.success("开始下载");
            } catch (error) {
                message.error("下载失败");
            }
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <Title level={3}>模型预测</Title>
            <Text type="secondary">选择已训练的工作流模型，对新数据进行预测。</Text>
            
            <Divider />

            <Row gutter={[24, 24]}>
                <Col span={8}>
                    <Card title="配置预测任务" bordered={false} style={{ height: '100%' }}>
                        <Steps 
                            direction="vertical" 
                            current={-1}
                            items={[
                                {
                                    title: "选择工作流",
                                    description: (
                                        <Select 
                                            style={{ width: '100%', marginTop: 8 }} 
                                            placeholder="选择工作流"
                                            onChange={(val) => handleWorkflowChange(val)}
                                            value={selectedWorkflow}
                                        >
                                            {workflows.map(w => (
                                                <Option key={w.name} value={w.name}>{w.name}</Option>
                                            ))}
                                        </Select>
                                    )
                                },
                                {
                                    title: "选择模型",
                                    description: (
                                        <Select 
                                            style={{ width: '100%', marginTop: 8 }} 
                                            placeholder="选择已训练的模型"
                                            disabled={!selectedWorkflow}
                                            value={selectedAlgoId}
                                            onChange={setSelectedAlgoId}
                                        >
                                            {algorithms.map(a => (
                                                <Option key={a.id} value={a.id}>{a.label} ({a.id.split('_')[1]})</Option>
                                            ))}
                                        </Select>
                                    )
                                },
                                {
                                    title: "上传预测数据",
                                    description: (
                                        <div style={{ marginTop: 8 }}>
                                            <Select 
                                                style={{ width: '100%', marginBottom: 8 }} 
                                                placeholder="选择现有文件"
                                                value={selectedFile}
                                                onChange={setSelectedFile}
                                            >
                                                {fileList.map(f => (
                                                    <Option key={f} value={f}>{f}</Option>
                                                ))}
                                            </Select>
                                            <Upload customRequest={handleUpload} showUploadList={false}>
                                                <Button icon={<CloudUploadOutlined />} block>上传新文件</Button>
                                            </Upload>
                                        </div>
                                    )
                                }
                            ]}
                        />
                        
                        <Button 
                            type="primary" 
                            icon={<RobotOutlined />} 
                            block 
                            size="large"
                            style={{ marginTop: 24 }}
                            onClick={handlePredict}
                            loading={loading}
                        >
                            执行预测
                        </Button>
                    </Card>
                </Col>
                
                <Col span={16}>
                    <Card 
                        title="预测结果" 
                        bordered={false} 
                        extra={
                            <Button 
                                icon={<DownloadOutlined />} 
                                onClick={handleDownload} 
                                disabled={!predictionResult}
                            >
                                导出结果
                            </Button>
                        }
                    >
                        {predictionResult ? (
                            <Table 
                                dataSource={tableData} 
                                columns={tableColumns} 
                                loading={dataLoading}
                                pagination={{
                                    current: currentPage,
                                    pageSize: pageSize,
                                    total: tableTotal,
                                    onChange: (page, pageSize) => {
                                        setCurrentPage(page);
                                        setPageSize(pageSize);
                                    },
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    showTotal: (total) => `共 ${total} 条`
                                }}
                                scroll={{ x: 'max-content', y: 600 }}
                                size="middle"
                                rowKey={(_, index) => index?.toString() || ''}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                                <p>暂无预测结果，请在左侧配置并执行预测任务</p>
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Prediction;
