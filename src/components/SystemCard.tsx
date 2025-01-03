import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiDownload, FiTrash2, FiInfo, FiMonitor, FiWifi, FiRefreshCw } from 'react-icons/fi';
import DownloadLogsModal from './DownloadLogsModal';
import AdapterLogsModal from './AdapterLogsModal';
import AskModal from './AskModal';
import InfoModal from './InfoModal';
import '../styles/SystemCard.css';
const { ipcRenderer } = window.require('electron');

interface SystemCardProps {
  name: string;
  type: string;
  details: {
    SCOType: string;
    Architecture: string;
    IsOnline: boolean;
    ipAddress?: string;
    Motherboard?: string;
    Printer?: string;
    NetworkAnalyzer?: string; // Add this line
  };
  onDetailsClick: () => void;
  onOpenParser: (systemName: string) => void;
  onOpenVNC: (systemName: string) => void;
}

interface SystemInfo {
  name: string;
  ipAddress: string;
  hddSpace: string;
  macAddress: string;
  operatingSystem: string;
}

const SystemCard: React.FC<SystemCardProps> = ({ name, type, details, onDetailsClick, onOpenParser, onOpenVNC }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdapterLogsModalOpen, setIsAdapterLogsModalOpen] = useState(false);
  const [hasDownloadedLogs, setHasDownloadedLogs] = useState(false);
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    name: name,
    ipAddress: '',
    hddSpace: '',
    macAddress: '',
    operatingSystem: ''
  });
  const [isPinging, setIsPinging] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkForExistingLogs = useCallback(async () => {
    try {
      const iscanLogsExist = await ipcRenderer.invoke('check-iscan-logs-exist', name);
      const adapterLogsExist = await ipcRenderer.invoke('check-adapter-logs-exist', name);
      setHasDownloadedLogs(iscanLogsExist || adapterLogsExist);
    } catch (error) {
      console.error('Error checking for existing logs:', error);
    }
  }, [name]);

  useEffect(() => {
    checkForExistingLogs();
  }, [checkForExistingLogs]);

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    checkForExistingLogs();
  };

  const handleRemoveLogs = async () => {
    try {
      await ipcRenderer.invoke('remove-logs', name);
      setHasDownloadedLogs(false);
      setIsAskModalOpen(false);
    } catch (error) {
      console.error('Error removing logs:', error);
    }
  };

  const handleOpenAdapterLogsModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdapterLogsModalOpen(true);
  };

  const handleCloseAdapterLogsModal = () => {
    setIsAdapterLogsModalOpen(false);
    checkForExistingLogs();
  };

  const handleOpenAskModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAskModalOpen(true);
  };

  const handleOpenVNC = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      onOpenVNC(name);
    } catch (error) {
      console.error('Error opening VNC:', error);
    }
  };

  const handleOpenInfoModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const info = await ipcRenderer.invoke('get-system-info', name);
      setSystemInfo({
        name: name,
        ipAddress: info.ipAddress,
        hddSpace: info.hddSpace,
        macAddress: info.macAddress,
        operatingSystem: info.operatingSystem
      });
      setIsInfoModalOpen(true);
    } catch (error) {
      console.error('Error fetching system info:', error);
      // You might want to show an error message to the user here
    }
  };

  const handlePing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsPinging(true);
      const result = await ipcRenderer.invoke('ping-system', name);
      details.IsOnline = result;
    } catch (error) {
      console.error('Error pinging system:', error);
    } finally {
      setIsPinging(false);
    }
  };

  const toggleAutoRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAutoRefreshing) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    } else {
      // Initial ping
      await handlePing(e);
      // Set up interval
      refreshIntervalRef.current = setInterval(async () => {
        try {
          setIsPinging(true);
          const result = await ipcRenderer.invoke('ping-system', name);
          details.IsOnline = result;
        } catch (error) {
          console.error('Error in auto-refresh:', error);
        } finally {
          setIsPinging(false);
        }
      }, 10000); // 10 seconds
    }
    setIsAutoRefreshing(!isAutoRefreshing);
  };

  return (
    <div className={`system-card system-card--${type.toLowerCase()}`}>
      <div className={`system-card__status-indicator ${details.IsOnline ? 'online' : 'offline'}`}></div>
      <div className="system-card__header">
        <div className="system-card__title-container">
          <h3 className="system-card__title">{name}</h3>
          {details.ipAddress && (
            <span className="system-card__ip">{details.ipAddress}</span>
          )}
        </div>
        <div className="system-card__icons">
          <FiWifi 
            className={`system-card__ping-icon ${isPinging ? 'pinging' : ''}`}
            onClick={handlePing}
            title="Ping system"
          />
          <FiRefreshCw 
            className={`system-card__refresh-icon ${isAutoRefreshing ? 'refreshing' : ''}`}
            onClick={toggleAutoRefresh}
            title={isAutoRefreshing ? "Stop auto-refresh" : "Start auto-refresh (10s)"}
          />
          <FiMonitor 
            className="system-card__vnc-icon" 
            onClick={handleOpenVNC}
            title="Open VNC Viewer"
          />
          <FiInfo 
            className="system-card__info-icon" 
            onClick={handleOpenInfoModal}
            title="View System Info"
          />
          {hasDownloadedLogs && (
            <FiTrash2 
              className="system-card__trash-icon" 
              onClick={handleOpenAskModal}
              title="Remove downloaded logs"
            />
          )}
        </div>
      </div>
      <div className="system-card__content">
        <p className="system-card__detail"><strong>SCO Type:</strong> {details.SCOType}</p>
        <p className="system-card__detail"><strong>Architecture:</strong> {details.Architecture}</p>
        <p className="system-card__detail"><strong>Status:</strong> {details.IsOnline ? 'Online' : 'Offline'}</p>
        {type === 'SCO' && details.Motherboard && (
          <>
            <p className="system-card__detail"><strong>Motherboard:</strong> {details.Motherboard}</p>
            {details.Printer && (
              <p className="system-card__detail"><strong>Printer:</strong> {details.Printer}</p>
            )}
          </>
        )}
        {details.NetworkAnalyzer && ( // Add this block
          <p className="system-card__detail"><strong>Network Analyzer:</strong> {details.NetworkAnalyzer}</p>
        )}
      </div>
      <div className="system-card__footer">
        {type === 'SCO' && (
          <>
            <div className="system-card__button-group">
              <button className="system-card__button system-card__button--primary" onClick={handleOpenModal}>
                <FiDownload /> ISCAN
              </button>
            </div>
            <div className="system-card__button-group">
              <button className="system-card__button system-card__button--primary" onClick={handleOpenAdapterLogsModal}>
                <FiDownload /> Adapter
              </button>
            </div>
          </>
        )}
      </div>
      {isModalOpen && (
        <DownloadLogsModal
          systemName={name}
          scoType={details.SCOType}
          onClose={handleCloseModal}
          onOpenParser={onOpenParser}  // Add this line
        />
      )}
      {isAdapterLogsModalOpen && (
        <AdapterLogsModal
          systemName={name}
          onClose={handleCloseAdapterLogsModal}
          onOpenParser={onOpenParser}
        />
      )}
      <AskModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        onConfirm={handleRemoveLogs}
        message={`Jste si jisti, že chcete smazat soubory  ${name}?`}
      />
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        systemInfo={{
          name: name,
          ipAddress: systemInfo?.ipAddress || '',
          macAddress: systemInfo?.macAddress || '',
          operatingSystem: systemInfo?.operatingSystem || '',
          hddSpace: '' // Add this property with an empty string as a default value
        }}
      />
    </div>
  );
};

export default React.memo(SystemCard);
