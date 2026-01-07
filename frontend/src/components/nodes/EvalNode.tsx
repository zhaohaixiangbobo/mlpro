import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Card, Button, Statistic, Row, Col, Empty } from 'antd';
import { DeleteOutlined, AreaChartOutlined } from '@ant-design/icons';

const EvalNode: React.FC<NodeProps> = ({ data, id }) => {
  const { result } = data;

  const renderContent = () => {
    if (!result) return <Empty description="暂无运行结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

    const commonValueStyle = { fontSize: '14px' };
    const firstValueStyle = { fontSize: '14px', fontWeight: 'bold', color: '#3f8600' };

    if (result.type === 'classification') {
      const weightedAvg = result.report['weighted avg'] || {};
      return (
        <div style={{ fontSize: '12px' }}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Statistic 
                title="准确率 (Accuracy)" 
                value={result.accuracy * 100} 
                precision={2} 
                suffix="%" 
                valueStyle={firstValueStyle}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="Precision" 
                value={weightedAvg['precision-score'] || weightedAvg['precision']} 
                precision={4} 
                valueStyle={commonValueStyle}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="Recall" 
                value={weightedAvg['recall-score'] || weightedAvg['recall']} 
                precision={4} 
                valueStyle={commonValueStyle}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="F1-Score" 
                value={weightedAvg['f1-score']} 
                precision={4} 
                valueStyle={commonValueStyle}
              />
            </Col>
          </Row>
        </div>
      );
    }

    if (result.type === 'regression') {
      return (
        <div style={{ fontSize: '12px' }}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Statistic 
                title="MAE" 
                value={result.mae} 
                precision={4} 
                valueStyle={firstValueStyle} 
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="R2 Score" 
                value={result.r2_score} 
                precision={4} 
                valueStyle={commonValueStyle} 
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="MSE" 
                value={result.mse} 
                precision={4} 
                valueStyle={commonValueStyle} 
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="RMSE" 
                value={result.rmse} 
                precision={4} 
                valueStyle={commonValueStyle} 
              />
            </Col>
          </Row>
        </div>
      );
    }

    if (result.type === 'clustering') {
      return (
        <div style={{ fontSize: '12px' }}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Statistic 
                title="轮廓系数 (Silhouette)" 
                value={result.silhouette_score} 
                precision={4} 
                valueStyle={{ ...firstValueStyle, color: result.silhouette_score > 0 ? '#3f8600' : '#cf1322' }}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="CH 指数" 
                value={result.calinski_harabasz_score} 
                precision={2} 
                valueStyle={commonValueStyle}
              />
            </Col>
             <Col span={12}>
              <Statistic 
                title="DBI 指数" 
                value={result.davies_bouldin_score} 
                precision={4} 
                valueStyle={commonValueStyle}
              />
            </Col>
          </Row>
        </div>
      );
    }

    return <pre style={{ fontSize: '10px' }}>{JSON.stringify(result, null, 2)}</pre>;
  };

  const headerColor = '#fff0f6';
  const borderColor = '#eb2f96';

  return (
    <Card 
        size="small" 
        title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><AreaChartOutlined style={{ marginRight: 4 }} />模型评估</span>
                {data.onDelete && (
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        size="small" 
                        onClick={() => data.onDelete(id)} 
                    />
                )}
            </div>
        }
        style={{ width: 260, border: `1px solid ${borderColor}`, borderRadius: '8px' }}
        headStyle={{ background: headerColor, borderBottom: `1px solid ${borderColor}40`, borderRadius: '8px 8px 0 0' }}
        bodyStyle={{ padding: '8px 12px' }}
    >
      {renderContent()}
      <Handle type="target" position={Position.Left} />
    </Card>
  );
};

export default EvalNode;
