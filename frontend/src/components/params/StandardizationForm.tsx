import React, { useState, useEffect, useMemo } from 'react';
import { Form, Select, Typography, Checkbox, Button, Space, Alert, Tag } from 'antd';
import type { ColumnInfo } from '../PropertyPanel';

const { Title } = Typography;
const { Option } = Select;

interface StandardizationFormProps {
    data: any;
    onChange: (values: any) => void;
    columns: ColumnInfo[];
    labelColumn: string | null;
}

const StandardizationForm: React.FC<StandardizationFormProps> = ({ data, onChange, columns, labelColumn }) => {
    const [form] = Form.useForm();
    const [selectedCols, setSelectedCols] = useState<string[]>(data.params?.columns || []);

    // Filter only numeric columns AND exclude label column
    const numericCols = useMemo(() => {
        let cols = columns.filter(c => c.type === 'numeric');
        if (labelColumn) {
            cols = cols.filter(c => c.title !== labelColumn);
        }
        return cols;
    }, [columns, labelColumn]);

    // Sync internal state with props
    useEffect(() => {
        if (data.params?.columns) {
            setSelectedCols(data.params.columns);
            form.setFieldsValue({ columns: data.params.columns });
        }
    }, [data.params, form]);

    const handleValuesChange = (changedValues: any, allValues: any) => {
        if (changedValues.columns) {
            setSelectedCols(changedValues.columns);
        }
        onChange(allValues);
    };

    // Select All logic
    const checkAll = numericCols.length > 0 && selectedCols.length === numericCols.length;
    const indeterminate = selectedCols.length > 0 && selectedCols.length < numericCols.length;

    const onCheckAllChange = (e: any) => {
        const newCols = e.target.checked ? numericCols.map(c => c.title) : [];
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
            <Title level={5}>数据标准化配置</Title>
            <Alert message="标准化仅适用于数值型列" type="info" showIcon style={{ marginBottom: 16 }} />
            
            <Form
                form={form}
                layout="vertical"
                initialValues={data.params || { method: 'standard', columns: [] }}
                onValuesChange={handleValuesChange}
            >
                <Form.Item name="method" label="标准化方法">
                    <Select>
                        <Option value="standard">Z-score 标准化</Option>
                        <Option value="minmax">Min-Max 归一化</Option>
                    </Select>
                </Form.Item>
                
                <Form.Item label="应用列 (仅数值型)" style={{ marginBottom: 0 }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Checkbox 
                            indeterminate={indeterminate} 
                            onChange={onCheckAllChange} 
                            checked={checkAll}
                            disabled={numericCols.length === 0}
                         >
                            全选
                         </Checkbox>
                         <Button type="link" size="small" onClick={clearSelection} disabled={selectedCols.length === 0}>
                            清除选择
                         </Button>
                    </div>
                </Form.Item>

                {numericCols.length === 0 ? (
                    <Alert message="未找到数值型列" type="warning" showIcon style={{ marginBottom: 16 }} />
                ) : (
                    <Form.Item name="columns">
                        <Checkbox.Group style={{ width: '100%' }}>
                            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', padding: 8, borderRadius: 4 }}>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {numericCols.map(col => (
                                        <Checkbox key={col.title} value={col.title}>
                                            <Space>
                                                {col.title}
                                                <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', marginLeft: 4 }}>Numeric</Tag>
                                            </Space>
                                        </Checkbox>
                                    ))}
                                </Space>
                            </div>
                        </Checkbox.Group>
                    </Form.Item>
                )}

                {selectedCols.length === 0 && numericCols.length > 0 && (
                     <Alert message="未选择任何列，该步骤将被跳过" type="info" showIcon />
                )}
            </Form>
        </div>
    );
};

export default StandardizationForm;
