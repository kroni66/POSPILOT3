import React from 'react';
import { FiX } from 'react-icons/fi';
import '../styles/InfoModal.css';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInfo: {
    name: string;
    ipAddress: string;
    hddSpace: string;
    macAddress: string;
    operatingSystem: string;
  };
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, systemInfo }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>System Information</h2>
          <button onClick={onClose} className="close-button">
            <FiX />
          </button>
        </div>
        <div className="modal-content">
          <p><strong>Name:</strong> {systemInfo.name}</p>
          <p><strong>IP Address:</strong> {systemInfo.ipAddress}</p>
          <p><strong>MAC Address:</strong> {systemInfo.macAddress}</p>
          <p><strong>Operating System:</strong> {systemInfo.operatingSystem}</p>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;