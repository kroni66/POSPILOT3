import React, { useState, useEffect } from 'react';
import { FiUpload } from 'react-icons/fi';
import '../styles/PluginManager.css';
const { ipcRenderer } = window.require('electron');

const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const loadedPlugins = await ipcRenderer.invoke('load-plugins');
      setPlugins(loadedPlugins);
    } catch (err) {
      setError(`Error loading plugins: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLoadPlugin = async (pluginName: string) => {
    try {
      await ipcRenderer.invoke('load-plugin', pluginName);
      loadPlugins();
    } catch (err) {
      setError(`Error loading plugin: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="plugin-manager">
      <h1>Plugin Manager</h1>
      {error && <div className="plugin-manager__error">{error}</div>}
      <div className="plugin-manager__controls">
        <button className="plugin-manager__button" onClick={loadPlugins}>
          <FiUpload /> Load Plugins
        </button>
      </div>
      <div className="plugin-manager__list">
        {plugins.length > 0 ? (
          plugins.map((plugin, index) => (
            <div key={index} className="plugin-manager__item">
              <span>{plugin}</span>
              <button
                className="plugin-manager__load-button"
                onClick={() => handleLoadPlugin(plugin)}
              >
                Load
              </button>
            </div>
          ))
        ) : (
          <div className="plugin-manager__no-plugins">No plugins loaded</div>
        )}
      </div>
    </div>
  );
};

export default PluginManager;
