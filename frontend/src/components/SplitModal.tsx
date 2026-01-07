import React, { useState } from 'react';
import { Modal, Form, Select, message, InputNumber, Radio } from 'antd';
import { splitData } from '../services/api';

interface SplitModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  filename: string;
  columns: string[];
}

const SplitModal: React.FC<SplitModalProps> = ({ visible, onCancel, onSuccess, filename, columns }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSplit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const payload = {
          filename,
          train_ratio: values.train / 100,
          test_ratio: values.test / 100,
          val_ratio: values.val / 100,
          strategy: values.strategy,
          stratify_col: values.stratify_col
      };
      
      if (Math.abs(payload.train_ratio + payload.test_ratio + payload.val_ratio - 1.0) > 0.01) {
          message.error("比例之和必须为 100%");
          return;
      }

      await splitData(payload);
      message.success("数据集划分成功");
      onSuccess();
      onCancel();
    } catch (error) {
      message.error("划分失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="数据集划分"
      open={visible}
      onCancel={onCancel}
      onOk={handleSplit}
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" initialValues={{ train: 80, test: 20, val: 0, strategy: 'random' }}>
        <Form.Item label="划分比例 (%)">
            <Form.Item name="train" label="训练集" style={{ display: 'inline-block', width: '30%' }}>
                <InputNumber min={0} max={100} />
            </Form.Item>
            <Form.Item name="test" label="测试集" style={{ display: 'inline-block', width: '30%', marginLeft: '5%' }}>
                <InputNumber min={0} max={100} />
            </Form.Item>
            <Form.Item name="val" label="验证集" style={{ display: 'inline-block', width: '30%', marginLeft: '5%' }}>
                <InputNumber min={0} max={100} />
            </Form.Item>
        </Form.Item>
        
        <Form.Item name="strategy" label="划分策略">
            <Radio.Group>
                <Radio value="random">完全随机</Radio>
                <Radio value="stratified">分层抽样</Radio>
            </Radio.Group>
        </Form.Item>

        <Form.Item 
            noStyle
            shouldUpdate={(prev, current) => prev.strategy !== current.strategy}
        >
            {({ getFieldValue }) => 
                getFieldValue('strategy') === 'stratified' ? (
                    <Form.Item name="stratify_col" label="分层依据列" rules={[{ required: true }]}>
                        <Select showSearch>
                            {columns.map(col => (
                                <Select.Option key={col} value={col}>{col}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                ) : null
            }
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SplitModal;
