import React, { useState, useEffect, useMemo } from 'react';
import { Form, Select, Typography, Checkbox, Button, Space, Alert, Tag } from 'antd';
import type { ColumnInfo } from '../PropertyPanel';

const { Title } = Typography;
const { Option } = Select;

interface MissingValueFormProps {
    data: any;
    onChange: (values: any) => void;
    columns: ColumnInfo[];
    labelColumn: string | null;
}

const MissingValueForm: React.FC<MissingValueFormProps> = ({ data, onChange, columns, labelColumn }) => {
    const [form] = Form.useForm();
    const [method, setMethod] = useState<string>(data.params?.method || 'drop');
    const [selectedCols, setSelectedCols] = useState<string[]>(data.params?.columns || []);
    
    // Filter columns based on method AND exclude label column
    const availableCols = useMemo(() => {
        let cols = columns;
        
        // Exclude label column
        if (labelColumn) {
            cols = cols.filter(c => c.title !== labelColumn);
        }

        if (['mean', 'median'].includes(method)) {
            return cols.filter(c => c.type === 'numeric');
        }
        return cols;
    }, [columns, method, labelColumn]);

    // Sync internal state with props if they change externally
    useEffect(() => {
        if (data.params?.columns) {
            setSelectedCols(data.params.columns);
            form.setFieldsValue({ columns: data.params.columns });
        }
        if (data.params?.method) {
            setMethod(data.params.method);
            form.setFieldsValue({ method: data.params.method });
        }
    }, [data.params, form]);

    const handleValuesChange = (changedValues: any, allValues: any) => {
        // If method changed, update state and maybe clear invalid columns
        if (changedValues.method) {
            setMethod(changedValues.method);
            // Optional: Auto-clear columns if they are no longer valid for the new method
            // For now, we keep them but the UI will hide/disable them. 
            // Better UX might be to filter selectedCols.
            if (['mean', 'median'].includes(changedValues.method)) {
                const validCols = selectedCols.filter(colName => {
                    const col = columns.find(c => c.title === colName);
                    return col && col.type === 'numeric';
                });
                if (validCols.length !== selectedCols.length) {
                    setSelectedCols(validCols);
                    allValues.columns = validCols;
                    form.setFieldsValue({ columns: validCols });
                }
            }
        }

        // If columns changed, update local state
        if (changedValues.columns) {
            setSelectedCols(changedValues.columns);
        }
        onChange(allValues);
    };

    // Select All logic
    const checkAll = availableCols.length > 0 && selectedCols.length === availableCols.length;
    const indeterminate = selectedCols.length > 0 && selectedCols.length < availableCols.length;

    const onCheckAllChange = (e: any) => {
        const newCols = e.target.checked ? availableCols.map(c => c.title) : [];
        setSelectedCols(newCols);
        form.setFieldsValue({ columns: newCols });
        onChange({ ...form.getFieldsValue(), columns: newCols });
    };

    const clearSelection = () => {
        setSelectedCols([]);
        form.setFieldsValue({ columns: [] });
        onChange({ ...form.getFieldsValue(), columns: [] });
    };

    return (
        <div>
            <Title level={5}>缺失值处理配置</Title>
            <Form
                form={form}
                layout="vertical"
                initialValues={data.params || { method: 'drop', columns: [] }}
                onValuesChange={handleValuesChange}
            >
                <Form.Item name="method" label="处理方式">
                    <Select>
                        <Option value="drop">删除行</Option>
                        <Option value="mean">均值填充 (仅数值)</Option>
                        <Option value="median">中位数填充 (仅数值)</Option>
                        <Option value="mode">众数填充</Option>
                    </Select>
                </Form.Item>
                
                <Form.Item label="应用列" style={{ marginBottom: 0 }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Checkbox 
                            indeterminate={indeterminate} 
                            onChange={onCheckAllChange} 
                            checked={checkAll}
                            disabled={availableCols.length === 0}
                         >
                            全选
                         </Checkbox>
                         <Button type="link" size="small" onClick={clearSelection} disabled={selectedCols.length === 0}>
                            清除选择
                         </Button>
                    </div>
                </Form.Item>

                {availableCols.length === 0 ? (
                    <Alert 
                        message={columns.length === 0 ? "暂无可用列信息" : "当前方法无可用列 (需数值型)"} 
                        type="warning" 
                        showIcon 
                        style={{ marginBottom: 16 }} 
                    />
                ) : (
                    <Form.Item name="columns">
                        <Checkbox.Group style={{ width: '100%' }}>
                            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', padding: 8, borderRadius: 4 }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {availableCols.map(col => (
                                        <Checkbox key={col.title} value={col.title}>
                                            <Space>
                                                {col.title}
                                                {col.type !== 'unknown' && (
                                                    <Tag color={col.type === 'numeric' ? 'blue' : 'green'} style={{ fontSize: 10, lineHeight: '16px', marginLeft: 4 }}>
                                                        {col.type}
                                                    </Tag>
                                                )}
                                            </Space>
                                        </Checkbox>
                                    ))}
                                </Space>
                            </div>
                        </Checkbox.Group>
                    </Form.Item>
                )}
                
                {selectedCols.length === 0 && availableCols.length > 0 && (
                     <Alert message="未选择任何列，该步骤将被跳过" type="info" showIcon />
                )}
            </Form>
        </div>
    );
};

export default MissingValueForm;
