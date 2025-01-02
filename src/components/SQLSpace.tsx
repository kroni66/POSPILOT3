import React, { useState, useEffect } from 'react';
import { FaDatabase, FaExclamationTriangle, FaSyncAlt, FaPlus, FaTimes } from 'react-icons/fa';

const { ipcRenderer } = window.require('electron');

interface SqlSpaceData {
  DatabaseName?: string;
  DatabaseSizeMB?: number;
  LogSizeMB?: number;
  SpaceUsedMB?: number;
  FreeSpaceMB?: number;
  FreeSpacePercent?: number;
}

const SQLSpace: React.FC = () => {
  const [sqlSpaceData, setSqlSpaceData] = useState<Record<string, SqlSpaceData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [newServer, setNewServer] = useState<string>('');

  const fetchSQLSpaceData = async (server: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching SQL space data for server:', server);
      const result = await ipcRenderer.invoke('get-sql-space', server);
      console.log('Received SQL space data:', result);
      if (result === null || Object.keys(result).length === 0) {
        throw new Error('No data received from the server');
      }
      const parsedResult: SqlSpaceData = typeof result === 'string' ? JSON.parse(result) : result;
      setSqlSpaceData(prevData => ({ ...prevData, [server]: parsedResult }));
    } catch (err: any) {
      console.error('Error fetching SQL space data:', err);
      setError('Failed to fetch SQL space data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = () => {
    if (newServer && !selectedServers.includes(newServer)) {
      setSelectedServers([...selectedServers, newServer]);
      fetchSQLSpaceData(newServer);
      setNewServer('');
    }
  };

  const handleRemoveServer = (server: string) => {
    setSelectedServers(selectedServers.filter(s => s !== server));
    setSqlSpaceData(prevData => {
      const newData = { ...prevData };
      delete newData[server];
      return newData;
    });
  };

  const handleRefresh = () => {
    selectedServers.forEach(server => fetchSQLSpaceData(server));
  };

  const renderProgressBar = (usedSpace: number | undefined, totalSpace: number | undefined) => {
    const percentage = usedSpace && totalSpace ? (usedSpace / totalSpace) * 100 : 0;
    return (
      <div className="sql-space__progress-bar">
        <div className="sql-space__progress-fill" style={{ width: `${percentage}%` }}></div>
      </div>
    );
  };

  return (
    <div className="sql-space">
      <h2 className="sql-space__title">SQL Space Information</h2>
      <div className="sql-space__controls">
        <input
          type="text"
          value={newServer}
          onChange={(e) => setNewServer(e.target.value)}
          placeholder="Enter TP server name"
          className="sql-space__input"
        />
        <button onClick={handleAddServer} className="sql-space__add-button">
          <FaPlus /> Add Server
        </button>
        <button onClick={handleRefresh} className="sql-space__refresh-button">
          <FaSyncAlt /> Refresh All
        </button>
      </div>
      {loading && <div className="sql-space__loading">Loading SQL space data...</div>}
      {error && <div className="sql-space__error"><FaExclamationTriangle /> Error: {error}</div>}
      <div className="sql-space__grid">
        {selectedServers.map(server => (
          <div key={server} className="sql-space__card">
            <div className="sql-space__card-header">
              <h3>{server}</h3>
              <button onClick={() => handleRemoveServer(server)} className="sql-space__remove-button">
                <FaTimes />
              </button>
            </div>
            {sqlSpaceData[server] ? (
              <>
                <div className="sql-space__item">
                  <FaDatabase className="sql-space__icon" />
                  <p>Database: {sqlSpaceData[server].DatabaseName || 'N/A'}</p>
                  <p>Total Size: {sqlSpaceData[server].DatabaseSizeMB?.toFixed(2) || 'N/A'} MB</p>
                  <p>Log Size: {sqlSpaceData[server].LogSizeMB?.toFixed(2) || 'N/A'} MB</p>
                  <p>Space Used: {sqlSpaceData[server].SpaceUsedMB?.toFixed(2) || 'N/A'} MB</p>
                  <p>Free Space: {sqlSpaceData[server].FreeSpaceMB?.toFixed(2) || 'N/A'} MB</p>
                  <p>Free Space %: {sqlSpaceData[server].FreeSpacePercent?.toFixed(2) || 'N/A'}%</p>
                  {renderProgressBar(sqlSpaceData[server].SpaceUsedMB, sqlSpaceData[server].DatabaseSizeMB)}
                </div>
              </>
            ) : (
              <div className="sql-space__loading">Loading data for {server}...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SQLSpace;