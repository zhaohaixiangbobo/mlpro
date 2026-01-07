import React, { useEffect, useMemo, useState } from 'react';
import { Form, InputNumber, Select, Typography, Switch, Button, Empty, message } from 'antd';
import api from '../../services/api';

const { Title } = Typography;
const { Option } = Select;

export const defaultParams: any = {
    // Classification
    '逻辑回归': { C: 1.0, max_iter: 100, solver: 'lbfgs', penalty: 'l2', multi_class: 'auto', random_state: 42 },
    '决策树': { max_depth: null, criterion: 'gini', min_samples_split: 2, min_samples_leaf: 1, max_features: null, random_state: 42 },
    '随机森林': { n_estimators: 100, max_depth: null, min_samples_split: 2, min_samples_leaf: 1, bootstrap: true, random_state: 42 },
    '支持向量机 SVM': { C: 1.0, kernel: 'rbf', degree: 3, gamma: 'scale', probability: false, random_state: 42 },
    'KNN': { n_neighbors: 5, weights: 'uniform', algorithm: 'auto', leaf_size: 30, p: 2, random_state: 42 },
    'XGBoost': { n_estimators: 100, learning_rate: 0.1, max_depth: 3, subsample: 1.0, colsample_bytree: 1.0, random_state: 42 },
    'LightGBM': { n_estimators: 100, learning_rate: 0.1, max_depth: 3, num_leaves: 31, min_child_samples: 20, random_state: 42 },
    
    // Regression
    '线性回归': { fit_intercept: true, copy_X: true, n_jobs: null, positive: false, random_state: 42 },
    '岭回归': { alpha: 1.0, fit_intercept: true, max_iter: null, tol: 0.001, solver: 'auto', random_state: 42 },
    'Lasso': { alpha: 1.0, fit_intercept: true, max_iter: 1000, tol: 0.0001, selection: 'cyclic', random_state: 42 },
    '随机森林回归': { n_estimators: 100, max_depth: null, min_samples_split: 2, min_samples_leaf: 1, bootstrap: true, random_state: 42 },
    'GBDT回归': { n_estimators: 100, learning_rate: 0.1, max_depth: 3, subsample: 1.0, loss: 'squared_error', random_state: 42 },

    // Clustering
    'K-Means': { n_clusters: 3, init: 'k-means++', n_init: 10, max_iter: 300, tol: 0.0001, random_state: 42 },
    'DBSCAN': { eps: 0.5, min_samples: 5, metric: 'euclidean', algorithm: 'auto', leaf_size: 30, random_state: 42 },
};

interface ModelParamsFormProps {
    data: any;
    onChange: (values: any) => void;
}

const ModelParamsForm: React.FC<ModelParamsFormProps> = ({ data, onChange }) => {
    const [form] = Form.useForm();
    const modelType = data.label;
    const [fileList, setFileList] = useState<any[]>([]);

    const initialValues = useMemo(() => {
        // Merge default values with existing data params
        return { ...defaultParams[modelType], ...data.params };
    }, [modelType, data.params]);

    useEffect(() => {
        form.resetFields();
    }, [data.id, modelType, form]);

    // Fetch file list for test_file selection
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await api.get('/data/list');
                if (res.data && res.data.files) {
                    setFileList(res.data.files);
                }
            } catch (error) {
                console.error("Failed to fetch file list", error);
            }
        };
        fetchFiles();
    }, []);

    const handleReset = () => {
        form.resetFields();
        // Trigger onChange with default values
        const defaults = defaultParams[modelType] || {};
        onChange(defaults);
        message.success("参数已重置");
    };

    const isClustering = ['K-Means', 'DBSCAN'].includes(modelType);

    const renderCommonFields = () => (
        <>
            <Form.Item 
                name="random_state" 
                label="随机种子" 
                tooltip="控制随机性，固定种子可复现结果"
            >
                <InputNumber step={1} style={{ width: '100%' }} />
            </Form.Item>
            
            {!isClustering && (
                <Form.Item 
                    name="test_file" 
                    label="测试集文件 (可选)" 
                    tooltip="若选择，将使用该文件作为测试集，不再自动切分训练数据"
                >
                    <Select placeholder="请选择测试文件" allowClear>
                        {fileList.map((fileName: string) => (
                            <Option key={fileName} value={fileName}>
                                {fileName}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            )}
        </>
    );

    const renderFields = () => {
        switch (modelType) {
            case '逻辑回归':
                return (
                    <>
                        <Form.Item 
                            name="C" 
                            label="正则化强度 (C)"
                            tooltip="数值越小，正则化越强，可防止过拟合"
                        >
                            <InputNumber step={0.1} min={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="max_iter" 
                            label="最大迭代次数"
                            tooltip="求解器收敛的最大迭代次数"
                        >
                            <InputNumber step={10} min={1} style={{ width: '100%' }} />
                        </Form.Item>
                         <Form.Item 
                            name="solver" 
                            label="求解器"
                            tooltip="优化问题的算法"
                        >
                            <Select>
                                <Option value="lbfgs">lbfgs</Option>
                                <Option value="liblinear">liblinear</Option>
                                <Option value="newton-cg">newton-cg</Option>
                                <Option value="sag">sag</Option>
                                <Option value="saga">saga</Option>
                            </Select>
                        </Form.Item>
                         <Form.Item 
                            name="penalty" 
                            label="正则化类型"
                            tooltip="指定正则化的规范"
                        >
                            <Select>
                                <Option value="l2">L2</Option>
                                <Option value="l1">L1</Option>
                                <Option value="elasticnet">ElasticNet</Option>
                                <Option value="none">None</Option>
                            </Select>
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case '决策树':
                return (
                    <>
                        <Form.Item 
                            name="max_depth" 
                            label="最大深度"
                            tooltip="树的最大深度，防止过拟合"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} placeholder="不限制" />
                        </Form.Item>
                        <Form.Item 
                            name="criterion" 
                            label="划分标准"
                            tooltip="用于测量分割质量的函数"
                        >
                            <Select>
                                <Option value="gini">Gini系数</Option>
                                <Option value="entropy">信息熵</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item 
                            name="min_samples_split" 
                            label="最小分割样本数"
                            tooltip="拆分内部节点所需的最小样本数"
                        >
                            <InputNumber min={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="min_samples_leaf" 
                            label="最小叶子样本数"
                            tooltip="叶节点所需的最小样本数"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
             case '随机森林':
             case '随机森林回归':
                return (
                    <>
                        <Form.Item 
                            name="n_estimators" 
                            label="树的数量"
                            tooltip="森林中树木的数量"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="max_depth" 
                            label="最大深度"
                            tooltip="每棵树的最大深度"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} placeholder="不限制" />
                        </Form.Item>
                        <Form.Item 
                            name="min_samples_split" 
                            label="最小分割样本数"
                            tooltip="拆分内部节点所需的最小样本数"
                        >
                            <InputNumber min={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="min_samples_leaf" 
                            label="最小叶子样本数"
                            tooltip="叶节点所需的最小样本数"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case '支持向量机 SVM':
                return (
                    <>
                        <Form.Item 
                            name="C" 
                            label="正则化强度 (C)"
                            tooltip="数值越小，正则化越强，可防止过拟合"
                        >
                            <InputNumber step={0.1} min={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="kernel" 
                            label="核函数"
                            tooltip="用于将数据映射到高维空间的算法"
                        >
                            <Select>
                                <Option value="rbf">RBF (高斯核)</Option>
                                <Option value="linear">Linear (线性核)</Option>
                                <Option value="poly">Poly (多项式核)</Option>
                                <Option value="sigmoid">Sigmoid</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item 
                            name="gamma" 
                            label="Gamma"
                            tooltip="核系数，'scale' 或 'auto'"
                        >
                            <Select>
                                <Option value="scale">Scale</Option>
                                <Option value="auto">Auto</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item 
                            name="degree" 
                            label="多项式阶数"
                            tooltip="仅对 'poly' 核有效"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case 'KNN':
                return (
                    <>
                        <Form.Item 
                            name="n_neighbors" 
                            label="邻居数量 (K)"
                            tooltip="用于投票的最近邻居数量"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="weights" 
                            label="权重函数"
                            tooltip="预测中使用的权重函数"
                        >
                            <Select>
                                <Option value="uniform">Uniform (统一权重)</Option>
                                <Option value="distance">Distance (距离加权)</Option>
                            </Select>
                        </Form.Item>
                         <Form.Item 
                            name="algorithm" 
                            label="算法"
                            tooltip="用于计算最近邻居的算法"
                        >
                            <Select>
                                <Option value="auto">Auto</Option>
                                <Option value="ball_tree">BallTree</Option>
                                <Option value="kd_tree">KDTree</Option>
                                <Option value="brute">Brute</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item 
                            name="p" 
                            label="距离度量 (p)"
                            tooltip="1=曼哈顿距离, 2=欧几里得距离"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case 'XGBoost':
            case 'LightGBM':
            case 'GBDT回归':
                return (
                    <>
                        <Form.Item 
                            name="n_estimators" 
                            label="树的数量"
                            tooltip="提升树的数量"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="learning_rate" 
                            label="学习率"
                            tooltip="提升每一步的步长"
                        >
                            <InputNumber step={0.01} min={0.001} max={1.0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="max_depth" 
                            label="最大深度"
                            tooltip="基础学习器的最大深度"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="subsample" 
                            label="子样本比例"
                            tooltip="训练实例的子样本比率"
                        >
                            <InputNumber step={0.1} min={0.1} max={1.0} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case '线性回归':
            case '岭回归':
            case 'Lasso':
                return (
                    <>
                         <Form.Item 
                             name="fit_intercept" 
                             label="计算截距" 
                             valuePropName="checked"
                             tooltip="是否计算模型的截距"
                         >
                             <Switch />
                         </Form.Item>
                         {(modelType === '岭回归' || modelType === 'Lasso') && (
                             <Form.Item 
                                 name="alpha" 
                                 label="正则化强度"
                                 tooltip="乘以正则化项的常数"
                             >
                                 <InputNumber step={0.1} min={0.01} style={{ width: '100%' }} />
                             </Form.Item>
                         )}
                         {(modelType === '岭回归') && (
                             <Form.Item 
                                 name="solver" 
                                 label="求解器"
                                 tooltip="计算例程的求解器"
                             >
                                 <Select>
                                     <Option value="auto">Auto</Option>
                                     <Option value="svd">SVD</Option>
                                     <Option value="cholesky">Cholesky</Option>
                                     <Option value="lsqr">LSQR</Option>
                                     <Option value="sag">SAG</Option>
                                 </Select>
                             </Form.Item>
                         )}
                         {renderCommonFields()}
                    </>
                );
            case 'K-Means':
                return (
                    <>
                        <Form.Item 
                            name="n_clusters" 
                            label="聚类数 (K)"
                            tooltip="要生成的聚类中心数量"
                        >
                            <InputNumber min={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="init" 
                            label="初始化方法"
                            tooltip="初始化质心的方法"
                        >
                            <Select>
                                <Option value="k-means++">k-means++</Option>
                                <Option value="random">Random</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item 
                            name="max_iter" 
                            label="最大迭代次数"
                            tooltip="单次运行的最大迭代次数"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            case 'DBSCAN':
                return (
                    <>
                        <Form.Item 
                            name="eps" 
                            label="Eps (半径)"
                            tooltip="两个样本被视为邻居的最大距离"
                        >
                            <InputNumber step={0.1} min={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="min_samples" 
                            label="最小样本数"
                            tooltip="核心点邻域内的最小样本数"
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item 
                            name="metric" 
                            label="距离度量"
                            tooltip="计算点之间距离的方法"
                        >
                            <Select>
                                <Option value="euclidean">欧几里得距离</Option>
                                <Option value="manhattan">曼哈顿距离</Option>
                                <Option value="cosine">余弦相似度</Option>
                            </Select>
                        </Form.Item>
                        {renderCommonFields()}
                    </>
                );
            default:
                return (
                    <>
                        <Typography.Text type="secondary">无可用参数配置</Typography.Text>
                        {renderCommonFields()}
                    </>
                );
        }
    };

    if (!defaultParams[modelType]) {
        return <Empty description="该算法无需配置参数" />;
    }

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onValuesChange={(_, allValues) => onChange(allValues)}
        >
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>{modelType} 参数</Title>
                <Button onClick={handleReset} size="small">
                    重置默认
                </Button>
            </div>

            {renderFields()}
            
        </Form>
    );
};

export default ModelParamsForm;
