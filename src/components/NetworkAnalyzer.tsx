import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import '../styles/NetworkAnalyzer.css';

interface NetworkAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NetworkAnalyzer: React.FC<NetworkAnalyzerProps> = ({ isOpen, onClose }) => {
  const [networkData, setNetworkData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchNetworkData();
    }
  }, [isOpen]);

  const fetchNetworkData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace with actual network data fetching logic
      const data = await new Promise<any[]>((resolve) =>
        setTimeout(() => resolve([{ id: 1, name: 'Network 1' }, { id: 2, name: 'Network 2' }]), 2000)
      );
      setNetworkData(data);
    } catch (err) {
      setError('Failed to fetch network data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="network-analyzer-overlay" onClick={onClose}>
      <div className="network-analyzer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="network-analyzer-header">
          <h2>Network Analyzer</h2>
          <button onClick={onClose} className="close-button">
            <FiX />
          </button>
        </div>
        <div className="network-analyzer-content">
          {isLoading ? (
            <div>Loading network data...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <ul>
              {networkData.map((network) => (
                <li key={network.id}>{network.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkAnalyzer;
