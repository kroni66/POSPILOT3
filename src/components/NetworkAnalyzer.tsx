import React, { useState } from 'react';
import { FlowChartWithState } from '@mrblenny/react-flow-chart';

const NetworkAnalyzer = () => {
  const initialState = {
    nodes: {
      node1: {
        id: 'node1',
        type: 'input-output',
        position: { x: 100, y: 100 },
        ports: {
          port1: { id: 'port1', type: 'input' },
          port2: { id: 'port2', type: 'output' },
        },
      },
      node2: {
        id: 'node2',
        type: 'input-output',
        position: { x: 400, y: 100 },
        ports: {
          port1: { id: 'port1', type: 'input' },
          port2: { id: 'port2', type: 'output' },
        },
      },
    },
    links: {
      link1: {
        id: 'link1',
        from: { nodeId: 'node1', portId: 'port2' },
        to: { nodeId: 'node2', portId: 'port1' },
      },
    },
    selected: {},
    hovered: {},
  };

  const [chartState, setChartState] = useState(initialState);

  const handleNodeLink = (fromNode, toNode) => {
    const newLinkId = `link${Object.keys(chartState.links).length + 1}`;
    const newLink = {
      id: newLinkId,
      from: { nodeId: fromNode.id, portId: fromNode.ports.port2.id },
      to: { nodeId: toNode.id, portId: toNode.ports.port1.id },
    };

    setChartState((prevState) => ({
      ...prevState,
      links: {
        ...prevState.links,
        [newLinkId]: newLink,
      },
    }));
  };

  return (
    <div style={{ height: '500px' }}>
      <FlowChartWithState initialValue={chartState} />
    </div>
  );
};

export default NetworkAnalyzer;
