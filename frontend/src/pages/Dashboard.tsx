import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select, Row, Col, Typography, Table, Tabs, Empty, Spin, Space, Statistic, Divider, Tooltip, Button, Modal, Radio, message } from 'antd';
import { 
    LineChartOutlined, 
    BarChartOutlined, 
    RadarChartOutlined, 
    TableOutlined,
    DotChartOutlined,
    ExperimentOutlined,
    InfoCircleOutlined,
    DownloadOutlined,
    FilePdfOutlined,
    FileWordOutlined
} from '@ant-design/icons';
import { Radar, Column, Scatter } from '@ant-design/plots';
import { listWorkflows, loadWorkflow, getPCAData, exportReport } from '../services/api';
import { defaultParams } from '../components/params/ModelParamsForm';

const { Title, Text } = Typography;
const { Option } = Select;

interface WorkflowInfo {
    name: string;
    updated_at: number;
}

interface AlgoResult {
    id: string;
    label: string;
    category: string;
    result: any;
    params: any;
}

const Dashboard: React.FC = () => {
    const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [algoResults, setAlgoResults] = useState<AlgoResult[]>([]);
    const [hasSuccessfulAlgos, setHasSuccessfulAlgos] = useState(false);
    const [pcaData, setPcaData] = useState<any[]>([]);
    const [loadingPca, setLoadingPca] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportFormat, setExportFormat] = useState<'docx' | 'pdf'>('docx');
    const [exporting, setExporting] = useState(false);
    const PARAMS_COL_WIDTH = 120;

    const handleExport = async () => {
        if (!selectedWorkflow) return;
        setExporting(true);
        try {
            await exportReport(selectedWorkflow, exportFormat);
            message.success('报告导出成功');
            setIsExportModalVisible(false);
        } catch (error) {
            console.error('Export failed', error);
            message.error('报告导出失败，请重试');
        } finally {
            setExporting(false);
        }
    };

    const renderParamsCell = (record: AlgoResult) => {
        const params = record.params || defaultParams[record.label] || {};
        const formatParamValue = (value: unknown) => {
            if (value === null) return 'null';
            if (value === undefined) return 'undefined';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        };

        const paramsText = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${formatParamValue(v)}`)
            .join('; ');

        return (
            <Text
                style={{ display: 'block', maxWidth: '100%' }}
                ellipsis={paramsText ? { tooltip: paramsText } : false}
            >
                {paramsText || '-'}
            </Text>
        );
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await listWorkflows();
            if (res.workflows && res.workflows.length > 0) {
                setWorkflows(res.workflows);
                // Load the latest one by default
                handleWorkflowChange(res.workflows[0].name);
            }
        } catch (error) {
            console.error("Failed to fetch workflows", error);
        }
    };

    const handleWorkflowChange = async (name: string) => {
        setSelectedWorkflow(name);
        setLoading(true);
        try {
            const data = await loadWorkflow(name);
            const nodes = data.nodes || [];
            const edges = data.edges || [];
            
            // Extract successful algorithm results
            // Logic: Find AlgoNodes -> Follow Edge -> Find EvalNode -> Get Result
            const results: AlgoResult[] = [];
            
            const algoNodes = nodes.filter((n: any) => n.type === 'algoNode' && n.data.category === 'Model');
            setHasSuccessfulAlgos(algoNodes.length > 0);
            
            algoNodes.forEach((algoNode: any) => {
                let resultData = null;

                // 1. Check if the algorithm node itself contains results (e.g., from internal validation)
                if (algoNode.data?.result) {
                    resultData = algoNode.data.result;
                } else {
                    // 2. If not, search for a downstream evaluation node
                    const findEvalNodeFrom = (startId: string) => {
                        const visited = new Set<string>();
                        let frontier = [startId];
                        let depth = 0;
                        const MAX_DEPTH = 8;
    
                        while (frontier.length > 0 && depth < MAX_DEPTH) {
                            const next: string[] = [];
                            for (const currentId of frontier) {
                                if (visited.has(currentId)) continue;
                                visited.add(currentId);
    
                                const outgoing = edges.filter((e: any) => e.source === currentId);
                                for (const e of outgoing) {
                                    const targetNode = nodes.find((n: any) => n.id === e.target);
                                    if (!targetNode) continue;
                                    if (targetNode.type === 'evalNode') return targetNode;
                                    next.push(targetNode.id);
                                }
                            }
                            frontier = next;
                            depth++;
                        }
    
                        return null;
                    };
    
                    const evalNode = findEvalNodeFrom(algoNode.id);
                    if (evalNode && evalNode.data?.result) {
                        resultData = evalNode.data.result;
                    }
                }

                if (resultData) {
                    results.push({
                        id: algoNode.id,
                        label: algoNode.data.label,
                        category: algoNode.data.category,
                        result: resultData,
                        params: algoNode.data.params
                    });
                }
            });
            
            setAlgoResults(results);

            // If there's a data node and clustering algorithms, fetch PCA
            const dataNode = nodes.find((n: any) => n.type === 'dataNode');
            const hasClustering = results.some((r: AlgoResult) => r.category === 'Model' && r.result.type === 'clustering');
            
            if (dataNode && dataNode.data.filename && hasClustering) {
                fetchPCA(dataNode.data.filename);
            } else {
                setPcaData([]);
            }

        } catch (error) {
            console.error("Failed to load workflow data", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPCA = async (filename: string) => {
        setLoadingPca(true);
        try {
            const data = await getPCAData(filename);
            setPcaData(data);
        } catch (error) {
            console.error("PCA failed", error);
        } finally {
            setLoadingPca(false);
        }
    };

    // --- Data Processing for Charts ---

    const classificationData = useMemo(() => 
        algoResults.filter(r => r.result.type === 'classification'), 
    [algoResults]);

    const regressionData = useMemo(() => 
        algoResults.filter(r => r.result.type === 'regression'), 
    [algoResults]);

    const clusteringData = useMemo(() => 
        algoResults.filter(r => r.result.type === 'clustering'), 
    [algoResults]);

    // Radar Chart Data for Classification
    const radarData = useMemo(() => {
        const data: any[] = [];
        classificationData.forEach(algo => {
            const report = algo.result.report?.['weighted avg'] || algo.result.report?.['macro avg'] || {};
            const compactId = String(algo.id).replace(/[^a-zA-Z0-9]/g, '');
            const shortId = (compactId || String(algo.id)).slice(-5);
            const displayName = `${algo.label} (#${shortId})`;

            data.push({ name: displayName, metric: 'Accuracy', value: algo.result.accuracy, fullId: algo.id });
            data.push({ name: displayName, metric: 'Precision', value: report['precision'] || 0, fullId: algo.id });
            data.push({ name: displayName, metric: 'Recall', value: report['recall'] || 0, fullId: algo.id });
            data.push({ name: displayName, metric: 'F1', value: report['f1-score'] || 0, fullId: algo.id });
        });
        return data;
    }, [classificationData]);

    // Bar Chart Data for Regression (MAE - smaller is better)
    const regressionBarData = useMemo(() => {
        return regressionData.map(algo => ({
            name: algo.label,
            value: algo.result.mae
        })).sort((a, b) => a.value - b.value);
    }, [regressionData]);

    // --- Render Components ---

    const renderClassificationSection = () => {
        if (classificationData.length === 0) return null;

        // Calculate best values for highlighting
        const bestAccuracy = Math.max(...classificationData.map(d => d.result.accuracy));
        const bestF1 = Math.max(...classificationData.map(d => d.result.report?.['weighted avg']?.['f1-score'] || 0));
        const bestPrecision = Math.max(...classificationData.map(d => d.result.report?.['weighted avg']?.['precision'] || 0));
        const bestRecall = Math.max(...classificationData.map(d => d.result.report?.['weighted avg']?.['recall'] || 0));


        const radarPalette = [
            '#1677ff',
            '#52c41a',
            '#faad14',
            '#f5222d',
            '#13c2c2',
        ];
        const hashString = (text: string) => {
            let h = 0;
            for (let i = 0; i < text.length; i++) {
                h = (h * 31 + text.charCodeAt(i)) >>> 0;
            }
            return h;
        };
        
        // Generate an array of colors corresponding to the unique series names in order
        const seriesNames = Array.from(new Set(radarData.map(d => d.name)));
        const seriesToId = new Map<string, string>();
        radarData.forEach((d: any) => {
            if (!seriesToId.has(d.name) && d.fullId) seriesToId.set(d.name, String(d.fullId));
        });

        const radarColors = seriesNames.map((name) => {
            const id = seriesToId.get(name) || name;
            const idx = hashString(id) % radarPalette.length;
            return radarPalette[idx];
        });

        const radarValues = radarData.map(d => Number(d.value)).filter(v => Number.isFinite(v));
        const rawMin = radarValues.length ? Math.min(...radarValues) : 0;
        const rawMax = radarValues.length ? Math.max(...radarValues) : 1;
        const pad = 0.05;
        const radarMin = rawMax > rawMin ? Math.max(0, rawMin - pad) : 0;
        const radarMax = rawMax > rawMin ? Math.min(1, rawMax + pad) : 1;

        const columns = [
            { title: '算法', dataIndex: 'label', key: 'label' },
            { 
                title: '准确率', 
                dataIndex: ['result', 'accuracy'], 
                key: 'accuracy', 
                render: (v: number) => {
                    const isBest = v === bestAccuracy;
                    return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                }
            },
            {
                title: 'Precision',
                key: 'precision',
                render: (record: AlgoResult) => {
                    const v = record.result.report?.['weighted avg']?.['precision'] || 0;
                    const isBest = v === bestPrecision;
                    return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                }
            },
            {
                title: 'Recall',
                key: 'recall',
                render: (record: AlgoResult) => {
                    const v = record.result.report?.['weighted avg']?.['recall'] || 0;
                    const isBest = v === bestRecall;
                    return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                }
            },
            { 
                title: 'F1-Score', 
                key: 'f1', 
                render: (record: AlgoResult) => {
                    const v = record.result.report?.['weighted avg']?.['f1-score'] || 0;
                    const isBest = v === bestF1;
                    return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                }
            },
            {
                title: '主要参数',
                key: 'params',
                width: PARAMS_COL_WIDTH,
                render: renderParamsCell,
                onCell: () => ({ style: { width: PARAMS_COL_WIDTH, maxWidth: PARAMS_COL_WIDTH } }),
            }
        ];

        return (
            <div style={{ marginTop: 24 }}>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card
                            title={<Space><RadarChartOutlined />性能雷达图 (多算法对比)</Space>}
                            style={{ height: 400, overflow: 'hidden' }}
                            bodyStyle={{ padding: 12, overflow: 'hidden' }}
                        >
                            {classificationData.length > 0 ? (
                                <div style={{ height: 320 }}>
                                    <Radar 
                                        data={radarData}
                                        xField="metric"
                                        yField="value"
                                        seriesField="name"
                                        colorField="name"
                                        meta={{ value: { min: radarMin, max: radarMax } }}
                                        legend={false}
                                        color={radarColors}
                                        line={{ style: { lineWidth: 2 } }}
                                        point={{ size: 2, style: { fillOpacity: 0.9 } }}
                                        xAxis={{ line: null, tickLine: null, label: { style: { fill: '#8c8c8c', fontSize: 12 } } }}
                                        yAxis={{ label: false, grid: { alternateColor: 'rgba(0,0,0,0.02)' } }}
                                        appendPadding={[10, 10, 10, 10]}
                                        tooltip={{
                                            shared: true,
                                            showMarkers: true,
                                            formatter: (datum: any) => ({
                                                name: `${datum?.name} — ${datum?.fullId ?? ''}`.trim(),
                                                value: `${datum?.metric}: ${Number(datum?.value).toFixed(4)}`,
                                            }),
                                        }}
                                    />
                                </div>
                            ) : (
                                <Empty description="添加更多分类算法以进行雷达图对比" style={{ marginTop: 60 }} />
                            )}
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title={<Space><TableOutlined />分类指标详情</Space>} style={{ height: 400 }}>
                            <Table 
                                dataSource={classificationData} 
                                columns={columns} 
                                pagination={false} 
                                size="small"
                                rowKey="id"
                                tableLayout="fixed"
                                scroll={{ x: 700, y: 300 }}
                            />
                        </Card>
                    </Col>
                </Row>
                
                {/* Individual Details */}
                {classificationData.length > 0 && (
                    <>
                        <Divider>算法详情报告</Divider>
                        <Row gutter={[16, 16]}>
                            {classificationData.map(algo => (
                                <Col span={12} key={algo.id}>
                                    <Card size="small" title={`${algo.label} 详细报告`}>
                                        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                                            <Statistic title="Accuracy" value={algo.result.accuracy} precision={4} />
                                            <Statistic title="Weighted F1" value={algo.result.report?.['weighted avg']?.['f1-score']} precision={4} />
                                            <Statistic title="样本总数" value={algo.result.report?.['macro avg']?.['support'] || algo.result.report?.['weighted avg']?.['support']} />
                                        </div>
                                        <Table 
                                            dataSource={Object.entries(algo.result.report || {})
                                                .filter(([key]) => !['accuracy', 'macro avg', 'weighted avg'].includes(key))
                                                .map(([key, val]: [string, any]) => ({ class: key, ...val }))}
                                            columns={[
                                                { title: '类别', dataIndex: 'class', key: 'class' },
                                                { title: '样本数', dataIndex: 'support', key: 's' },
                                                { title: 'Precision', dataIndex: 'precision', key: 'p', render: (v) => v.toFixed(3) },
                                                { title: 'Recall', dataIndex: 'recall', key: 'r', render: (v) => v.toFixed(3) },
                                                { title: 'F1', dataIndex: 'f1-score', key: 'f', render: (v) => v.toFixed(3) },
                                            ]}
                                            pagination={false}
                                            size="small"
                                        />
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </>
                )}
            </div>
        );
    };

    const renderRegressionSection = () => {
        if (regressionData.length === 0) return null;

        // Calculate best values for highlighting
        const bestR2 = Math.max(...regressionData.map(d => d.result.r2_score));
        const bestMAE = Math.min(...regressionData.map(d => d.result.mae));
        const bestRMSE = Math.min(...regressionData.map(d => d.result.rmse));

        return (
            <div style={{ marginTop: 24 }}>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card
                            title={<Space><BarChartOutlined />MAE 误差对比 (越小越好)</Space>}
                            style={{ height: 400, overflow: 'hidden' }}
                            bodyStyle={{ padding: 12, overflow: 'hidden' }}
                        >
                            <div style={{ height: 320, maxWidth: 600, margin: '0 auto' }}>
                                <Column
                                    data={regressionBarData}
                                    xField="name"
                                    yField="value"
                                    autoFit
                                    minColumnWidth={8}
                                    maxColumnWidth={18}
                                    intervalPadding={50}
                                    paddingInner={0.6}
                                    paddingOuter={0.3}
                                    columnStyle={{
                                        radius: [6, 6, 0, 0],
                                    }}
                                    color={({ value }: any) => {
                                        const best = regressionBarData[0]?.value;
                                        if (typeof best !== 'number') return 'hsla(198, 100%, 54%, 1.00)';
                                        return Math.abs(value - best) < 1e-12 ? '#52c41a' : '#5eb4f7ff';
                                    }}
                                    tooltip={{
                                        formatter: (datum: any) => ({
                                            name: datum.name,
                                            value: Number(datum.value).toFixed(2),
                                        }),
                                    }}
                                    xAxis={{
                                        label: {
                                            autoRotate: false,
                                            autoHide: false,
                                            autoEllipsis: true,
                                            formatter: (text: string) => (text.length > 10 ? `${text.slice(0, 10)}...` : text),
                                            style: { fill: '#8c8c8c', fontSize: 11 },
                                        },
                                        tickLine: null,
                                    }}
                                    yAxis={{
                                        label: { style: { fill: '#8c8c8c', fontSize: 11 } },
                                        grid: { line: { style: { stroke: '#f0f0f0', lineDash: [4, 4] } } },
                                    }}
                                    interactions={[{ type: 'element-active' }]}
                                    meta={{
                                        name: { alias: '算法' },
                                        value: { alias: 'MAE', formatter: (v: number) => v.toFixed(2) },
                                    }}
                                />
                            </div>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title={<Space><TableOutlined />回归指标对比</Space>} style={{ height: 400 }}>
                            <Table 
                                dataSource={regressionData} 
                                columns={[
                                    { title: '算法', dataIndex: 'label', key: 'label' },
                                    { 
                                        title: 'R2 Score', 
                                        dataIndex: ['result', 'r2_score'], 
                                        key: 'r2', 
                                        render: (v: number) => {
                                            const isBest = v === bestR2;
                                            return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                                        }
                                    },
                                    { 
                                        title: 'MAE', 
                                        dataIndex: ['result', 'mae'], 
                                        key: 'mae', 
                                        render: (v: number) => {
                                            const isBest = v === bestMAE;
                                            return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                                        }
                                    },
                                    { 
                                        title: 'RMSE', 
                                        dataIndex: ['result', 'rmse'], 
                                        key: 'rmse', 
                                        render: (v: number) => {
                                            const isBest = v === bestRMSE;
                                            return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                                        }
                                    },
                                    {
                                        title: '主要参数',
                                        key: 'params',
                                        width: PARAMS_COL_WIDTH,
                                        render: renderParamsCell,
                                        onCell: () => ({ style: { width: PARAMS_COL_WIDTH, maxWidth: PARAMS_COL_WIDTH } }),
                                    }
                                ]} 
                                pagination={false} 
                                size="small"
                                rowKey="id"
                                tableLayout="fixed"
                                scroll={{ x: 600, y: 300 }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    };

    const renderClusteringSection = () => {
        if (clusteringData.length === 0) return null;

        // Calculate best values for highlighting
        const bestSilhouette = Math.max(...clusteringData.map(d => d.result.silhouette_score));
        const bestCH = Math.max(...clusteringData.map(d => d.result.calinski_harabasz_score));

        return (
            <div style={{ marginTop: 24 }}>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card 
                            title={<Space><DotChartOutlined />PCA 降维可视化 (数据分布)</Space>} 
                            style={{ height: 500, overflow: 'hidden' }} 
                            bodyStyle={{ padding: 12, overflow: 'hidden' }}
                            loading={loadingPca}
                            extra={
                                <Tooltip title="PCA 将高维数据投影到二维平面。每个点代表一个数据样本。颜色表示原始数据的标签（若存在）。这不是聚类结果的直接可视化，而是数据分布的展示。">
                                    <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
                                </Tooltip>
                            }
                        >
                            <div style={{ height: 420 }}>
                                {pcaData.length > 0 ? (
                                    <Scatter 
                                        data={pcaData}
                                        xField="x"
                                        yField="y"
                                        colorField="label"
                                        size={4}
                                        shape="circle"
                                        pointStyle={{ fillOpacity: 0.6 }}
                                        legend={new Set(pcaData.map(d => d.label)).size > 20 ? false : { position: 'bottom' }}
                                        appendPadding={[10, 10, 10, 10]}
                                        tooltip={{
                                            fields: ['x', 'y', 'label'],
                                            formatter: (datum: any) => ({
                                                name: 'Label',
                                                value: datum.label
                                            })
                                        }}
                                    />
                                ) : (
                                    <Empty description="暂无降维数据" style={{ marginTop: 100 }} />
                                )}
                            </div>
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card title={<Space><ExperimentOutlined />聚类评估指标</Space>} style={{ height: 500 }}>
                            <div style={{ marginBottom: 24 }}>
                                <Text type="secondary">聚类算法通常使用轮廓系数（Silhouette Score）等内部评估指标，值越接近 1 表示聚类效果越好。</Text>
                            </div>
                            <Table 
                                dataSource={clusteringData} 
                                columns={[
                                    { title: '算法', dataIndex: 'label', key: 'label' },
                                    { title: '簇数量', dataIndex: ['result', 'n_clusters'], key: 'n' },
                                    { 
                                        title: '轮廓系数', 
                                        dataIndex: ['result', 'silhouette_score'], 
                                        key: 's', 
                                        render: (v: number) => {
                                            const isBest = v === bestSilhouette;
                                            return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(4)}</Text>;
                                        }
                                    },
                                    { 
                                        title: 'CH 指标', 
                                        dataIndex: ['result', 'calinski_harabasz_score'], 
                                        key: 'ch', 
                                        render: (v: number) => {
                                            const isBest = v === bestCH;
                                            return <Text strong={isBest} type={isBest ? 'danger' : undefined}>{v.toFixed(2)}</Text>;
                                        }
                                    },
                                    {
                                        title: '主要参数',
                                        key: 'params',
                                        width: PARAMS_COL_WIDTH,
                                        render: renderParamsCell,
                                        onCell: () => ({ style: { width: PARAMS_COL_WIDTH, maxWidth: PARAMS_COL_WIDTH } }),
                                    }
                                ]} 
                                pagination={false} 
                                size="small"
                                rowKey="id"
                                tableLayout="fixed"
                                scroll={{ x: 600, y: 300 }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    };

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3}>可视化结果分析</Title>
                    <Text type="secondary">查看并对比工作流中各算法的训练效果</Text>
                </div>
                <Space>
                    <Button 
                        icon={<DownloadOutlined />} 
                        onClick={() => setIsExportModalVisible(true)}
                        disabled={!selectedWorkflow}
                    >
                        导出报告
                    </Button>
                    <span style={{ fontWeight: 'bold' }}>当前工作流:</span>
                    <Select 
                        style={{ width: 200 }} 
                        placeholder="选择工作流" 
                        value={selectedWorkflow}
                        onChange={handleWorkflowChange}
                    >
                        {workflows.map(w => (
                            <Option key={w.name} value={w.name}>{w.name}</Option>
                        ))}
                    </Select>
                </Space>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                    <Spin size="large" tip="加载数据中..." />
                </div>
            ) : algoResults.length > 0 ? (
                <Tabs defaultActiveKey="classification">
                    {classificationData.length > 0 && (
                        <Tabs.TabPane tab={<span><ExperimentOutlined />分类模型对比</span>} key="classification">
                            {renderClassificationSection()}
                        </Tabs.TabPane>
                    )}
                    {regressionData.length > 0 && (
                        <Tabs.TabPane tab={<span><LineChartOutlined />回归模型对比</span>} key="regression">
                            {renderRegressionSection()}
                        </Tabs.TabPane>
                    )}
                    {clusteringData.length > 0 && (
                        <Tabs.TabPane tab={<span><DotChartOutlined />聚类模型分析</span>} key="clustering">
                            {renderClusteringSection()}
                        </Tabs.TabPane>
                    )}
                </Tabs>
            ) : hasSuccessfulAlgos ? (
                <Card style={{ textAlign: 'center', padding: '100px 0' }}>
                    <Empty description="算法已成功运行，但未检测到评估节点或评估结果。请检查工作流是否连接了评估节点，或算法是否正确输出了结果。" />
                </Card>
            ) : (
                <Card style={{ textAlign: 'center', padding: '100px 0' }}>
                    <Empty description={selectedWorkflow ? "该工作流中没有运行成功的算法结果" : "请先选择一个工作流"} />
                </Card>
            )}

            <Modal
                title="导出算法分析报告"
                open={isExportModalVisible}
                onOk={handleExport}
                onCancel={() => setIsExportModalVisible(false)}
                confirmLoading={exporting}
                okText="导出"
                cancelText="取消"
            >
                <div style={{ marginBottom: 16 }}>
                    <Text>请选择导出格式：</Text>
                </div>
                <Radio.Group onChange={e => setExportFormat(e.target.value)} value={exportFormat}>
                    <Space direction="vertical">
                        <Radio value="docx">
                            <Space>
                                <FileWordOutlined style={{ color: '#1890ff' }} /> 
                                Word 文档 (.docx)
                                <Text type="secondary" style={{ fontSize: 12 }}> - 推荐，支持编辑</Text>
                            </Space>
                        </Radio>
                        <Radio value="pdf">
                            <Space>
                                <FilePdfOutlined style={{ color: '#ff4d4f' }} /> 
                                PDF 文档 (.pdf)
                                <Text type="secondary" style={{ fontSize: 12 }}> - 适合打印和分享</Text>
                            </Space>
                        </Radio>
                    </Space>
                </Radio.Group>
            </Modal>
        </div>
    );
};

export default Dashboard;
