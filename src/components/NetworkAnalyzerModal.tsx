import React, { useState } from 'react';
import NetworkAnalyzer from './NetworkAnalyzer';

const NetworkAnalyzerModal = ({ systemCards }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open Network Analyzer</button>
      {isOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <button onClick={handleClose} className="close-button">Close</button>
            <NetworkAnalyzer systemCards={systemCards} />
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkAnalyzerModal;
