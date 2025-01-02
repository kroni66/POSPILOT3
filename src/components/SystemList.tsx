import React from 'react';
import { SystemCardData } from './Dashboard';
import { FiInfo, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import '../styles/SystemList.css';

interface SystemListProps {
  systems: SystemCardData[];
  onDetailsClick: (systemName: string) => void;
  onOpenParser: (systemName: string) => void;
}

const SystemList: React.FC<SystemListProps> = ({ systems, onDetailsClick, onOpenParser }) => {
  return (
    <div className="system-list">
      <div className="system-list__header">
        <span>Name</span>
        <span>Type</span>
        <span>SCO Type</span>
        <span>Architecture</span>
        <span>Status</span>
        <span>Motherboard</span>
        <span>Actions</span>
      </div>
      {systems.map((system, index) => (
        <div key={index} className="system-list__item">
          <span className="system-list__name">{system.name}</span>
          <span className="system-list__type">{system.type}</span>
          <span className="system-list__sco-type">{system.details.SCOType || 'N/A'}</span>
          <span className="system-list__architecture">{system.details.Architecture || 'N/A'}</span>
          <span className={`system-list__status ${system.details.IsOnline ? 'online' : 'offline'}`}>
            {system.details.IsOnline ? (
              <>
                <FiCheckCircle /> Online
              </>
            ) : (
              <>
                <FiXCircle /> Offline
              </>
            )}
          </span>
          {system.type === 'SCO' && (
            <span className="system-list__motherboard">{system.details.Motherboard || 'N/A'}</span>
          )}
          {system.type !== 'SCO' && <span>-</span>}
          <div className="system-list__actions">
            <button onClick={() => onDetailsClick(system.name)} className="system-list__button system-list__button--details">
              <FiInfo /> Details
            </button>
            <button onClick={() => onOpenParser(system.name)} className="system-list__button system-list__button--parser">
              <FiFileText /> Parser
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SystemList;
