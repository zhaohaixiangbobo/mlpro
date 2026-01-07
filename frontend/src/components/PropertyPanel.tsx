import React, { useState, useEffect } from 'react';
import { Card, Empty, Spin } from 'antd';
import type { Node } from 'reactflow';
import api from '../services/api';
import MissingValueForm from './params/MissingValueForm';
import StandardizationForm from './params/StandardizationForm';
import ModelParamsForm from './params/ModelParamsForm';

export interface ColumnInfo {
    title: string;
    type: string; // 'numeric' | 'category' | 'datetime' | 'unknown'
}

interface PropertyPanelProps {
    selectedNode: Node | null;
    inputNode: Node | null;
    rootNode?: Node | null;
    onNodeDataChange: (id: string, data: any) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ selectedNode, inputNode, rootNode, onNodeDataChange }) => {
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [labelColumn, setLabelColumn] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchColumns = async () => {
            // Use rootNode for file info, but check inputNode to ensure connection exists
            const targetNode = rootNode || inputNode;
            
            if (!targetNode || !targetNode.data.filename) {
                setColumns([]);
                setLabelColumn(null);
                return;
            }

            setLoading(true);
            try {
                // Use preview API to get columns
                const res = await api.get(`/data/preview/${targetNode.data.filename}`);
                if (res.data.columns && res.data.meta && res.data.meta.columns) {
                    // Combine title from columns and type from meta
                    const cols: ColumnInfo[] = res.data.columns.map((c: any) => {
                        const colMeta = res.data.meta.columns[c.title] || {};
                        return {
                            title: c.title,
                            type: colMeta.type || 'unknown'
                        };
                    });
                    setColumns(cols);
                    setLabelColumn(res.data.meta.label_column || null);
                } else if (res.data.columns) {
                    // Fallback if meta is missing
                     setColumns(res.data.columns.map((c: any) => ({ title: c.title, type: 'unknown' })));
                     setLabelColumn(null);
                }
            } catch (error) {
                console.error("Failed to fetch columns", error);
            } finally {
                setLoading(false);
            }
        };

        // Only fetch columns if we are in Preprocessing mode and connection changed
        if (selectedNode?.data?.category === 'Preprocessing') {
            fetchColumns();
        } else {
            setColumns([]);
            setLabelColumn(null);
        }
    }, [inputNode?.id, rootNode?.id, selectedNode?.id]);

    if (!selectedNode) {
        return (
            <div style={{ padding: 20, textAlign: 'center', color: '#999', marginTop: 100 }}>
                <Empty description="请点击节点进行配置" />
            </div>
        );
    }

    const handleParamsChange = (values: any) => {
        // Merge params to avoid overwriting other data
        const currentParams = selectedNode.data.params || {};
        onNodeDataChange(selectedNode.id, { params: { ...currentParams, ...values } });
    };

    const renderContent = () => {
        const { category, label } = selectedNode.data;
        // Normalize category to handle potential case issues
        const cat = category ? category.toLowerCase() : '';

        if (cat === 'preprocessing') {
            if (loading) return <Spin tip="正在加载列信息..." />;
            
            if (label === '缺失值处理') {
                return <MissingValueForm data={selectedNode.data} onChange={handleParamsChange} columns={columns} labelColumn={labelColumn} />;
            }
            if (label === '标准化') {
                return <StandardizationForm data={selectedNode.data} onChange={handleParamsChange} columns={columns} labelColumn={labelColumn} />;
            }
            // Add other preprocessing types here if needed
        }

        if (cat === 'model') {
            return <ModelParamsForm data={selectedNode.data} onChange={handleParamsChange} />;
        }

        return <Empty description={`该节点无需配置 (${category})`} />;
    };

    return (
        <Card 
            title={`${selectedNode.data.label || '节点'} 参数配置`}
            bordered={false} 
            style={{ height: '100%', overflowY: 'auto' }}
            headStyle={{ borderBottom: '1px solid #f0f0f0' }}
        >
            {renderContent()}
        </Card>
    );
};

export default PropertyPanel;
