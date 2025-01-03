import React, { useState } from 'react';
import NetworkAnalyzer from './NetworkAnalyzer';
import { SystemCardData } from './Dashboard';

interface NetworkAnalyzerModalProps {
  systemCards: SystemCardData[];
}

const NetworkAnalyzerModal: React.FC<NetworkAnalyzerModalProps> = ({ systemCards }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="network-analyzer-modal">
      <button onClick={() => setIsOpen(true)}>Open Network Analyzer</button>
      {isOpen && (
        <NetworkAnalyzer 
          systemCards={systemCards}
          isOpen={isOpen}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default NetworkAnalyzerModal;
