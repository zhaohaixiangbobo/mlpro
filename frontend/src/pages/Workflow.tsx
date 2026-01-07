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
import { Layout, Button, message, Modal, Input, List, Spin, Popconfirm } from 'antd';
import { SaveOutlined, FolderOpenOutlined, PlayCircleOutlined, ReloadOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons';
import Sidebar from '../components/Sidebar';
import DataNode from '../components/nodes/DataNode';
import AlgoNode from '../components/nodes/AlgoNode';
import EvalNode from '../components/nodes/EvalNode';
import api, { saveWorkflow, listWorkflows, loadWorkflow, deleteWorkflow } from '../services/api';

import PropertyPanel from '../components/PropertyPanel';

const { Content, Sider } = Layout;

const nodeTypes = {
  dataNode: DataNode,
  algoNode: AlgoNode,
  evalNode: EvalNode,
};

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

  // Auto load latest workflow on init
  const loadLatestWorkflow = async () => {
    setInitializing(true);
    try {
        const res = await listWorkflows();
        if (res.workflows && res.workflows.length > 0) {
            // Get the first one (latest)
            const latest = res.workflows[0];
            console.log("Auto loading latest workflow:", latest.name);
            await handleLoadConfirm(latest.name);
            message.success(`已自动加载最近工作流: ${latest.name}`);
        } else {
            console.log("No workflows found to auto-load");
        }
    } catch (error) {
        console.error("Auto load failed:", error);
        // Silent fail or optional notification
    } finally {
        setInitializing(false);
    }
  };

  useEffect(() => {
      loadLatestWorkflow();
  }, []);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDeleteNode = useCallback((id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const onNodeDataChange = useCallback((id: string, data: any) => {
      setNodes((nds) => nds.map((node) => {
          if (node.id === id) {
              node.data = { ...node.data, ...data };
          }
          return node;
      }));
  }, [setNodes]);

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
            onDelete: onDeleteNode
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodes, onNodeDataChange, onDeleteNode]
  );

  const handleRun = async () => {
      // 1. Find all "Model" nodes (Terminal Algorithm Nodes)
      const modelNodes = nodes.filter(n => n.type === 'algoNode' && n.data.category === 'Model');

      if (modelNodes.length === 0) {
          message.error("请至少添加一个机器学习算法节点");
          return;
      }

      message.loading("正在运行...", 0);

      // Helper to backtrack path from a node to the data source
      const traceBackPath = (startNode: Node) => {
          const preprocessingNodes: Node[] = [];
          let currentNode = startNode;
          let dataNode: Node | null = null;
  
          // Max depth protection
          let depth = 0;
          const MAX_DEPTH = 20;
  
          while (depth < MAX_DEPTH) {
              // Find the input edge connected to current node
              const inputEdge = edges.find(e => e.target === currentNode.id);
              if (!inputEdge) break;
  
              // Find the source node
              const sourceNode = nodes.find(n => n.id === inputEdge.source);
              if (!sourceNode) break;
  
              if (sourceNode.type === 'dataNode') {
                  dataNode = sourceNode;
                  break; // Found the source
              } else if (sourceNode.type === 'algoNode' && sourceNode.data.category === 'Preprocessing') {
                  preprocessingNodes.unshift(sourceNode); // Add to beginning (since we are going backwards)
                  currentNode = sourceNode;
              } else {
                  // If we hit another Model node or Eval node in the chain, we treat it as a break for now
                  // or we could continue if we support model chaining.
                  // For now, assume Data -> [Pre] -> Model structure.
                  break;
              }
              depth++;
          }
          return { dataNode, preprocessingNodes };
      };

      const runPromises = modelNodes.map(async (algoNode) => {
          const { dataNode, preprocessingNodes } = traceBackPath(algoNode);
          
          if (!dataNode) {
              console.warn(`Node ${algoNode.data.label} is not connected to a Data Node`);
              // We could show a warning but continue with other nodes
              return null; 
          }

          if (!dataNode.data.filename) {
               // Skip if no file selected
               return null;
          }

          // Map preprocessing nodes to API format
          const preprocessingSteps = preprocessingNodes.map(n => {
              // Extract method from params or map from label if needed
              // The backend expects "method" in the step dict.
              // If params already has 'method' (e.g. from MissingValueForm), use it.
              // Otherwise, try to infer from label (fallback).
              let method = n.data.params?.method;
              
              if (!method) {
                  if (n.data.label === '缺失值处理') method = 'mean'; // Default fallback
                  else if (n.data.label === '标准化') method = 'standard';
                  else if (n.data.label === '归一化') method = 'minmax';
              }

              return {
                  method: method,
                  params: n.data.params || {}
              };
          });

          const payload = {
              data_file: dataNode.data.filename,
              algorithm: algoNode.data.label,
              params: algoNode.data.params || {},
              preprocessing: preprocessingSteps,
              node_id: algoNode.id
          };

          try {
              const response = await api.post('/workflow/run', payload);
              return { 
                  nodeId: algoNode.id,
                  pathNodeIds: preprocessingNodes.map(n => n.id),
                  success: true, 
                  result: response.data.result 
              };
          } catch (error) {
              console.error(`Error running node ${algoNode.data.label}:`, error);
              return { 
                  nodeId: algoNode.id,
                  pathNodeIds: [],
                  success: false, 
                  error 
              };
          }
      });

      try {
          const results = await Promise.all(runPromises);
          
          let successCount = 0;
          let failCount = 0;

          // Collect all successful path nodes
          const successfulPathIds = new Set<string>();
          results.forEach(r => {
              if (r && r.success) {
                  r.pathNodeIds.forEach(id => successfulPathIds.add(id));
              }
          });

          // Update Eval Nodes and Algo Nodes based on results
          setNodes(nds => nds.map(node => {
              // Update Algo Node Status (The Model Node)
              const res = results.find(r => r && r.nodeId === node.id);
              if (res) {
                  if (res.success) {
                      successCount++;
                      return { ...node, data: { ...node.data, status: '成功', error: null } };
                  } else {
                      failCount++;
                      // Extract error message from response or default to generic message
                      const errorMessage = (res.error as any)?.response?.data?.detail || (res.error as any)?.message || "运行失败";
                      return { ...node, data: { ...node.data, status: '失败', error: errorMessage } };
                  }
              }

              // Update Preprocessing Nodes Status (Nodes in the successful path)
              if (successfulPathIds.has(node.id)) {
                   return { ...node, data: { ...node.data, status: '成功' } };
              }

              // Update connected Eval Nodes
              // Find if this eval node is connected to a successful algo node
              if (node.type === 'evalNode') {
                  const inputEdge = edges.find(e => e.target === node.id);
                  if (inputEdge) {
                      const sourceRes = results.find(r => r && r.nodeId === inputEdge.source);
                      if (sourceRes && sourceRes.success) {
                          return { ...node, data: { ...node.data, result: sourceRes.result } };
                      }
                  }
              }

              return node;
          }));

          message.destroy();
          if (failCount === 0 && successCount > 0) {
              message.success(`运行成功 (${successCount} 个模型)`);
          } else if (successCount > 0 && failCount > 0) {
              message.warning(`运行完成: ${successCount} 成功, ${failCount} 失败`);
          } else if (failCount > 0) {
              const firstFail = results.find(r => r && !r.success);
              const errorMsg = (firstFail?.error as any)?.response?.data?.detail || (firstFail?.error as any)?.message || "未知错误";
              message.error(`运行失败: ${errorMsg}`);
          } else {
              message.info("没有可运行的完整流程 (请检查数据连接)");
          }

      } catch (error) {
          message.destroy();
          message.error("系统错误");
          console.error(error);
      }
  };

  const handleSave = async () => {
      console.log("Save clicked, name:", workflowName);
      if (!workflowName) {
          message.error("请输入工作流名称");
          return;
      }
      
      // Serialize nodes: strip functions from data
      const serializableNodes = nodes.map(node => ({
          ...node,
          data: {
              ...node.data,
              onChange: undefined, // remove function
              onDelete: undefined // remove function
          }
      }));

      try {
          const res = await saveWorkflow(workflowName, serializableNodes, edges);
          console.log("Save response:", res);
          message.success("保存成功");
          setSaveModalVisible(false);
          // Optional: refresh list if we were displaying it
      } catch (error) {
          console.error("Save error:", error);
          message.error("保存失败");
      }
  };

  const handleLoadList = async () => {
      console.log("Load clicked");
      try {
          const res = await listWorkflows();
          console.log("Workflows loaded:", res);
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
          
          // Restore functions to data
          const restoredNodes = res.nodes.map((node: any) => ({
              ...node,
              data: {
                  ...node.data,
                  onChange: onNodeDataChange,
                  onDelete: onDeleteNode
              }
          }));
          
          setNodes(restoredNodes);
          setEdges(res.edges);
          setLoadModalVisible(false);
          // message.success("加载成功"); // Called by caller if needed, but here is fine too
      } catch (error) {
          message.error("加载工作流失败");
          throw error; // Re-throw for caller handling
      }
  };

  const handleDeleteWorkflow = async (name: string) => {
      try {
          await deleteWorkflow(name);
          message.success("删除成功");
          // Refresh list
          handleLoadList();
      } catch (error) {
          console.error("Delete error:", error);
          message.error("删除失败");
      }
  };

  const handleClear = () => {
      Modal.confirm({
          title: '确认清空画布？',
          content: '这将清除当前所有节点和连接，且无法撤销。',
          onOk() {
              setNodes([]);
              setEdges([]);
              setSelectedNodeId(null);
              message.success("画布已清空");
          }
      });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
  const inputEdge = selectedNode ? edges.find(e => e.target === selectedNode.id) : null;
  const inputNode = inputEdge ? nodes.find(n => n.id === inputEdge.source) || null : null;

  // Helper to find root DataNode for column info
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
        <div style={{ position: 'absolute', zIndex: 1000, right: 20, top: 20, display: 'flex', gap: '8px' }}>
            <Button icon={<ClearOutlined />} onClick={handleClear} type="primary" danger>清空</Button>
            <Button icon={<ReloadOutlined />} onClick={loadLatestWorkflow} loading={initializing}>重载</Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleLoadList}>加载</Button>
            <Button icon={<SaveOutlined />} onClick={() => setSaveModalVisible(true)}>保存</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun}>运行</Button>
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
                            </Popconfirm>
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

    </Layout>
  );
};

export default Workflow;
