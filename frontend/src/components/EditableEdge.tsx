import React from 'react';
import { BaseEdge, getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';

const EditableEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const onDelete = (data as any)?.onDelete;
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
      {selected && (
        <g
          transform={`translate(${labelX} ${labelY})`}
          style={{ cursor: 'pointer' }}
          onClick={handleDelete}
        >
          <circle r={10} fill="#ff4d4f" stroke="#fff" strokeWidth={2} />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            style={{ fill: '#fff', fontSize: 13, fontWeight: 'bold', pointerEvents: 'none', userSelect: 'none' }}
          >
            ×
          </text>
        </g>
      )}
    </>
  );
};

export default EditableEdge;
