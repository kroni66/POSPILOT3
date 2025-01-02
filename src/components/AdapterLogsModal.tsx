import React, { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
const { ipcRenderer } = window.require('electron');
import LoadingModal from './LoadingModal';
import '../styles/AdapterLogsModal.css'; // Import the new CSS file

interface AdapterLogsModalProps {
  systemName: string;
  onClose: () => void;
  onOpenParser: (systemName: string) => void;
}

interface LogInfo {
  Name: string;
  Size: number;
  ModifiedTime: number; // Add this line
}

const AdapterLogsModal: React.FC<AdapterLogsModalProps> = ({ systemName, onClose, onOpenParser }) => {
  const [logs, setLogs] = useState<LogInfo[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);
      try {
        const logPath = `\\\\${systemName}\\c$\\TPDotnet\\TPiScan\\Log`;
        console.log('Fetching logs from:', logPath);
        const result = await ipcRenderer.invoke('fetch-adapter-logs-with-size', logPath);
        console.log('Fetched logs:', result);
        if (Array.isArray(result)) {
          // Sort logs by ModifiedTime in descending order
          const sortedLogs = result.sort((a, b) => b.ModifiedTime - a.ModifiedTime);
          setLogs(sortedLogs);
        } else {
          setError('Failed to fetch logs. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        setError(`An error occurred while fetching logs: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [systemName]);

  const handleLogToggle = (logName: string) => {
    setSelectedLogs(prev => 
      prev.includes(logName) 
        ? prev.filter(name => name !== logName)
        : [...prev, logName]
    );
  };

  const handleSelectAll = () => {
    if (selectedLogs.length === logs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(logs.map(log => log.Name));
    }
  };

  const handleDownload = async () => {
    if (selectedLogs.length > 0) {
      setIsLoading(true);
      setLoadingProgress(0);
      try {
        for (let i = 0; i < selectedLogs.length; i++) {
          const log = selectedLogs[i];
          const logPath = `\\\\${systemName}\\c$\\TPDotnet\\TPiScan\\Log\\${log}`;
          await ipcRenderer.invoke('download-adapter-log', logPath, systemName);
          setLoadingProgress((i + 1) / selectedLogs.length * 100);
        }
        console.log('Logs downloaded successfully');
        onOpenParser(systemName); // This will now open the PosAdapterParser
        onClose();
      } catch (error) {
        console.error('Error downloading adapter logs:', error);
        setError('An error occurred while downloading logs. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal adapter-logs-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Download Adapter Logs for {systemName}</h2>
            <button onClick={onClose} className="close-button">
              <FiX />
            </button>
          </div>
          <div className="modal-content">
            {error ? (
              <div className="error-message">{error}</div>
            ) : isLoading && logs.length === 0 ? (
              <div>Loading logs...</div>
            ) : logs.length === 0 ? (
              <div>No logs found.</div>
            ) : (
              <>
                <div className="log-list-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedLogs.length === logs.length}
                      onChange={handleSelectAll}
                    />
                    Select All
                  </label>
                  <span>{selectedLogs.length} of {logs.length} selected</span>
                </div>
                <div className="log-list">
                  {logs.map((log, index) => (
                    <div key={index} className="log-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedLogs.includes(log.Name)}
                          onChange={() => handleLogToggle(log.Name)}
                        />
                        {log.Name} ({(log.Size / (1024 * 1024)).toFixed(2)} MB)
                      </label>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleDownload} 
                  className="download-button" 
                  disabled={selectedLogs.length === 0 || isLoading}
                >
                  <FiDownload /> {isLoading ? 'Downloading...' : `Download Selected Adapter Logs (${selectedLogs.length})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <LoadingModal 
        isOpen={isLoading} 
        progress={loadingProgress} 
        onCancel={() => setIsLoading(false)} 
      />
    </>
  );
};

export default AdapterLogsModal;