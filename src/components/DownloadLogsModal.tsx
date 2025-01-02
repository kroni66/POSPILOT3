import React, { useState, useEffect } from 'react';
import '../styles/DownloadLogsModal.css';
import LoadingModal from './LoadingModal';
import { FiDownload, FiX } from 'react-icons/fi';
const { ipcRenderer } = window.require('electron');

interface DownloadLogsModalProps {
  systemName: string;
  scoType: string;
  onClose: () => void;
  onOpenParser: (systemName: string) => void; // Add this line
}

interface LogInfo {
  Name: string;
  Size: number;
  ModifiedTime: number;
}

type ArchiveInfo = LogInfo;

const DownloadLogsModal: React.FC<DownloadLogsModalProps> = ({ systemName, scoType, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [archives, setArchives] = useState<ArchiveInfo[]>([]);
  const [selectedArchives, setSelectedArchives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setLoadingProgress(0);
      setError(null);
      try {
        const logPath = `\\\\${systemName}\\c$\\TPDotnet\\TPiScan\\Log`;
        console.log('Fetching logs from:', logPath);
        const result = await ipcRenderer.invoke('fetch-iscan-logs-with-size', logPath);
        console.log('Fetched logs:', result);
        if (Array.isArray(result)) {
          // Sort logs by ModifiedTime in descending order
          const sortedLogs = result.sort((a, b) => b.ModifiedTime - a.ModifiedTime);
          setArchives(sortedLogs);
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

  const handleArchiveToggle = (archiveName: string) => {
    setSelectedArchives(prev => 
      prev.includes(archiveName) 
        ? prev.filter(name => name !== archiveName)
        : [...prev, archiveName]
    );
  };

  const handleSelectAll = () => {
    if (selectedArchives.length === archives.length) {
      setSelectedArchives([]);
    } else {
      setSelectedArchives(archives.map(archive => archive.Name));
    }
  };

  const handleDownload = async () => {
    if (selectedArchives.length > 0) {
      setIsLoading(true);
      setLoadingProgress(0);
      try {
        for (let i = 0; i < selectedArchives.length; i++) {
          const archive = selectedArchives[i];
          await ipcRenderer.invoke('download-log-archive', systemName, scoType, archive);
          setLoadingProgress((i + 1) / selectedArchives.length * 100);
        }
        console.log('Log archives downloaded successfully');
        onClose();
      } catch (error) {
        console.error('Error downloading log archives:', error);
        setError('An error occurred while downloading log archives. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal download-logs-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Download ISCAN Logs for {systemName}</h2>
            <button onClick={onClose} className="close-button">
              <FiX />
            </button>
          </div>
          <div className="modal-content">
            {error ? (
              <div className="error-message">{error}</div>
            ) : isLoading && archives.length === 0 ? (
              <div>Loading archives...</div>
            ) : archives.length === 0 ? (
              <div>No archives found.</div>
            ) : (
              <>
                <div className="archive-list-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedArchives.length === archives.length}
                      onChange={handleSelectAll}
                    />
                    Select All
                  </label>
                  <span>{selectedArchives.length} of {archives.length} selected</span>
                </div>
                <div className="archive-list">
                  {archives.map((archive, index) => (
                    <div key={index} className="archive-item">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedArchives.includes(archive.Name)}
                          onChange={() => handleArchiveToggle(archive.Name)}
                        />
                        {archive.Name} ({(archive.Size / (1024 * 1024)).toFixed(2)} MB)
                      </label>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleDownload} 
                  className="download-button" 
                  disabled={selectedArchives.length === 0 || isLoading}
                >
                  <FiDownload /> {isLoading ? 'Downloading...' : `Download Selected ISCAN Logs (${selectedArchives.length})`}
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

export default DownloadLogsModal;