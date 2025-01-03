import React, { useState, useEffect } from 'react';
import { FlowChartWithState } from '@mrblenny/react-flow-chart';

const NetworkAnalyzer = ({ systemCards }) => {
  const initialState = {
    nodes: {
      tpServer: {
        id: 'tpServer',
        type: 'input-output',
        position: { x: 300, y: 50 },
        ports: {
          port1: { id: 'port1', type: 'input' },
          port2: { id: 'port2', type: 'output' },
        },
      },
    },
    links: {},
    selected: {},
    hovered: {},
  };

  const [chartState, setChartState] = useState(initialState);

  useEffect(() => {
    const newNodes = { ...initialState.nodes };
    const newLinks = { ...initialState.links };

    systemCards.forEach((system, index) => {
      const nodeId = `node${index + 1}`;
      newNodes[nodeId] = {
        id: nodeId,
        type: 'input-output',
        position: { x: 100, y: 150 + index * 100 },
        ports: {
          port1: { id: 'port1', type: 'input' },
          port2: { id: 'port2', type: 'output' },
        },
      };

      const linkId = `link${index + 1}`;
      newLinks[linkId] = {
        id: linkId,
        from: { nodeId, portId: 'port2' },
        to: { nodeId: 'tpServer', portId: 'port1' },
      };
    });

    setChartState({
      nodes: newNodes,
      links: newLinks,
      selected: {},
      hovered: {},
    });
  }, [systemCards]);

  return (
    <div style={{ height: '500px' }}>
      <FlowChartWithState initialValue={chartState} />
    </div>
  );
};

export default NetworkAnalyzer;
