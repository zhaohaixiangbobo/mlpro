import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Select, Tag, Typography, Spin, Empty, Alert, Space, Button, Segmented, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { listWorkflows, loadWorkflow } from '../services/api';

const { Title } = Typography;

type TaskType = 'classification' | 'regression' | 'clustering';

interface ModelRow {
  key: string;
  workflow: string;
  algorithm: string;
  nodeLabel: string;
  type: TaskType;
  accuracy?: number;
  r2?: number;
  mse?: number;
  silhouette?: number;
  cv_mean?: number;
  featureCount?: number;
}

const TaskTypeLabel: Record<TaskType, string> = {
  classification: '分类',
  regression: '回归',
  clustering: '聚类',
};

const TaskTypeColor: Record<TaskType, string> = {
  classification: 'blue',
  regression: 'green',
  clustering: 'orange',
};

const fmt = (v: number | undefined, digits = 4) => (v === undefined || v === null ? '-' : Number(v).toFixed(digits));

const ModelCompare = () => {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [algoFilter, setAlgoFilter] = useState<string>('all');

  const loadAll = async () => {
    setLoading(true);
    setRows([]);
    try {
      const wfRes = await listWorkflows();
      const wfs = wfRes.workflows || [];
      const all: ModelRow[] = [];
      for (const w of wfs) {
        try {
          const data = await loadWorkflow(w.name);
          const nodes = data.nodes || [];
          const edges = data.edges || [];
          const nodeById = new Map<any, any>(nodes.map((x: any) => [x.id, x]));
          nodes.forEach((n: any) => {
            if (n.type === 'algoNode' && n.data.category === 'Model' && n.data.status === '成功') {
              // 指标存储在模型节点自身，或下游评估节点的 data.result 中
              let result: any = n.data.result;
              if (!result) {
                const evalEdge = edges.find((e: any) => {
                  const t = nodeById.get(e.target);
                  return e.source === n.id && t && t.type === 'evalNode';
                });
                const ev = evalEdge && nodeById.get(evalEdge.target);
                if (ev && ev.data && ev.data.result) result = ev.data.result;
              }
              if (!result) return;
              const r = result;
              let type: TaskType = 'classification';
              if (r.type === 'regression') type = 'regression';
              else if (r.type === 'clustering') type = 'clustering';
              all.push({
                key: `${w.name}_${n.id}`,
                workflow: w.name,
                algorithm: n.data.label,
                nodeLabel: n.id.slice(-5),
                type,
                accuracy: r.accuracy,
                r2: r.r2_score,
                mse: r.mse,
                silhouette: r.silhouette_score,
                cv_mean: r.cv_mean,
                featureCount: r.feature_importance ? r.feature_importance.length : undefined,
              });
            }
          });
        } catch (_) { /* 单个工作流加载失败则跳过 */ }
      }
      setRows(all);
    } catch (error) {
      console.error("加载工作流列表失败", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const algorithms = useMemo(() => Array.from(new Set(rows.map(r => r.algorithm))), [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (typeFilter === 'all' || r.type === typeFilter) &&
    (algoFilter === 'all' || r.algorithm === algoFilter)
  ), [rows, typeFilter, algoFilter]);

  // 同类型内各指标的最优值（用于高亮）
  const bestByType = useMemo(() => {
    const best: Record<string, { accuracy?: number; r2?: number; silhouette?: number }> = {};
    for (const r of rows) {
      const b = best[r.type] || (best[r.type] = {});
      if (r.accuracy !== undefined) b.accuracy = Math.max(b.accuracy ?? -Infinity, r.accuracy);
      if (r.r2 !== undefined) b.r2 = Math.max(b.r2 ?? -Infinity, r.r2);
      if (r.silhouette !== undefined) b.silhouette = Math.max(b.silhouette ?? -Infinity, r.silhouette);
    }
    return best;
  }, [rows]);

  const bestCell = (r: ModelRow, metric: 'accuracy' | 'r2' | 'silhouette', value?: number) => {
    const text = fmt(value);
    const isBest = value !== undefined && bestByType[r.type]?.[metric] === value;
    return isBest
      ? <Tag color="green" style={{ fontWeight: 600 }}>{text} <span style={{ fontSize: 10 }}>最优</span></Tag>
      : <span>{text}</span>;
  };

  const columns = [
    {
      title: '工作流',
      dataIndex: 'workflow',
      key: 'workflow',
      render: (v: string) => <Tooltip title={v}><span style={{ maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{v}</span></Tooltip>,
      sorter: (a: ModelRow, b: ModelRow) => a.workflow.localeCompare(b.workflow),
    },
    {
      title: '算法',
      dataIndex: 'algorithm',
      key: 'algorithm',
      render: (v: string) => v,
      filters: algorithms.map(a => ({ text: a, value: a })),
      onFilter: (value: any, record: ModelRow) => record.algorithm === value,
    },
    {
      title: '节点',
      dataIndex: 'nodeLabel',
      key: 'nodeLabel',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: TaskType) => <Tag color={TaskTypeColor[t]}>{TaskTypeLabel[t]}</Tag>,
    },
    {
      title: 'Accuracy',
      dataIndex: 'accuracy',
      key: 'accuracy',
      width: 110,
      align: 'center' as const,
      render: (v: number, r: ModelRow) => r.type === 'classification' ? bestCell(r, 'accuracy', v) : '-',
      sorter: (a: ModelRow, b: ModelRow) => (a.accuracy ?? -1) - (b.accuracy ?? -1),
    },
    {
      title: 'R²',
      dataIndex: 'r2',
      key: 'r2',
      width: 100,
      align: 'center' as const,
      render: (v: number, r: ModelRow) => r.type === 'regression' ? bestCell(r, 'r2', v) : '-',
      sorter: (a: ModelRow, b: ModelRow) => (a.r2 ?? -1) - (b.r2 ?? -1),
    },
    {
      title: 'MSE',
      dataIndex: 'mse',
      key: 'mse',
      width: 110,
      align: 'center' as const,
      render: (v: number, r: ModelRow) => r.type === 'regression' ? fmt(v, 2) : '-',
      sorter: (a: ModelRow, b: ModelRow) => (a.mse ?? Infinity) - (b.mse ?? Infinity),
    },
    {
      title: '轮廓系数',
      dataIndex: 'silhouette',
      key: 'silhouette',
      width: 110,
      align: 'center' as const,
      render: (v: number, r: ModelRow) => r.type === 'clustering' ? bestCell(r, 'silhouette', v) : '-',
      sorter: (a: ModelRow, b: ModelRow) => (a.silhouette ?? -1) - (b.silhouette ?? -1),
    },
    {
      title: 'CV 均值',
      dataIndex: 'cv_mean',
      key: 'cv_mean',
      width: 100,
      align: 'center' as const,
      render: (v: number) => fmt(v),
      sorter: (a: ModelRow, b: ModelRow) => (a.cv_mean ?? -1) - (b.cv_mean ?? -1),
    },
    {
      title: '特征数',
      dataIndex: 'featureCount',
      key: 'featureCount',
      width: 90,
      align: 'center' as const,
      render: (v?: number) => v === undefined ? '-' : v,
    },
  ];

  return (
    <div>
      <Card bordered={false}>
        <Title level={4} style={{ marginTop: 0 }}>模型对比</Title>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="汇总所有已保存工作流中训练成功的模型指标，同类型内最优指标以绿色标签标出。点击列头可排序。"
        />
        <Space style={{ marginBottom: 16 }} wrap>
          <Segmented
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as string)}
            options={[
              { label: '全部类型', value: 'all' },
              { label: '分类', value: 'classification' },
              { label: '回归', value: 'regression' },
              { label: '聚类', value: 'clustering' },
            ]}
          />
          <Select
            value={algoFilter}
            onChange={setAlgoFilter}
            style={{ width: 160 }}
            options={[{ label: '全部算法', value: 'all' }, ...algorithms.map(a => ({ label: a, value: a }))]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>
        </Space>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin tip="正在汇总各工作流模型...">
              <div style={{ height: 40 }} />
            </Spin>
          </div>
        ) : filtered.length === 0 ? (
          <Empty description="没有可对比的模型：请先在数据管理上传数据、在工作流中运行模型并保存" />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="key"
            size="small"
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>
    </div>
  );
};

export default ModelCompare;