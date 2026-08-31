import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Layout, Button, message, Modal, Input, List, Spin, Popconfirm, Tag, Table, Tooltip } from 'antd';
import {
  SaveOutlined, FolderOpenOutlined, PlayCircleOutlined, ReloadOutlined, DeleteOutlined,
  ClearOutlined, UndoOutlined, RedoOutlined, HistoryOutlined, StopOutlined,
  CopyOutlined, GroupOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import Sidebar from '../components/Sidebar';
import DataNode from '../components/nodes/DataNode';
import AlgoNode from '../components/nodes/AlgoNode';
import EvalNode from '../components/nodes/EvalNode';
import EditableEdge from '../components/EditableEdge';
import api, { saveWorkflow, listWorkflows, loadWorkflow, deleteWorkflow, getRunHistory } from '../services/api';

import PropertyPanel from '../components/PropertyPanel';

const { Content, Sider } = Layout;

const nodeTypes = {
  dataNode: DataNode,
  algoNode: AlgoNode,
  evalNode: EvalNode,
};

const edgeTypes = {
  editable: EditableEdge,
};

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

const Workflow = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Loading state
  const [initializing, setInitializing] = useState(true);

  // Save/Load states
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  // 当前已加载/已保存的工作流名称（用于运行后自动保存）
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastCommitRef = useRef(0);

  // Dirty tracking (unsaved changes)
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // Running state
  const [running, setRunning] = useState(false);
  const runAbortRef = useRef(false);

  // Run history modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [runHistory, setRunHistory] = useState<any[]>([]);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // ---------- Undo / Redo ----------
  const commitSnapshot = useCallback((snapshot?: Snapshot) => {
    const now = Date.now();
    if (now - lastCommitRef.current < 300) return;
    lastCommitRef.current = now;
    const snap = snapshot || { nodes: nodesRef.current, edges: edgesRef.current };
    if (snap.nodes.length === 0 && snap.edges.length === 0) return;
    setHistory(h => [...h.slice(-49), snap]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [...f, { nodes: nodesRef.current, edges: edgesRef.current }]);
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistory(h => h.slice(0, -1));
    setDirty(true);
  }, [history, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setHistory(h => [...h, { nodes: nodesRef.current, edges: edgesRef.current }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setFuture(f => f.slice(0, -1));
    setDirty(true);
  }, [future, setNodes, setEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Warn before closing page with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // ---------- Auto load latest workflow ----------
  const doLoadLatest = useCallback(async () => {
    setInitializing(true);
    try {
      const res = await listWorkflows();
      if (res.workflows && res.workflows.length > 0) {
        const latest = res.workflows[0];
        await handleLoadConfirm(latest.name);
        message.success(`已自动加载最近工作流: ${latest.name}`);
      }
    } catch (error) {
      console.error("Auto load failed:", error);
    } finally {
      setInitializing(false);
    }
  }, []);

  const loadLatestWorkflow = useCallback(() => {
    if (dirtyRef.current) {
      Modal.confirm({
        title: '当前画布有未保存的修改',
        content: '加载工作流将覆盖当前画布，且无法撤销。确定继续吗？',
        okText: '继续加载',
        cancelText: '取消',
        onOk: () => { doLoadLatest(); },
      });
    } else {
      doLoadLatest();
    }
  }, [doLoadLatest]);

  useEffect(() => {
    loadLatestWorkflow();
  }, []);

  // ---------- Edges / Nodes handlers ----------
  const deleteEdge = useCallback((id: string) => {
    setEdges(eds => eds.filter(e => e.id !== id));
  }, [setEdges]);

  const onConnect = useCallback((params: Edge | Connection) => {
    const newEdge = { ...params, type: 'editable' as const, data: { onDelete: deleteEdge } };
    setEdges(eds => addEdge(newEdge, eds));
    commitSnapshot({ nodes: nodesRef.current, edges: [...edgesRef.current, newEdge as Edge] });
  }, [setEdges, deleteEdge, commitSnapshot]);

  const onDeleteNode = useCallback((id: string) => {
    const newNodes = nodesRef.current.filter((n) => n.id !== id);
    const newEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id);
    commitSnapshot({ nodes: newNodes, edges: newEdges });
    setNodes(newNodes);
    setEdges(newEdges);
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [setNodes, setEdges, commitSnapshot, selectedNodeId]);

  const onNodeDataChange = useCallback((id: string, data: any) => {
    commitSnapshot();
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    }));
  }, [setNodes, commitSnapshot]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
    const ids = new Set(deleted.map(d => d.id));
    // 删除分组时同时删除其子节点
    deleted.filter(d => d.type === 'group').forEach(g => {
      nodesRef.current.filter(n => n.parentNode === g.id).forEach(c => ids.add(c.id));
    });
    commitSnapshot({
      nodes: nodesRef.current.filter(n => !ids.has(n.id)),
      edges: edgesRef.current.filter(e => !ids.has(e.source) && !ids.has(e.target)),
    });
    if (selectedNodeId && ids.has(selectedNodeId)) setSelectedNodeId(null);
  }, [commitSnapshot, selectedNodeId]);

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const ids = new Set(deleted.map(d => d.id));
    commitSnapshot({
      nodes: nodesRef.current,
      edges: edgesRef.current.filter(e => !ids.has(e.id)),
    });
  }, [commitSnapshot]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    void event;
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // 预处理节点默认方法（后端 preprocess_data 支持: mean/median/mode/drop/standard/minmax）
  const PREPROCESS_DEFAULT_METHODS: Record<string, string> = {
    '缺失值处理': 'mean',
    '中位数填充': 'median',
    '众数填充': 'mode',
    '删除缺失行': 'drop',
    '标准化': 'standard',
    '归一化': 'minmax',
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/label');
      const category = event.dataTransfer.getData('application/category');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0),
        y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0),
      });

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: label,
          category: category,
          onChange: onNodeDataChange,
          onDelete: onDeleteNode,
          params: category === 'Preprocessing' ? { method: PREPROCESS_DEFAULT_METHODS[label] } : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      commitSnapshot({ nodes: [...nodesRef.current, newNode], edges: edgesRef.current });
    },
    [reactFlowInstance, nodes, onNodeDataChange, onDeleteNode, commitSnapshot, setNodes]
  );

  // ---------- Path tracing (DAG: 多分支/多数据源/stacking) ----------
  const buildSteps = useCallback((preNodes: Node[]) => {
    return preNodes.map(n => {
      let method = n.data.params?.method;
      if (!method) {
        if (n.data.label === '缺失值处理') method = 'mean';
        else if (n.data.label === '中位数填充') method = 'median';
        else if (n.data.label === '众数填充') method = 'mode';
        else if (n.data.label === '删除缺失行') method = 'drop';
        else if (n.data.label === '标准化') method = 'standard';
        else if (n.data.label === '归一化') method = 'minmax';
      }
      return { method: method, params: n.data.params || {} };
    });
  }, []);

  // 解析某个节点的上游输入：
  // mainData / mainPreprocessing: 主数据链（优先选取未跨模型节点的纯预处理分支）
  // chainModels: 所有上游模型节点（任意分支），用于 stacking
  const resolveModelInputs = useCallback((modelId: string) => {
    const branchInfo: { data: Node; pre: Node[]; crossedModel: boolean }[] = [];
    const chainModels: Node[] = [];
    const seen = new Set<string>();

    const walk = (id: string, branchPre: Node[], crossedModel: boolean, depth: number) => {
      if (depth > 30 || seen.has(id)) return;
      seen.add(id);
      const inEdges = edgesRef.current.filter(e => e.target === id);
      if (inEdges.length === 0) return;
      for (const e of inEdges) {
        const src = nodesRef.current.find(n => n.id === e.source);
        if (!src) continue;
        if (src.type === 'dataNode') {
          branchInfo.push({ data: src, pre: [...branchPre], crossedModel });
        } else if (src.type === 'algoNode' && src.data.category === 'Preprocessing') {
          // 回溯方向与执行方向相反，需前插以保证「数据→模型」的正确执行顺序（与旧版 unshift 语义一致）
          walk(src.id, [src, ...branchPre], crossedModel, depth + 1);
        } else if (src.type === 'algoNode' && src.data.category === 'Model') {
          // 依赖拓扑顺序保证上游先运行，无需依赖 status
          if (!chainModels.some(m => m.id === src.id)) {
            chainModels.push(src);
          }
          walk(src.id, branchPre, true, depth + 1);
        } else {
          walk(src.id, branchPre, crossedModel, depth + 1);
        }
      }
    };
    walk(modelId, [], false, 0);

    const direct = branchInfo.find(b => !b.crossedModel);
    const chosen = direct || branchInfo[0] || null;
    return {
      mainData: chosen ? chosen.data : null,
      mainPreprocessing: chosen ? chosen.pre : [],
      chainModels,
    };
  }, []);

  // 环检测 (Kahn 拓扑排序)，返回环路径或 null
  const findCycle = useCallback((): string[] | null => {
    const ids = new Set(nodesRef.current.map(n => n.id));
    const adj = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    nodesRef.current.forEach(n => { adj.set(n.id, []); indegree.set(n.id, 0); });
    for (const e of edgesRef.current) {
      if (ids.has(e.source) && ids.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
      }
    }
    const queue: string[] = nodesRef.current.filter(n => indegree.get(n.id) === 0).map(n => n.id);
    const processed = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      processed.add(id);
      for (const t of adj.get(id) || []) {
        indegree.set(t, (indegree.get(t) || 0) - 1);
        if (indegree.get(t) === 0) queue.push(t);
      }
    }
    if (processed.size === nodesRef.current.length) return null;
    const start = nodesRef.current.find(n => !processed.has(n.id))!;
    const path: string[] = [];
    const seen = new Set<string>();
    let cur = start.id;
    while (!seen.has(cur)) {
      seen.add(cur);
      path.push(cur);
      const next = (adj.get(cur) || []).find(t => !processed.has(t));
      if (!next) break;
      cur = next;
    }
    const loopStart = path.indexOf(cur);
    if (loopStart === -1) return [...path, path[0]];
    return [...path.slice(loopStart), cur];
  }, []);

  // 模型拓扑执行顺序（按依赖关系排序，保证上游模型先运行）
  const getTopologicalOrder = useCallback((modelNodes: Node[]): string[] => {
    const ids = new Set(modelNodes.map(n => n.id));
    const deps = new Map<string, string[]>();
    modelNodes.forEach(m => {
      deps.set(m.id, resolveModelInputs(m.id).chainModels.map(c => c.id).filter(d => ids.has(d)));
    });
    const indegree = new Map<string, number>();
    modelNodes.forEach(m => indegree.set(m.id, deps.get(m.id)!.length));
    const queue = modelNodes.filter(m => indegree.get(m.id) === 0).map(m => m.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const m of modelNodes) {
        if (indegree.get(m.id)! > 0 && deps.get(m.id)!.includes(id)) {
          indegree.set(m.id, indegree.get(m.id)! - 1);
          if (indegree.get(m.id) === 0) queue.push(m.id);
        }
      }
    }
    return order;
  }, [resolveModelInputs]);

  // ---------- Run (DAG 拓扑顺序执行，支持并联/stacking/多数据源) ----------
  // 运行成功后自动保存当前工作流（确保模型节点状态落盘，预测页才能看到模型）
  const autoSaveWorkflow = useCallback(async (): Promise<boolean> => {
    if (!currentWorkflowName) return false;
    // 等待最后一次 setNodes 提交，确保 nodesRef 是最新的运行结果
    await new Promise(resolve => setTimeout(resolve, 50));
    const serializableNodes = nodesRef.current.map(node => ({
      ...node,
      data: {
        ...node.data,
        onChange: undefined,
        onDelete: undefined,
      },
    }));
    try {
      await saveWorkflow(currentWorkflowName, serializableNodes, edgesRef.current);
      setDirty(false);
      return true;
    } catch (error) {
      console.error("Auto save error:", error);
      return false;
    }
  }, [currentWorkflowName, setDirty]);

  const handleRun = async () => {
    const modelNodes = nodesRef.current.filter(n => n.type === 'algoNode' && n.data.category === 'Model');
    if (modelNodes.length === 0) {
      message.error("请至少添加一个机器学习算法节点");
      return;
    }
    if (running) return;

    // 环校验：DAG 中存在环会无法运行
    const cycle = findCycle();
    if (cycle) {
      const cycleLabels = cycle.map(id => {
        const n = nodesRef.current.find(x => x.id === id);
        return `${n?.data?.label || '?'}(${id.slice(-5)})`;
      });
      message.error(`检测到连接环路: ${cycleLabels.join(' → ')}，请移除环后重试`, 6);
      setNodes(nds => nds.map(n => {
        if (cycle.includes(n.id) && n.type !== 'group') {
          return { ...n, data: { ...n.data, status: '失败', error: '连接存在环路，请断开环后重新运行' } };
        }
        return n;
      }));
      return;
    }

    runAbortRef.current = false;
    setRunning(true);
    const resultMap: Record<string, any> = {};
    let successCount = 0;
    let failCount = 0;

    const order = getTopologicalOrder(modelNodes);

    for (const algoId of order) {
      if (runAbortRef.current) break;

      const algoNode = nodesRef.current.find(n => n.id === algoId);
      if (!algoNode) continue;

      setNodes(nds => nds.map(n =>
        n.id === algoNode.id ? { ...n, data: { ...n.data, status: '运行中', error: null } } : n
      ));

      const { mainData, mainPreprocessing, chainModels } = resolveModelInputs(algoNode.id);
      const dataNode = mainData;
      if (!dataNode) {
        setNodes(nds => nds.map(n => n.id === algoNode.id ? { ...n, data: { ...n.data, status: '失败', error: '未连接到数据源节点' } } : n));
        failCount++;
        continue;
      }
      if (!dataNode.data.filename) {
        setNodes(nds => nds.map(n => n.id === algoNode.id ? { ...n, data: { ...n.data, status: '失败', error: '数据源未选择文件' } } : n));
        failCount++;
        continue;
      }

      // 每个上游模型节点解析其独立数据链（支持多数据源 stacking）
      const chainPayload = chainModels.map(cm => {
        const ci = resolveModelInputs(cm.id);
        return {
          node_id: cm.id,
          algorithm_label: cm.data.label || '',
          preprocessing: buildSteps(ci.mainPreprocessing),
          data_file: (ci.mainData && ci.mainData.data.filename) ? ci.mainData.data.filename : dataNode.data.filename,
        };
      });

      const payload = {
        data_file: dataNode.data.filename,
        algorithm: algoNode.data.label,
        params: algoNode.data.params || {},
        preprocessing: buildSteps(mainPreprocessing),
        chain: chainPayload,
        node_id: algoNode.id,
      };

      try {
        const response = await api.post('/workflow/run', payload, { timeout: 1800000 });
        resultMap[algoNode.id] = response.data.result;
        setNodes(nds => nds.map(n => {
          if (n.id === algoNode.id) return { ...n, data: { ...n.data, status: '成功', error: null } };
          if (mainPreprocessing.some(p => p.id === n.id)) return { ...n, data: { ...n.data, status: '成功' } };
          if (chainModels.some(cm => {
            const ci = resolveModelInputs(cm.id);
            return ci.mainPreprocessing.some(p => p.id === n.id);
          })) return { ...n, data: { ...n.data, status: '成功' } };
          return n;
        }));
        successCount++;
      } catch (error: any) {
        const msg = error?.response?.data?.detail
          || (error?.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '运行失败');
        setNodes(nds => nds.map(n => n.id === algoNode.id ? { ...n, data: { ...n.data, status: '失败', error: msg } } : n));
        failCount++;
      }
    }

    // Update connected Eval nodes with upstream results (支持多输入取第一个有结果的)
    setNodes(nds => nds.map(node => {
      if (node.type === 'evalNode') {
        const inputEdges = edgesRef.current.filter(e => e.target === node.id);
        const hit = inputEdges.find(e => resultMap[e.source]);
        if (hit && resultMap[hit.source]) {
          return { ...node, data: { ...node.data, result: resultMap[hit.source] } };
        }
      }
      return node;
    }));

    setRunning(false);

    if (runAbortRef.current) {
      message.warning(`已取消运行。完成 ${successCount} 个，失败 ${failCount} 个`);
    } else if (successCount > 0) {
      // 有模型运行成功：自动保存，使预测页能立即选择到该模型
      const saved = await autoSaveWorkflow();
      const savedNote = saved ? '，已自动保存' : (currentWorkflowName ? '（自动保存失败，请手动保存）' : '，请点击保存命名工作流');
      if (failCount === 0) {
        message.success(`运行成功 (${successCount} 个模型)${savedNote}`);
      } else {
        message.warning(`运行完成: ${successCount} 成功, ${failCount} 失败${saved ? '，已自动保存' : ''}`);
      }
    } else if (failCount > 0) {
      message.error(`运行失败 (${failCount} 个模型)，请检查节点错误信息`);
    } else {
      message.info("没有可运行的完整流程 (请检查数据连接)");
    }
  };

  const handleCancelRun = () => {
    runAbortRef.current = true;
  };

  // ---------- Save / Load / Clear ----------
  // 打开保存弹窗：输入框始终同步为「当前正在编辑的工作流名」，
  // 避免残留上一次手输的名字导致误覆盖无关工作流
  const openSaveModal = () => {
    setWorkflowName(currentWorkflowName ?? "");
    setSaveModalVisible(true);
  };

  const handleSave = async () => {
    if (!workflowName) {
      message.error("请输入工作流名称");
      return;
    }

    const serializableNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onChange: undefined,
        onDelete: undefined,
      },
    }));

    // 后端按名字直接覆盖写文件，重名会静默丢失旧工作流；
    // 存成「另一个已存在的名字」时先二次确认
    if (workflowName !== currentWorkflowName) {
      let exists = false;
      try {
        const res = await listWorkflows();
        exists = (res.workflows || []).some((w: any) => w.name === workflowName);
      } catch (error) {
        // 列表拉取失败不阻断保存，退化为原有行为
        console.error("Check duplicate name failed:", error);
      }
      if (exists) {
        Modal.confirm({
          title: '同名工作流已存在',
          content: `保存将覆盖已有工作流「${workflowName}」，其节点与运行结果无法恢复。确认覆盖？`,
          okText: '覆盖保存',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => doSave(serializableNodes),
        });
        return;
      }
    }

    await doSave(serializableNodes);
  };

  const doSave = async (serializableNodes: any[]) => {
    try {
      await saveWorkflow(workflowName, serializableNodes, edges);
      message.success("保存成功");
      setCurrentWorkflowName(workflowName);
      setSaveModalVisible(false);
      setDirty(false);
    } catch (error) {
      console.error("Save error:", error);
      message.error("保存失败");
    }
  };

  const handleLoadList = async () => {
    try {
      const res = await listWorkflows();
      setSavedWorkflows(res.workflows);
      setLoadModalVisible(true);
    } catch (error) {
      console.error("Load list error:", error);
      message.error("加载列表失败");
    }
  };

  const handleLoadConfirm = async (name: string) => {
    try {
      const res = await loadWorkflow(name);

      const restoredNodes = res.nodes.map((node: any) => ({
        ...node,
        data: {
          ...node.data,
          onChange: onNodeDataChange,
          onDelete: onDeleteNode,
        },
      }));

      const restoredEdges = (res.edges || []).map((e: any) => ({
        ...e,
        type: e.type || 'editable',
        data: { ...(e.data || {}), onDelete: deleteEdge },
      }));

      setNodes(restoredNodes);
      setEdges(restoredEdges);
      setHistory([]);
      setFuture([]);
      setDirty(false);
      setSelectedNodeId(null);
      setCurrentWorkflowName(name);
      setLoadModalVisible(false);
    } catch (error) {
      message.error("加载工作流失败");
      throw error;
    }
  };

  const handleDeleteWorkflow = async (name: string) => {
    try {
      await deleteWorkflow(name);
      message.success("删除成功");
      handleLoadList();
    } catch (error) {
      console.error("Delete error:", error);
      message.error("删除失败");
    }
  };

  const handleClear = () => {
    Modal.confirm({
      title: '确认清空画布？',
      content: dirtyRef.current ? '这将清除当前所有节点和连接，且无法撤销。当前有未保存的修改。' : '这将清除当前所有节点和连接，且无法撤销。',
      onOk() {
        commitSnapshot();
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
        setCurrentWorkflowName(null);
        // 同时清掉待保存的名字，否则下次保存会预填旧名字并覆盖原工作流
        setWorkflowName("");
        setDirty(true);
        message.success("画布已清空");
      },
    });
  };

  // ---------- 节点复制 ----------
  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const offset = { x: 60, y: 80 };
    const isGroup = node.type === 'group';
    const children = isGroup ? nodesRef.current.filter(n => n.parentNode === node.id) : [];
    const newId = `${node.type}_${Date.now()}`;
    const buildNode = (src: Node, id: string, pos: { x: number; y: number }, parentNode?: string): Node => ({
      ...src,
      id,
      parentNode,
      extent: parentNode ? ('parent' as const) : undefined,
      position: pos,
      data: {
        ...src.data,
        params: src.data.params ? JSON.parse(JSON.stringify(src.data.params)) : undefined,
        status: undefined,
        error: null,
        result: undefined,
        onChange: onNodeDataChange,
        onDelete: onDeleteNode,
      },
      selected: true,
    });
    const newNodes: Node[] = [buildNode(node, newId, {
      x: (node.position?.x || 0) + offset.x,
      y: (node.position?.y || 0) + offset.y,
    })];
    if (isGroup) {
      // 复制分组：子节点作为独立节点 (保留绝对位置)，不产生嵌套分组
      const newChildMap = new Map<string, string>();
      children.forEach(c => {
        const cid = `${c.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newChildMap.set(c.id, cid);
        const absPos = {
          x: (node.position?.x || 0) + (c.position?.x || 0),
          y: (node.position?.y || 0) + (c.position?.y || 0),
        };
        newNodes.push(buildNode(c, cid, { x: absPos.x + offset.x, y: absPos.y + offset.y }));
      });
      const newEdgesFromChildren = edgesRef.current
        .filter(e => e.source === nodeId || (e.source !== nodeId && newChildMap.has(e.target)))
        .map(e => ({
          ...e,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          source: e.source === nodeId ? newId : (newChildMap.get(e.source) || e.source),
          target: newChildMap.get(e.target) || e.target,
        }));
      commitSnapshot({ nodes: [...nodesRef.current, ...newNodes], edges: [...edgesRef.current, ...newEdgesFromChildren] });
      setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
      setEdges(eds => [...eds, ...newEdgesFromChildren]);
      setSelectedNodeId(newId);
      message.success(`分组已复制 (${children.length} 个子节点)`);
      return;
    }
    const newEdges = edgesRef.current
      .filter(e => e.target === nodeId)
      .map(e => ({
        ...e,
        id: `edge_${newId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        target: newId,
      }));
    commitSnapshot({ nodes: [...nodesRef.current, ...newNodes], edges: [...edgesRef.current, ...newEdges] });
    setNodes(nds => [...nds.map(n => ({ ...n, selected: n.id === newId })), ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedNodeId(newId);
    message.success("节点已复制");
  }, [onNodeDataChange, onDeleteNode, commitSnapshot, setNodes, setEdges]);

  // Ctrl+D 复制选中节点
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNodeId) duplicateNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, duplicateNode]);

  // ---------- 节点分组 (Group) ----------
  const createGroup = useCallback(() => {
    const selected = nodesRef.current.filter(n => n.selected && n.type !== 'group');
    if (selected.length === 0) {
      message.info("请先框选/多选要分组的节点（按住 Shift 点击或拖框选中）");
      return;
    }
    const gid = `group_${Date.now()}`;
    const positions = selected.map(n => n.position);
    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxX = Math.max(...positions.map(p => p.x + 200));
    const maxY = Math.max(...positions.map(p => p.y + 120));
    const groupPos = { x: minX - 20, y: minY - 40 };
    const group: Node = {
      id: gid,
      type: 'group',
      position: groupPos,
      data: { label: '分组' },
      style: {
        width: maxX - minX + 40,
        height: maxY - minY + 40,
        backgroundColor: 'rgba(22, 119, 255, 0.04)',
        border: '1px dashed #1677ff',
        borderRadius: '10px',
      },
    };
    const children: Node[] = selected.map(n => ({
      ...n,
      parentNode: gid,
      extent: 'parent' as const,
      position: { x: n.position.x - groupPos.x, y: n.position.y - groupPos.y },
    }));
    const keepIds = new Set(selected.map(n => n.id));
    commitSnapshot({
      nodes: [...nodesRef.current.filter(n => !keepIds.has(n.id)), group, ...children],
      edges: edgesRef.current,
    });
    setNodes(nds => [...nds.filter(n => !keepIds.has(n.id)), group, ...children]);
    message.success(`已创建分组 (${selected.length} 个节点)`);
  }, [commitSnapshot, setNodes]);

  // ---------- 自动布局 (分层布局) ----------
  const autoLayout = useCallback(() => {
    const NODE_W = 240;
    const NODE_H = 140;
    const H_GAP = 60;
    const V_GAP = 40;
    const nodes = nodesRef.current;
    const ids = new Set(nodes.map(n => n.id));
    const adjOut = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    nodes.forEach(n => { adjOut.set(n.id, []); indegree.set(n.id, 0); });
    for (const e of edgesRef.current) {
      if (ids.has(e.source) && ids.has(e.target)) {
        adjOut.get(e.source)!.push(e.target);
        indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
      }
    }
    // 最长路径分层
    const level = new Map<string, number>();
    const inDeg = new Map(indegree);
    const queue: string[] = nodes.filter(n => inDeg.get(n.id) === 0).map(n => n.id);
    for (const q of queue) level.set(q, 0);
    while (queue.length) {
      const id = queue.shift()!;
      for (const t of adjOut.get(id) || []) {
        level.set(t, Math.max(level.get(t) ?? 0, (level.get(id) ?? 0) + 1));
        inDeg.set(t, (inDeg.get(t) || 0) - 1);
        if (inDeg.get(t) === 0) queue.push(t);
      }
    }
    const byLevel = new Map<number, Node[]>();
    nodes.forEach(n => {
      if (n.type === 'group') return;
      const lvl = level.get(n.id) ?? 0;
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    });
    let newNodes = nodes.map(n => {
      if (n.type === 'group') return n;
      const lvl = level.get(n.id) ?? 0;
      const idx = byLevel.get(lvl)!.indexOf(n);
      return {
        ...n,
        position: { x: lvl * (NODE_W + H_GAP) + 20, y: 60 + idx * (NODE_H + V_GAP) },
      };
    });
    // 分组节点按子节点包围盒摆放，并换算子节点相对坐标
    const groups = nodes.filter(n => n.type === 'group');
    for (const g of groups) {
      const children = newNodes.filter(n => n.parentNode === g.id);
      if (children.length === 0) continue;
      const minX = Math.min(...children.map(c => c.position.x));
      const minY = Math.min(...children.map(c => c.position.y));
      const maxX = Math.max(...children.map(c => c.position.x + 200));
      const maxY = Math.max(...children.map(c => c.position.y + 120));
      const gp = { x: minX - 20, y: minY - 40 };
      const idx = newNodes.findIndex(n => n.id === g.id);
      if (idx !== -1) {
        newNodes[idx] = {
          ...g,
          position: gp,
          style: {
            ...(g.style || {}),
            width: maxX - minX + 40,
            height: maxY - minY + 40,
          },
        };
      }
      newNodes = newNodes.map(c => {
        if (c.parentNode === g.id) {
          return { ...c, position: { x: c.position.x - gp.x, y: c.position.y - gp.y } };
        }
        return c;
      });
    }
    commitSnapshot({ nodes: newNodes, edges: edgesRef.current });
    setNodes(newNodes);
    message.success("自动布局完成");
  }, [commitSnapshot, setNodes]);

  // ---------- Run history ----------
  const openHistory = async () => {
    try {
      const res = await getRunHistory();
      setRunHistory(res.history || []);
      setHistoryModalVisible(true);
    } catch (_) {
      message.error("获取运行历史失败");
    }
  };

  const historyColumns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 160 },
    { title: '数据集', dataIndex: 'data_file', key: 'data_file', ellipsis: true },
    { title: '算法', dataIndex: 'algorithm', key: 'algorithm', width: 120 },
    {
      title: '调参', dataIndex: 'auto_tune', key: 'auto_tune', width: 70,
      render: (v: boolean) => v ? <Tag color="purple">自动调参</Tag> : '-',
    },
    {
      title: '指标', dataIndex: 'metrics', key: 'metrics', ellipsis: true,
      render: (m: any) => {
        if (!m || Object.keys(m).length === 0) return '-';
        return Object.entries(m).map(([k, v]) => `${k}=${v}`).join(', ');
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => s === 'success'
        ? <Tag color="green">成功</Tag>
        : <Tooltip title={runHistory.find(r => r.status === s)?.error || ''}><Tag color="red">失败</Tag></Tooltip>,
    },
  ];

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const inputEdge = selectedNode ? edges.find(e => e.target === selectedNode.id) : null;
  const inputNode = inputEdge ? nodes.find(n => n.id === inputEdge.source) || null : null;

  const findRootDataNode = (startNode: Node | null): Node | null => {
    if (!startNode) return null;
    if (startNode.type === 'dataNode') return startNode;

    const edge = edges.find(e => e.target === startNode.id);
    if (!edge) return null;

    const parent = nodes.find(n => n.id === edge.source);
    return findRootDataNode(parent || null);
  };

  const rootNode = selectedNode ? findRootDataNode(selectedNode) : null;

  return (
    <Layout style={{ height: '100%' }}>
      <Sider width={240} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <Sidebar />
      </Sider>
      <Content style={{ height: '100%', display: 'flex' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', zIndex: 1000, right: 20, top: 20, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', maxWidth: '70%', justifyContent: 'flex-end' }}>
            {dirty && <Tag color="orange">未保存</Tag>}
            <Tooltip title="撤销 (Ctrl+Z)">
              <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={history.length === 0} />
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Y)">
              <Button icon={<RedoOutlined />} onClick={handleRedo} disabled={future.length === 0} />
            </Tooltip>
            <Tooltip title="复制选中节点 (Ctrl+D)">
              <Button icon={<CopyOutlined />} onClick={() => selectedNodeId && duplicateNode(selectedNodeId)} disabled={!selectedNodeId} />
            </Tooltip>
            <Tooltip title="将选中节点编为一组">
              <Button icon={<GroupOutlined />} onClick={createGroup} />
            </Tooltip>
            <Tooltip title="自动布局 (按数据流分层排列)">
              <Button icon={<ApartmentOutlined />} onClick={autoLayout} />
            </Tooltip>
            <Button icon={<ClearOutlined />} onClick={handleClear} type="primary" danger>清空</Button>
            <Button icon={<ReloadOutlined />} onClick={loadLatestWorkflow} loading={initializing}>重载</Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleLoadList}>加载</Button>
            <Button icon={<SaveOutlined />} onClick={openSaveModal}>保存</Button>
            <Button icon={<HistoryOutlined />} onClick={openHistory}>历史</Button>
            {running ? (
              <Button danger icon={<StopOutlined />} onClick={handleCancelRun}>取消</Button>
            ) : (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun}>运行</Button>
            )}
          </div>

          {initializing ? (
            <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Spin size="large" tip="正在加载工作流..." />
            </div>
          ) : (
            <div className="dndflow" style={{ height: 'calc(100vh - 0px)' }} ref={reactFlowWrapper}>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  onInit={setReactFlowInstance}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  deleteKeyCode={['Backspace', 'Delete']}
                  onNodesDelete={onNodesDelete}
                  onEdgesDelete={onEdgesDelete}
                  onNodeDragStop={() => commitSnapshot()}
                  fitView
                >
                  <Controls />
                  <Background color="#f0f2f5" gap={16} />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          )}
        </div>

        {/* Right Property Panel */}
        <Sider width={260} theme="light" style={{ borderLeft: '1px solid #f0f0f0', display: selectedNodeId ? 'block' : 'none' }}>
          <PropertyPanel
            selectedNode={selectedNode}
            inputNode={inputNode}
            rootNode={rootNode}
            onNodeDataChange={onNodeDataChange}
            onDuplicate={duplicateNode}
          />
        </Sider>
      </Content>

      {/* Save Modal */}
      <Modal
        title="保存工作流"
        open={saveModalVisible}
        onOk={handleSave}
        onCancel={() => setSaveModalVisible(false)}
      >
        <Input
          placeholder="工作流名称"
          value={workflowName}
          onChange={e => setWorkflowName(e.target.value)}
        />
      </Modal>

      {/* Load Modal */}
      <Modal
        title="加载工作流"
        open={loadModalVisible}
        footer={null}
        onCancel={() => setLoadModalVisible(false)}
      >
        <List
          dataSource={savedWorkflows}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => handleLoadConfirm(item.name)}>加载</Button>,
                <Popconfirm title="确定删除该工作流吗？" onConfirm={() => handleDeleteWorkflow(item.name)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={item.name}
                description={item.updated_at ? new Date(item.updated_at * 1000).toLocaleString() : ''}
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* Run History Modal */}
      <Modal
        title="运行历史"
        open={historyModalVisible}
        footer={null}
        onCancel={() => setHistoryModalVisible(false)}
        width={720}
      >
        <Table
          dataSource={runHistory}
          columns={historyColumns}
          rowKey={(record: any) => `${record.time}_${record.node_id || record.algorithm}`}
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Modal>

    </Layout>
  );
};

export default Workflow;
