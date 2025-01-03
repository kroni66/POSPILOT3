import React, { useState, useEffect } from 'react';
import { FlowChartWithState, IChart, IPosition } from '@mrblenny/react-flow-chart';
import { SystemCardData } from './Dashboard';
import { FiX } from 'react-icons/fi';
import '../styles/NetworkAnalyzer.css';

interface NetworkAnalyzerProps {
  systemCards: SystemCardData[];
  isOpen: boolean;
  onClose: () => void;
}

interface ChartNodes {
  [key: string]: {
    id: string;
    type: string;
    position: {
      x: number;
      y: number;
    };
    ports: {
      [key: string]: {
        id: string;
        type: string;
      };
    };
  };
}

interface ChartLinks {
  [key: string]: {
    id: string;
    from: {
      nodeId: string;
      portId: string;
    };
    to: {
      nodeId: string;
      portId: string;
    };
  };
}

interface ChartState extends IChart {
  nodes: ChartNodes;
  links: ChartLinks;
  offset: IPosition;
  scale: number;
  selected: {};
  hovered: {};
}

const NetworkAnalyzer: React.FC<NetworkAnalyzerProps> = ({ systemCards, isOpen, onClose }) => {
  if (!isOpen) return null;

  const initialState: ChartState = {
    offset: { x: 0, y: 0 },
    scale: 1,
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

  const [chartState, setChartState] = useState<ChartState>(initialState);

  useEffect(() => {
    const newNodes: ChartNodes = { ...initialState.nodes };
    const newLinks: ChartLinks = { ...initialState.links };

    systemCards.forEach((system: SystemCardData, index: number) => {
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
      ...initialState,
      nodes: newNodes,
      links: newLinks,
    });
  }, [systemCards]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="network-analyzer-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Network Analyzer</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className="modal-content">
          <div className="flow-chart-container">
            <FlowChartWithState initialValue={chartState} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkAnalyzer;
