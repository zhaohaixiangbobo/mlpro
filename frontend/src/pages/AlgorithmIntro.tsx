import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Typography, Card, Table, Tag, Divider, Row, Col } from 'antd';
import { 
  BookOutlined, 
  FunctionOutlined, 
  BarChartOutlined} from '@ant-design/icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const { Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

// --- KaTeX Component ---
const KaTeX: React.FC<{ math: string; block?: boolean }> = ({ math, block }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(math, containerRef.current, {
          throwOnError: false,
          displayMode: block,
          output: 'html', // Use HTML output for better accessibility/compatibility
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        containerRef.current.innerText = math;
      }
    }
  }, [math, block]);

  return <span ref={containerRef} />;
};

// --- Data Definitions ---

interface AlgorithmData {
  key: string;
  name: string;
  category: 'Regression' | 'Classification' | 'Clustering';
  definition: string;
  scenarios: string[];
  pros: string[];
  cons: string[];
  formula: {
    latex: string;
    variables: { symbol: string; desc: string }[];
    derivation?: string;
  };
  principle: {
    steps: string[];
    complexity: { time: string; space: string };
  };
}

const algorithms: AlgorithmData[] = [
  {
    key: 'linear-regression',
    name: '线性回归 (Linear Regression)',
    category: 'Regression',
    definition: '线性回归是一种统计学方法，用于模拟一个因变量（目标）与一个或多个自变量（特征）之间的线性关系。其目标是找到一条最佳拟合直线（或超平面），使得预测值与真实值之间的误差平方和最小。',
    scenarios: [
      '卷烟销售额预测：根据营销投入、季节、节假日等因素预测卷烟销售额',
      '物流配送成本预测：分析配送里程、油价、载重对运输成本的影响',
      '专卖案件罚没款预测：基于历史案件类型和案值预测年度罚没款总额'
    ],
    pros: ['简单易懂，计算速度快', '可解释性强，能给出特征权重', '是其他复杂算法的基础'],
    cons: ['假设数据呈线性关系，对非线性数据拟合效果差', '对异常值敏感', '特征之间存在共线性时会影响结果'],
    formula: {
      latex: 'y = w_0 + w_1x_1 + w_2x_2 + ... + w_nx_n + \\epsilon',
      variables: [
        { symbol: 'y', desc: '预测目标（如：卷烟销售额）' },
        { symbol: 'x_i', desc: '第 i 个特征变量（如：营销投入）' },
        { symbol: 'w_i', desc: '第 i 个特征的权重参数（系数）' },
        { symbol: 'w_0', desc: '截距项（偏置）' },
        { symbol: '\\epsilon', desc: '误差项' }
      ],
      derivation: '通常使用最小二乘法 (Ordinary Least Squares, OLS) 或梯度下降法 (Gradient Descent) 来求解参数 w，目标是最小化损失函数 J(w) = \\sum (y_i - \\hat{y}_i)^2。'
    },
    principle: {
      steps: [
        '1. 假设目标变量与特征之间存在线性关系。',
        '2. 定义损失函数（通常为均方误差 MSE）。',
        '3. 使用优化算法（如梯度下降）不断更新参数 w 和 w0，直到损失函数收敛。',
        '4. 得到最终的线性方程用于预测。'
      ],
      complexity: {
        time: 'O(np^2) 或 O(k*n*p) (梯度下降)，其中 n 为样本数，p 为特征数，k 为迭代次数',
        space: 'O(p) 用于存储参数'
      }
    }
  },
  {
    key: 'ridge-regression',
    name: '岭回归 (Ridge Regression)',
    category: 'Regression',
    definition: '岭回归是一种改良的最小二乘估计法，通过在线性回归的损失函数中加入 L2 正则化项（系数平方和），以解决多重共线性问题（即特征之间高度相关），从而获得更稳定的系数估计。',
    scenarios: [
      '多因素客户满意度分析：在服务指标高度相关的情况下分析客户满意度驱动力',
      '物流车辆油耗建模：分析车辆参数（车龄、排量）与油耗的关系（参数间存在耦合）',
      '专卖案件特征关联分析：研究多重涉案因素对案件性质判定的影响'
    ],
    pros: ['有效解决多重共线性问题', '防止模型过拟合，提高泛化能力', '保持了线性模型的解释性'],
    cons: ['引入了偏差以减少方差', '需要选择合适的正则化参数 alpha', '不会进行特征选择（系数不会变为0）'],
    formula: {
      latex: 'J(w) = \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2 + \\alpha \\sum_{j=1}^{p} w_j^2',
      variables: [
        { symbol: 'J(w)', desc: '带正则化的损失函数' },
        { symbol: '\\alpha', desc: '正则化强度参数（惩罚系数）' },
        { symbol: '\\sum w_j^2', desc: 'L2 正则化项（不包含截距 w0）' }
      ],
      derivation: '在 MSE 基础上增加 L2 范数惩罚，使得参数 w 被限制在一个圆（或超球）内，避免参数过大导致的过拟合。'
    },
    principle: {
      steps: [
        '1. 标准化数据（非常重要，因为正则化对尺度敏感）。',
        '2. 构建带 L2 惩罚项的损失函数。',
        '3. 求解使得损失函数最小的参数 w（通常有解析解 w = (X^T X + alpha I)^-1 X^T y）。'
      ],
      complexity: {
        time: 'O(np^2 + p^3) 解析解',
        space: 'O(p^2) 存储协方差矩阵'
      }
    }
  },
  {
    key: 'lasso-regression',
    name: 'Lasso 回归',
    category: 'Regression',
    definition: 'Lasso (Least Absolute Shrinkage and Selection Operator) 回归通过引入 L1 正则化项（系数绝对值之和），不仅能防止过拟合，还能将不重要的特征系数压缩为 0，从而实现自动特征选择。',
    scenarios: [
      '营销活动效果归因：从数百个营销触点中筛选出对销售提升最关键的因素',
      '物流配送效率关键指标筛选：识别影响准时率的核心路况和车辆指标',
      '真烟异常流动特征筛选：从海量交易特征中找出跨区流动的关键信号'
    ],
    pros: ['能够进行特征选择，得到稀疏模型', '适合高维数据（特征数 > 样本数）', '模型解释性强（剔除了无关变量）'],
    cons: ['当特征高度相关时，倾向于随机选择其中一个而忽略其他', '在 n < p 时最多只能选出 n 个变量'],
    formula: {
      latex: 'J(w) = \\frac{1}{2n} \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2 + \\alpha \\sum_{j=1}^{p} |w_j|',
      variables: [
        { symbol: '|w_j|', desc: 'L1 正则化项' },
        { symbol: '\\alpha', desc: '控制稀疏程度的参数' }
      ],
      derivation: 'L1 正则化的约束域是菱形（或多面体），其顶点更容易与等高线相切，从而产生零解。'
    },
    principle: {
      steps: [
        '1. 数据标准化。',
        '2. 构建带 L1 惩罚项的损失函数。',
        '3. 使用坐标下降法 (Coordinate Descent) 或最小角回归 (LARS) 求解参数。'
      ],
      complexity: {
        time: 'O(np^2) 坐标下降法',
        space: 'O(p)'
      }
    }
  },
  {
    key: 'logistic-regression',
    name: '逻辑回归 (Logistic Regression)',
    category: 'Classification',
    definition: '尽管名字中带有“回归”，逻辑回归实际上是一种用于解决二分类问题的线性模型。它在线性回归的基础上，通过 Sigmoid 函数将输出映射到 0 和 1 之间，表示样本属于正类的概率。',
    scenarios: [
      '零售户流失预警：根据订货行为预测零售户是否会停止经营',
      '真假烟识别：根据包装特征和光谱数据识别卷烟真伪',
      '配送线路准时率预测：预测特定线路在特定天气下是否能准时到达'
    ],
    pros: ['输出结果具有概率意义', '计算代价不高，易于实现', '无需假设数据分布'],
    cons: ['本质上是线性分类器，处理非线性问题能力有限', '对多重共线性敏感', '特征空间很大时性能可能不如 SVM'],
    formula: {
      latex: 'P(y=1|x) = \\sigma(w^Tx + b) = \\frac{1}{1 + e^{-(w^Tx + b)}}',
      variables: [
        { symbol: 'P(y=1|x)', desc: '样本 x 属于正类 (如：合格) 的概率' },
        { symbol: '\\sigma(z)', desc: 'Sigmoid 激活函数' },
        { symbol: 'w', desc: '权重向量' },
        { symbol: 'b', desc: '偏置项' }
      ],
      derivation: '通过最大似然估计 (Maximum Likelihood Estimation, MLE) 推导损失函数（对数损失 Log Loss），并使用梯度下降法求解。'
    },
    principle: {
      steps: [
        '1. 计算线性组合 z = w^T x + b。',
        '2. 将 z 输入 Sigmoid 函数得到概率 p = 1 / (1 + e^-z)。',
        '3. 设定阈值（通常为 0.5），若 p >= 0.5 则预测为正类，否则为负类。',
        '4. 训练时最大化似然函数（或最小化对数损失）来更新参数。'
      ],
      complexity: {
        time: 'O(k*n*p)',
        space: 'O(p)'
      }
    }
  },
  {
    key: 'decision-tree',
    name: '决策树 (Decision Tree)',
    category: 'Classification',
    definition: '决策树是一种树形结构，其中每个内部节点表示一个属性上的判断，每个分支代表一个判断结果的输出，最后每个叶节点代表一种分类结果。它模拟了人类决策的过程。',
    scenarios: [
      '客户价值分类：根据客户购买频率和金额将客户分为高、中、低价值群体',
      '专卖案件风险等级评估：根据案值、涉案人数等规则判断案件风险等级',
      '物流配送异常原因诊断：逐步判断配送延误的主要原因（天气、堵车、故障）'
    ],
    pros: ['可视化效果好，易于理解和解释', '对数据预处理要求低（不需要归一化）', '能处理数值型和类别型数据'],
    cons: ['容易过拟合（Overfitting）', '对数据微小变化敏感（不稳定性）', '忽略了属性之间的相关性'],
    formula: {
      latex: 'Entropy(S) = -\\sum_{i=1}^{c} p_i \\log_2 p_i',
      variables: [
        { symbol: 'Entropy(S)', desc: '集合 S 的信息熵（衡量不确定性）' },
        { symbol: 'p_i', desc: '第 i 类样本在集合 S 中的比例' },
        { symbol: 'c', desc: '类别的数量' }
      ],
      derivation: '常用的划分标准包括信息增益 (ID3)、信息增益率 (C4.5) 和基尼系数 (CART)。目标是找到使子节点纯度最高的划分点。'
    },
    principle: {
      steps: [
        '1. 从根节点开始，计算所有特征的信息增益（或基尼指数）。',
        '2. 选择最优特征作为当前节点的划分标准。',
        '3. 根据该特征的不同取值，将数据集划分为子集，生成子节点。',
        '4. 对子节点递归执行上述过程，直到满足停止条件（如节点纯度达到阈值或达到最大深度）。'
      ],
      complexity: {
        time: 'O(n*p*log(n)) 构建树，O(depth) 预测',
        space: 'O(nodes) 存储树结构'
      }
    }
  },
  {
    key: 'random-forest',
    name: '随机森林 (Random Forest)',
    category: 'Classification',
    definition: '随机森林是一种集成学习方法，通过构建多棵决策树并汇总它们的预测结果（分类任务取众数，回归任务取平均值）来提高模型的准确性和稳定性。',
    scenarios: [
      '重点品牌潜在客户挖掘：利用大量行为特征识别高概率潜客',
      '卷烟市场状态诊断：基于多源数据评估市场状态（紧俏、平稳、疲软）',
      '专卖许可证延续审批风险评估：综合多维信誉数据评估审批风险'
    ],
    pros: ['准确率高，抗过拟合能力强', '能处理高维数据，无需特征选择', '能评估特征重要性'],
    cons: ['模型较大，预测速度不如线性模型快', '黑盒模型，内部决策过程不如单棵树直观'],
    formula: {
      latex: '\\hat{y} = \\frac{1}{B} \\sum_{b=1}^{B} f_b(x)',
      variables: [
        { symbol: 'B', desc: '树的数量' },
        { symbol: 'f_b(x)', desc: '第 b 棵树的预测结果' },
        { symbol: '\\hat{y}', desc: '最终集成预测结果' }
      ],
      derivation: '引入两个随机性：1. Bootstrap 采样（每棵树使用不同的训练样本）；2. 特征随机选择（每个节点分裂时只考虑部分特征）。'
    },
    principle: {
      steps: [
        '1. 从原始数据集中使用 Bootstrap 方法（有放回抽样）抽取 B 个训练集。',
        '2. 对每个训练集构建一棵决策树，在分裂节点时随机选择 k 个特征进行优选。',
        '3. 让每棵树充分生长，不进行剪枝。',
        '4. 预测时，汇总所有树的结果（投票或平均）。'
      ],
      complexity: {
        time: 'O(B * n * log(n) * p)',
        space: 'O(B * nodes)'
      }
    }
  },
  {
    key: 'svm',
    name: '支持向量机 (SVM)',
    category: 'Classification',
    definition: 'SVM 是一种强大的监督学习算法，用于分类和回归。其核心思想是找到一个超平面，将不同类别的样本分开，并使得两侧最近样本（支持向量）到超平面的距离（间隔）最大化。',
    scenarios: [
      '高维特征下的真假烟鉴别：处理包含数千个波段的光谱数据进行鉴别',
      '客户投诉文本情感分类：分析客户投诉文本的情感倾向（积极/消极）',
      '物流路径规划优化分类：判断某条路径是否属于最优配送路径类别'
    ],
    pros: ['在小样本、高维空间下表现优异', '泛化能力强，不仅追求训练误差最小，还追求结构风险最小', '通过核函数可处理非线性问题'],
    cons: ['对大规模数据集训练慢', '对缺失数据和噪声敏感', '概率输出需要额外计算'],
    formula: {
      latex: '\\min_{w,b} \\frac{1}{2}||w||^2 \\;\\; s.t. \\;\\; y_i(w^Tx_i + b) \\ge 1',
      variables: [
        { symbol: 'w', desc: '超平面的法向量' },
        { symbol: 'b', desc: '截距' },
        { symbol: '||w||', desc: 'L2 范数，最大化间隔等价于最小化 ||w||' }
      ],
      derivation: '通过引入拉格朗日乘子法将其转化为对偶问题求解，仅依赖于支持向量（Support Vectors）。'
    },
    principle: {
      steps: [
        '1. 将数据映射到高维特征空间（如果使用核函数）。',
        '2. 寻找最大间隔超平面。',
        '3. 求解凸二次规划问题得到最优参数。',
        '4. 利用支持向量进行预测。'
      ],
      complexity: {
        time: 'O(n^2) 到 O(n^3)，取决于求解器',
        space: 'O(n^2) 存储核矩阵'
      }
    }
  },
  {
    key: 'knn',
    name: 'K-近邻 (KNN)',
    category: 'Classification',
    definition: 'KNN 是一种基于实例的学习算法，没有显式的训练过程。预测时，计算新样本与训练集中所有样本的距离，选取最近的 K 个邻居，通过多数表决（分类）或平均值（回归）决定预测结果。',
    scenarios: [
      '相似零售户推荐：找到经营特征最相似的其他零售户进行经验推广',
      '新入网零售户档位预测：参考地理位置相近零售户的档位情况',
      '异常运输车辆轨迹识别：基于历史正常轨迹模式识别异常偏离车辆'
    ],
    pros: ['原理最简单，直观易懂', '无需训练（Lazy Learning）', '对异常值不敏感（当 K 较大时）'],
    cons: ['计算量大，预测速度慢（需计算所有距离）', '样本不平衡时效果差', '内存开销大（需存储所有数据）'],
    formula: {
      latex: 'd(x, y) = \\sqrt{\\sum_{i=1}^{p} (x_i - y_i)^2}',
      variables: [
        { symbol: 'd(x, y)', desc: '欧氏距离 (Euclidean Distance)' },
        { symbol: 'K', desc: '邻居数量（超参数）' }
      ],
      derivation: '基于距离度量相似性，假设相似的输入产生相似的输出。'
    },
    principle: {
      steps: [
        '1. 选择邻居数量 K 和距离度量方法。',
        '2. 计算待分类样本与训练集中每个样本的距离。',
        '3. 选取距离最近的 K 个样本。',
        '4. 根据这 K 个样本的类别进行投票（或加权投票）。'
      ],
      complexity: {
        time: 'O(n*p) 预测时',
        space: 'O(n*p) 存储数据'
      }
    }
  },
  {
    key: 'gbdt',
    name: 'GBDT (Gradient Boosting Decision Tree)',
    category: 'Regression',
    definition: 'GBDT 是一种迭代的决策树算法，由多棵决策树（通常是 CART 回归树）组成。每一棵树都学习之前所有树结论和的残差，最终结果是所有树结果的加权和。',
    scenarios: [
      '卷烟销量精准预测：基于历史销量、天气、节假日等复杂特征进行高精度预测',
      '客户生命周期价值预测：预测零售户未来一年的总订货额',
      '物流分拣设备维护预测：基于设备运行数据预测下一次维护时间'
    ],
    pros: ['预测精度高，在结构化数据上表现极佳', '能处理各种类型的数据', '鲁棒性强'],
    cons: ['难以并行训练（串行过程），训练速度慢', '容易过拟合（需调节树的数量和深度）'],
    formula: {
      latex: 'F_m(x) = F_{m-1}(x) + \\eta h_m(x)',
      variables: [
        { symbol: 'F_m(x)', desc: '第 m 轮的强学习器' },
        { symbol: 'h_m(x)', desc: '第 m 轮拟合负梯度的弱学习器（树）' },
        { symbol: '\\eta', desc: '学习率（步长）' }
      ],
      derivation: '利用梯度下降的思想，每一步都在损失函数下降最快的方向（负梯度）建立新的模型。'
    },
    principle: {
      steps: [
        '1. 初始化模型（通常为常数）。',
        '2. 迭代 M 轮：',
        '   a. 计算伪残差（负梯度）。',
        '   b. 训练一棵决策树拟合残差。',
        '   c. 计算叶子节点最佳拟合值。',
        '   d. 更新模型。',
        '3. 得到最终加法模型。'
      ],
      complexity: {
        time: 'O(M * n * log(n) * p)',
        space: 'O(M * nodes)'
      }
    }
  },
  {
    key: 'xgboost',
    name: 'XGBoost',
    category: 'Classification',
    definition: 'XGBoost (eXtreme Gradient Boosting) 是 GBDT 的一种高效实现。它在算法层面引入了二阶泰勒展开近似损失函数，并在系统层面进行了并行化设计，速度和效果都非常出色。',
    scenarios: [
      '订货量波动预测：极高精度的周/月度订货量预测',
      '客户流失极早期预警：利用稀疏行为数据提前数月识别流失风险',
      '专卖情报线索价值评估：预测情报线索转化为实际案件的概率'
    ],
    pros: ['训练速度快（支持列并行）', '支持缺失值自动处理', '内置正则化项，防过拟合', '支持自定义损失函数'],
    cons: ['参数众多，调参复杂', '模型解释性不如线性模型'],
    formula: {
      latex: 'Obj^{(t)} = \\sum_{i=1}^n l(y_i, \\hat{y}_i^{(t-1)} + f_t(x_i)) + \\Omega(f_t)',
      variables: [
        { symbol: 'l', desc: '损失函数' },
        { symbol: '\\Omega', desc: '正则化项（控制树的复杂度）' },
        { symbol: 'f_t', desc: '第 t 棵树' }
      ],
      derivation: '对目标函数进行二阶泰勒展开，利用一阶导数（g）和二阶导数（h）指导分裂方向。'
    },
    principle: {
      steps: [
        '1. 类似 GBDT 的加法模型框架。',
        '2. 在分裂节点时，计算增益 Gain = 1/2 * [G_L^2/(H_L+lambda) + G_R^2/(H_R+lambda) - G^2/(H+lambda)] - gamma。',
        '3. 引入特征预排序和加权分位数草图算法加速寻找分裂点。'
      ],
      complexity: {
        time: '优于传统 GBDT',
        space: '需存储预排序结构'
      }
    }
  },
  {
    key: 'lightgbm',
    name: 'LightGBM',
    category: 'Classification',
    definition: 'LightGBM 是微软开源的梯度提升框架。它采用了基于直方图的算法、单边梯度采样 (GOSS) 和互斥特征捆绑 (EFB) 技术，在保证精度的同时大幅降低了内存消耗和计算时间。',
    scenarios: [
      '海量订单异常检测：在百万级订单数据中实时识别异常囤积行为',
      '全国范围销量预测：处理海量零售户数据进行区域销量预测',
      '物流供应链动态库存调整：基于实时流数据优化各级仓库库存'
    ],
    pros: ['训练速度极快，内存占用低', '准确率与 XGBoost 相当', '支持类别特征直接输入'],
    cons: ['在极小数据集上容易过拟合', '叶子生长策略（Leaf-wise）可能导致树比较深'],
    formula: {
      latex: 'Gain \\propto \\frac{G_L^2}{H_L} + \\frac{G_R^2}{H_R} - \\frac{G^2}{H}',
      variables: [
        { symbol: 'G', desc: '一阶梯度和' },
        { symbol: 'H', desc: '二阶梯度和' }
      ],
      derivation: '使用直方图做差加速特征直方图构建；Leaf-wise 生长策略选取增益最大的叶子分裂。'
    },
    principle: {
      steps: [
        '1. 将连续特征离散化为直方图 (Histogram)。',
        '2. 使用 Leaf-wise (按叶子生长) 策略，每次选择分裂增益最大的叶子进行分裂。',
        '3. 使用 GOSS 保留大梯度样本，随机采样小梯度样本。'
      ],
      complexity: {
        time: '极快 O(data * features)',
        space: '极低（直方图压缩）'
      }
    }
  },
  {
    key: 'kmeans',
    name: 'K-Means 聚类',
    category: 'Clustering',
    definition: 'K-Means 是一种无监督学习算法，旨在将 n 个样本划分为 k 个簇，使得每个样本属于离它最近的均值（即簇中心）对应的簇，从而使簇内方差最小化。',
    scenarios: [
      '零售终端画像：根据销量、地理位置、店铺规模对零售户进行聚类分析',
      '物流配送区域划分：根据零售户地理分布优化配送网格',
      '消费者行为细分：根据吸烟习惯、品牌偏好对消费者群体进行聚类'
    ],
    pros: ['原理简单，实现容易', '收敛速度较快', '可解释性较强'],
    cons: ['需要预先指定 k 值', '对初始中心点敏感，可能陷入局部最优', '对噪声和异常值敏感', '不适合非凸形状的簇'],
    formula: {
      latex: 'J = \\sum_{j=1}^{k} \\sum_{i=1}^{n} ||x_i^{(j)} - \\mu_j||^2',
      variables: [
        { symbol: 'J', desc: '聚类目标函数（簇内误差平方和 SSE）' },
        { symbol: 'k', desc: '簇的数量' },
        { symbol: 'x_i^{(j)}', desc: '属于第 j 个簇的第 i 个样本' },
        { symbol: '\\mu_j', desc: '第 j 个簇的中心点（均值）' }
      ],
      derivation: '算法通过迭代优化两个步骤：分配样本到最近的中心，以及更新中心为簇内样本的均值。'
    },
    principle: {
      steps: [
        '1. 随机初始化 k 个簇中心。',
        '2. 分配步骤：计算每个样本到各个中心的距离，将其分配给最近的簇。',
        '3. 更新步骤：重新计算每个簇的中心（即簇内所有样本的均值）。',
        '4. 重复步骤 2 和 3，直到中心点不再变化或达到最大迭代次数。'
      ],
      complexity: {
        time: 'O(n*k*p*t)，其中 t 为迭代次数',
        space: 'O((n+k)*p)'
      }
    }
  },
  {
    key: 'dbscan',
    name: 'DBSCAN 聚类',
    category: 'Clustering',
    definition: 'DBSCAN (Density-Based Spatial Clustering of Applications with Noise) 是一种基于密度的聚类算法。它将簇定义为密度相连的点的最大集合，能够发现任意形状的簇，并能有效识别噪声点。',
    scenarios: [
      '异常卷烟流动监测：发现地理空间上异常密集的跨区流动行为',
      '零售户地理分布分析：识别自然形成的商业聚集区（非规则形状）',
      '非法经营团伙挖掘：基于交易链路密度发现潜在团伙'
    ],
    pros: ['不需要预先指定簇的数量', '能发现任意形状的簇', '对噪声不敏感'],
    cons: ['对参数 Eps 和 MinPts 敏感', '当簇的密度不均匀时效果较差', '数据量大时计算距离开销大'],
    formula: {
      latex: 'N_{Eps}(p) = \\{q \\in D | dist(p,q) \\le Eps\\}',
      variables: [
        { symbol: 'Eps', desc: '邻域半径' },
        { symbol: 'MinPts', desc: '核心点所需的最小邻居数' },
        { symbol: 'N_{Eps}(p)', desc: '点 p 的 Eps 邻域' }
      ],
      derivation: '基于核心点 (Core Point)、边界点 (Border Point) 和噪声点 (Noise Point) 的定义，通过密度可达关系扩展簇。'
    },
    principle: {
      steps: [
        '1. 标记所有对象为未访问。',
        '2. 随机选择一个未访问对象 p。',
        '3. 如果 p 的 Eps 邻域包含至少 MinPts 个对象，创建一个新簇，并找出所有密度可达的对象加入该簇。',
        '4. 否则，标记 p 为噪声。',
        '5. 重复直到所有对象被访问。'
      ],
      complexity: {
        time: 'O(n*log n) 使用空间索引，最坏 O(n^2)',
        space: 'O(n)'
      }
    }
  }
];

const AlgorithmIntro: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<string>('intro');

  const renderComparison = () => {
    const columns = [
      { title: '特性', dataIndex: 'feature', key: 'feature', width: 150, fixed: 'left' as const },
      { title: '分类 (Classification)', dataIndex: 'classification', key: 'classification' },
      { title: '回归 (Regression)', dataIndex: 'regression', key: 'regression' },
      { title: '聚类 (Clustering)', dataIndex: 'clustering', key: 'clustering' },
    ];

    const data = [
      { key: '1', feature: '学习方式', classification: '监督学习 (Supervised)', regression: '监督学习 (Supervised)', clustering: '无监督学习 (Unsupervised)' },
      { key: '2', feature: '目标变量', classification: '离散型 (Discrete)', regression: '连续型 (Continuous)', clustering: '无 (None)' },
      { key: '3', feature: '输出结果', classification: '类别标签 (如：合格/不合格)', regression: '具体数值 (如：产量、销量)', clustering: '簇标签 (Cluster ID)' },
      { key: '4', feature: '典型算法', classification: '逻辑回归, 决策树, SVM, KNN', regression: '线性回归, SVR, 决策树回归', clustering: 'K-Means, DBSCAN, 层次聚类' },
      { key: '5', feature: '评估指标', classification: '准确率, 精确率, 召回率, F1', regression: 'MSE, RMSE, MAE, R²', clustering: '轮廓系数 (Silhouette), CH 指数' },
      { key: '6', feature: '烟草应用', classification: '客户流失预警, 真假烟识别', regression: '卷烟销量预测, 客户价值评估', clustering: '零售户分档, 消费者画像' },
    ];

    return (
      <Card title="核心算法类型对比 (Classification vs Regression vs Clustering)" bordered={false}>
        <Paragraph>
          机器学习任务通常根据是否有标签（目标变量）分为监督学习和无监督学习。监督学习进一步分为**分类**和**回归**，而无监督学习中最常见的是**聚类**。
        </Paragraph>
        <Paragraph>
            <Text strong>关于聚类算法 (Clustering)：</Text>
            <br />
            聚类分析是无监督学习的主要形式，其目的是将数据集中的样本划分为若干个通常不相交的子集（称为“簇”或“类”）。
            在烟草行业中，聚类广泛应用于<b>客户细分</b>（如零售户分档）、<b>市场区域划分</b>、<b>异常检测</b>（如真烟非法流动）等场景。
            与分类不同，聚类事先不知道样本的类别标签，而是完全根据数据本身的内在结构（如距离、密度）进行划分，旨在让同一簇内的样本尽可能相似，不同簇的样本尽可能不同。
        </Paragraph>
        <Table columns={columns} dataSource={data} pagination={false} bordered scroll={{ x: 800 }} />
      </Card>
    );
  };

  const renderAlgorithmContent = (algo: AlgorithmData) => {
    return (
      <div style={{ paddingBottom: 40 }}>
        <Title level={2}>{algo.name}</Title>
        <Tag color={algo.category === 'Classification' ? 'blue' : algo.category === 'Regression' ? 'green' : 'orange'}>
          {algo.category === 'Classification' ? '分类算法' : algo.category === 'Regression' ? '回归算法' : '聚类算法'}
        </Tag>
        <Divider />

        <Title level={3}>1. 定义与核心概念</Title>
        <Paragraph>{algo.definition}</Paragraph>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="典型应用场景" size="small" bordered={false} style={{ background: '#f6ffed' }}>
              <ul>
                {algo.scenarios.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="优缺点" size="small" bordered={false} style={{ background: '#fff7e6' }}>
              <Text strong>优点：</Text>
              <ul>
                {algo.pros.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
              <Divider style={{ margin: '8px 0' }} />
              <Text strong>缺点：</Text>
              <ul>
                {algo.cons.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Title level={3}>2. 数学公式</Title>
        <Card bordered={false} style={{ background: '#fafafa', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '1.2em', padding: '20px 0' }}>
            <KaTeX math={algo.formula.latex} block />
          </div>
        </Card>
        <Paragraph>
          <Text strong>变量解释：</Text>
        </Paragraph>
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          {algo.formula.variables.map((v, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <Tag color="geekblue"><KaTeX math={v.symbol} /></Tag> : {v.desc}
            </li>
          ))}
        </ul>
        {algo.formula.derivation && (
            <>
                <Paragraph style={{ marginTop: 16 }}>
                    <Text type="secondary">推导简述：{algo.formula.derivation}</Text>
                </Paragraph>
            </>
        )}

        <Divider />

        <Title level={3}>3. 基本原理</Title>
        <Card>
            <Paragraph>
                <ul>
                    {algo.principle.steps.map((step, i) => (
                        <li key={i} style={{ marginBottom: 8 }}>{step}</li>
                    ))}
                </ul>
            </Paragraph>
            <Divider dashed />
            <Row gutter={16}>
                <Col span={12}>
                    <Text strong>时间复杂度：</Text> <Tag>{algo.principle.complexity.time}</Tag>
                </Col>
                <Col span={12}>
                    <Text strong>空间复杂度：</Text> <Tag>{algo.principle.complexity.space}</Tag>
                </Col>
            </Row>
        </Card>

        <Divider />
        <Title level={4}>参考文献与推荐阅读</Title>
        <ul>
            <li><Text strong>周志华. 《机器学习》（西瓜书）.</Text> 清华大学出版社. - 国内最经典的机器学习教材之一。</li>
            <li><Text strong>李航. 《统计学习方法》.</Text> 清华大学出版社. - 详细推导了 SVM, GBDT, CRF 等算法的数学原理。</li>
            <li><a href="https://scikit-learn.org.cn/" target="_blank" rel="noreferrer">Scikit-learn 中文社区</a> - 包含详细的算法说明和 Python 实现代码。</li>
            <li><a href="https://tianchi.aliyun.com/course" target="_blank" rel="noreferrer">阿里云天池 AI 课程</a> - 结合行业案例的实战教程。</li>
        </ul>
      </div>
    );
  };

  const selectedAlgo = algorithms.find(a => a.key === selectedKey);

  return (
    <Layout style={{ background: '#fff', minHeight: '100%' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ height: '100%', borderRight: 0 }}
          onClick={({ key }) => setSelectedKey(key)}
          items={[
            {
                key: 'intro',
                icon: <BookOutlined />,
                label: '算法概览',
            },
            {
                type: 'divider',
            },
            {
                key: 'comparison',
                icon: <BarChartOutlined />,
                label: '核心算法对比',
            },
            {
                key: 'g1',
                label: '常用算法详解',
                type: 'group',
                children: algorithms.map(algo => ({
                    key: algo.key,
                    icon: <FunctionOutlined />,
                    label: algo.name.split(' ')[0], // Short name
                }))
            }
          ]}
        />
      </Sider>
      <Content style={{ padding: '24px 48px', overflowY: 'auto', height: 'calc(100vh - 112px)' }}>
        {selectedKey === 'intro' && (
            <div>
                <Title>机器学习算法库说明</Title>
                <Paragraph>
                    欢迎使用算法知识库。本模块旨在为用户提供清晰、专业的机器学习算法参考。
                    您可以从左侧导航栏选择特定的算法查看详细的数学原理、公式推导及应用场景，或者查看分类与回归任务的对比分析。
                </Paragraph>
                <Divider />
                <Title level={3}>快速导航</Title>
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Card hoverable onClick={() => setSelectedKey('comparison')}>
                            <Title level={4}>核心算法对比</Title>
                            <p>了解分类、回归与聚类的核心区别</p>
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card hoverable onClick={() => setSelectedKey('linear-regression')}>
                            <Title level={4}>线性回归</Title>
                            <p>最基础的回归算法</p>
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card hoverable onClick={() => setSelectedKey('decision-tree')}>
                            <Title level={4}>决策树</Title>
                            <p>直观易懂的分类与回归方法</p>
                        </Card>
                    </Col>
                </Row>
            </div>
        )}
        {selectedKey === 'comparison' && renderComparison()}
        {selectedAlgo && renderAlgorithmContent(selectedAlgo)}
      </Content>
    </Layout>
  );
};

export default AlgorithmIntro;
