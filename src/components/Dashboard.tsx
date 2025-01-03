import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import ISCANParser, { ISCANParserProps } from './ISCANParser';
import SQLSpace from './SQLSpace';
import LoadingModal from './LoadingModal';
import PosAdapterParser, { PosAdapterParserProps, PosAdapterParserState } from './PosAdapterParser';
import { FiBell, FiSun, FiMoon, FiGrid, FiList, FiRefreshCw, FiMonitor, FiInfo } from 'react-icons/fi';
import SystemCard from './SystemCard';
import SystemList from './SystemList';
import TPiSCAN from './TPiSCAN';
import XMLValidatorComponent from './XMLValidator';
import DownloadLogsModal from './DownloadLogsModal';
import VNCModal from './VNCModal';
import LoginScreen from './LoginScreen';
import NotificationsCenter from './NotificationsCenter';
import NetworkAnalyzer from './NetworkAnalyzer'; // P0cad
const { ipcRenderer } = window.require('electron');
import '../styles/Dashboard.css';
import { VncScreen } from 'react-vnc';





export interface SystemCardData {
  name: string;
  type: string;
  details: {
    SCOType: string;
    Architecture: string;
    IsOnline: boolean;
    ipAddress?: string;
    Motherboard?: string;
    Printer?: string;
  };
}

// Add this near the top of the file, after other interfaces
interface Suggestion {
  id: string;
  name: string;
}

// Update the SystemCard component props interface
interface SystemCardProps extends SystemCardData {
  onDetailsClick: () => void;
  onOpenParser: (systemName: string) => void;
  onOpenVNC?: (systemName: string) => void;
}

interface RFBOptions {
  shared?: boolean;
  credentials?: {
    username?: string;
    password?: string;
    target?: string;
  };
  repeaterID?: string;
  wsProtocols?: string | string[];
}

// Update the Result type definition
type Result = {
  success: boolean;
  scoName: string; // Add this line
  message: string;
  // other properties...
};

// Add to the existing interfaces at the top
interface DashboardProps {
  onLogout: () => void;
}

// Update the notification interface
interface Notification {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
  timestamp: Date;
}

// Update the Dashboard component definition
const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [activeMenuItem, setActiveMenuItem] = useState<string>('Dashboard');
  const [selectedTP, setSelectedTP] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [tpInput, setTpInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('en');
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [systemCards, setSystemCards] = useState<SystemCardData[]>([]);
  const [systems, setSystems] = useState<SystemCardData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<SystemCardData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [selectedSystemName, setSelectedSystemName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [posAdapterState, setPosAdapterState] = useState<PosAdapterParserState>({
    systemName: '',
    parsedData: [],
    filteredData: [],
    searchTerm: '',
    sortConfig: { key: '', direction: null },
    isLoading: false,
    loadingProgress: 0,
    scoNames: [],
    selectedScoName: '',
    logContents: {},
    selectedFiles: [],
    parserHeight: 300,
    rawLogContent: '',
    editorHeight: 300,
    isAddLogModalOpen: false,
    highlightedLine: null
  });
  const [isVNCMode, setIsVNCMode] = useState(false);
  const [vncConnections, setVncConnections] = useState<{ [key: string]: { url: string, password: string } }>({});
  const [vncError, setVncError] = useState<string | null>(null);
  const [activeVNCModal, setActiveVNCModal] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [vncConnectionProgress, setVncConnectionProgress] = useState<{ [key: string]: number }>({});
  const [showChangelog, setShowChangelog] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isVNCModalOpen, setIsVNCModalOpen] = useState(false); // Pfb2a
  const [showNetworkAnalyzer, setShowNetworkAnalyzer] = useState(false); // P51f4

  // Add this function to generate suggestions
  const generateSuggestions = (input: string) => {
    const tpServers = Array.from({ length: 1000 }, (_, i) => `TP${String(i + 1).padStart(4, '0')}`);
    const filtered = tpServers
      .filter(server => server.toLowerCase().includes(input.toLowerCase()))
      .map(server => ({ id: server, name: server }));
    setSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
    setShowSuggestions(filtered.length > 0);
  };

  // Add some testing system cards
  const testSystemCards: SystemCardData[] = [
    {
      name: 'POS1001',
      type: 'POS',
      details: {
        SCOType: 'N/A',
        Architecture: 'N/A',
        IsOnline: false,
        Motherboard: 'N/A'
      }
    },
    {
      name: 'SCO1002',
      type: 'SCO',
      details: {
        SCOType: 'FASTLANE',
        Architecture: 'x64',
        IsOnline: true,
        Motherboard: 'Intel ABC123'
      }
    },
    {
      name: 'SCO1003',
      type: 'SCO',
      details: {
        SCOType: 'HYBRID',
        Architecture: 'x86',
        IsOnline: true
      }
    },
    {
      name: 'SCO1004',
      type: 'SCO',
      details: {
        SCOType: 'HYBRID',
        Architecture: 'x86',
        IsOnline: true
      }
    },
    {
      name: 'SCO1005',
      type: 'SCO',
      details: {
        SCOType: 'HYBRID',
        Architecture: 'x86',
        IsOnline: true
      }
    }
  ];

  useEffect(() => {
    // Set the test system cards and generate notifications for them
    setSystemCards(testSystemCards);
    
    // Generate notifications for test system cards
    const newNotifications: Notification[] = [];
    
    testSystemCards.forEach((card, i) => {
      if (!card.details.IsOnline) {
        newNotifications.push({
          id: Date.now() + i,
          message: `${card.name} is offline`,
          type: 'error',
          timestamp: new Date()
        });
      }

      if (card.type === 'SCO') {
        if (card.details.SCOType === 'Not Available') {
          newNotifications.push({
            id: Date.now() + i + 1000,
            message: `${card.name}: SCO Type not available`,
            type: 'warning',
            timestamp: new Date()
          });
        }
        if (card.details.Architecture === 'Not Available') {
          newNotifications.push({
            id: Date.now() + i + 2000,
            message: `${card.name}: Architecture not available`,
            type: 'warning',
            timestamp: new Date()
          });
        }
      }

      if (card.details.Motherboard === 'Not Available' || card.details.Motherboard === 'N/A') {
        newNotifications.push({
          id: Date.now() + i + 3000,
          message: `${card.name}: Motherboard information not available`,
          type: 'info',
          timestamp: new Date()
        });
      }

      if (card.details.Printer === 'Not Available' || card.details.Printer === null) {
        newNotifications.push({
          id: Date.now() + i + 4000,
          message: `${card.name}: Printer information not available`,
          type: 'info',
          timestamp: new Date()
        });
      }
    });

    // Add notifications and show the panel if there are any
    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev]);
      setShowNotifications(true);
    }
  }, []); // Empty dependency array means this runs once on component mount

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleTPChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    setTpInput(value);
    generateSuggestions(value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setTpInput(suggestion);
    setShowSuggestions(false);
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(event.target.value);
  };

  // Add function to clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    setSystemCards([]);
    setNotifications([]); // Clear existing notifications
    setShowNotifications(false);
    setUnreadNotificationsCount(0);

    try {
      const tpNumber = tpInput.replace('TP', '');
      let filter: string;

      if (selectedType === '') {
        filter = `Name -like 'POS${tpNumber}*' -or Name -like 'SCO${tpNumber}*'`;
      } else {
        filter = `Name -like '${selectedType}${tpNumber}*'`;
      }

      const result = await ipcRenderer.invoke('run-powershell-script', filter, tpInput);
      console.log('Search result:', result);

      if (!result) {
        throw new Error('No results returned from the PowerShell script.');
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(result);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        console.error('Raw result:', result);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown JSON parsing error';
        throw new Error(`Failed to parse result: ${errorMessage}`);
      }

      const resultArray = Array.isArray(parsedResult) ? parsedResult : [parsedResult];
      const newNotifications: Notification[] = [];

      // Load system cards one by one with typed notifications
      for (let i = 0; i < resultArray.length; i++) {
        const system = resultArray[i];
        const card: SystemCardData = {
          name: system.Name,
          type: system.Type,
          details: {
            SCOType: system.Type === 'SCO' ? (system.SCOType || 'Not Available') : 'N/A',
            Architecture: system.Type === 'SCO' ? (system.Architecture || 'Not Available') : 'N/A',
            IsOnline: system.IsOnline || false,
            ipAddress: system.ipAddress || 'Not Available',
            Motherboard: system.Motherboard || 'Not Available',
            Printer: system.Printer || 'Not Available'
          }
        };

        // Check for issues and create typed notifications
        if (!card.details.IsOnline) {
          newNotifications.push({
            id: Date.now() + i,
            message: `${card.name} is offline`,
            type: 'error',
            timestamp: new Date()
          });
        }

        if (card.type === 'SCO') {
          if (card.details.SCOType === 'Not Available') {
            newNotifications.push({
              id: Date.now() + i + 1000,
              message: `${card.name}: SCO Type not available`,
              type: 'warning',
              timestamp: new Date()
            });
          }
          if (card.details.Architecture === 'Not Available') {
            newNotifications.push({
              id: Date.now() + i + 2000,
              message: `${card.name}: Architecture not available`,
              type: 'warning',
              timestamp: new Date()
            });
          }
        }

        if (card.details.Motherboard === 'Not Available') {
          newNotifications.push({
            id: Date.now() + i + 3000,
            message: `${card.name}: Motherboard information not available`,
            type: 'info',
            timestamp: new Date()
          });
        }

        if (card.details.Printer === 'Not Available') {
          newNotifications.push({
            id: Date.now() + i + 4000,
            message: `${card.name}: Printer information not available`,
            type: 'info',
            timestamp: new Date()
          });
        }

        setSystemCards(prevCards => [...prevCards, card]);
        setLoadingProgress((i + 1) / resultArray.length * 100);
      }

      // Update notifications without showing panel
      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev]);
        setUnreadNotificationsCount(newNotifications.length);
      }

    } catch (error) {
      console.error('Search error:', error);
      setNotifications(prev => [{
        id: Date.now(),
        message: `Search error: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        timestamp: new Date()
      }]);
      setUnreadNotificationsCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuItemClick = useCallback((menuItem: string) => {
    setActiveMenuItem(menuItem);
    if (menuItem !== 'POS Adapter Parser') {
      setSelectedSystemName(null);
    }
  }, []);

  const handlePosAdapterStateChange = useCallback((newState: Partial<PosAdapterParserState>) => {
    setPosAdapterState(prevState => ({
      ...prevState,
      ...newState,
    }));
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value);
  };

  const handleCancelLoading = () => {
    setIsLoading(false);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
    // Hide notifications panel if there are no more notifications
    setNotifications(prev => {
      if (prev.length === 0) {
        setShowNotifications(false);
      }
      return prev;
    });
  };

  const handleDetailsClick = (cardName: string) => {
    // Implement the details click logic here
    console.log(`Details clicked for ${cardName}`);
  };

  const handleOpenModal = (system: SystemCardData) => {
    setSelectedSystem(system);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSystem(null);
  };

  const handleViewAdapter = (systemName: string) => {
    setSelectedComponent('PosAdapterParser');
    setSelectedSystem({ name: systemName, type: '', details: { SCOType: '', Architecture: '', IsOnline: false, Motherboard: '', Printer: '' } });
  };

  const handleViewISCAN = (systemName: string) => {
    setSelectedComponent('ISCANParser');
    setSelectedSystem({ name: systemName, type: '', details: { SCOType: '', Architecture: '', IsOnline: false, Motherboard: '', Printer: '' } });
  };

  const handleOpenISCAN = (systemName: string) => {
    setActiveMenuItem('iSCAN Parser');
    setSelectedSystemName(systemName);
  };

  const handleOpenAdapter = (systemName: string) => {
    setActiveMenuItem('POS Adapter Parser');
    setSelectedSystemName(systemName);
  };

  const toggleViewMode = useCallback(() => {
    setViewMode(prevMode => prevMode === 'card' ? 'list' : 'card');
  }, []);

  // Add this useEffect to hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleOpenParser = (systemName: string) => {
    setActiveMenuItem('POS Adapter Parser');
    setSelectedSystemName(systemName);
  };

  const handleVNCMode = async () => {
    setIsVNCMode(!isVNCMode);
    setVncError(null);
    if (!isVNCMode) {
      const allSystems = systemCards;
      const newConnections: { [key: string]: { url: string, password: string } } = {};
      const errors: string[] = [];
      for (const system of allSystems) {
        try {
          console.log(`Attempting to connect to ${system.name}`);
          const result = await ipcRenderer.invoke('connect-vnc', system.name);
          if (result.success) {
            newConnections[system.name] = { 
              url: result.url, 
              password: system.type === 'SCO' ? 'sco' : 'adminWN*'
            };
            console.log(`Successfully connected to ${system.name}`);
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          console.error(`Failed to connect to ${system.name}:`, error);
          errors.push(`${system.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      setVncConnections(newConnections);
      if (errors.length > 0) {
        setVncError(`Failed to connect to some systems:\n${errors.join('\n')}`);
      }
    } else {
      // Disconnect all VNC connections
      for (const systemName of Object.keys(vncConnections)) {
        try {
          await ipcRenderer.invoke('disconnect-vnc', systemName);
        } catch (error) {
          console.error(`Failed to disconnect from ${systemName}:`, error);
        }
      }
      setVncConnections({});
    }
  };

  const toggleVNCMode = () => {
    setIsVNCMode(!isVNCMode);
  };

  const handleVNCIconClick = async (systemName: string) => {
    try {
      const system = systemCards.find(card => card.name === systemName);
      if (!system) return;

      setIsLoading(true);
      const result = await ipcRenderer.invoke('connect-vnc', systemName);
      
      if (result.success) {
        const connection = {
          url: result.url,
          password: system.type === 'SCO' ? 'sco' : 'adminWN*'
        };
        
        setVncConnections(prev => ({
          ...prev,
          [systemName]: connection
        }));
        setActiveVNCModal(systemName);
      } else {
        throw new Error(result.error || 'Failed to establish VNC connection');
      }
    } catch (error) {
      console.error(`Failed to connect to ${systemName}:`, error);
      setVncError(`Failed to connect to ${systemName}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseVNCModal = async () => {
    // Simply close the modal without disconnecting VNC
    setActiveVNCModal(null);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const toggleChangelog = () => {
    setShowChangelog(!showChangelog);
  };

  // Add refresh connection handler
  const handleRefreshVNCConnection = async (systemName: string) => {
    try {
      setVncConnectionProgress(prev => ({
        ...prev,
        [systemName]: 0
      }));

      const result = await ipcRenderer.invoke('connect-vnc', systemName);
      if (result.success) {
        const system = systemCards.find(card => card.name === systemName);
        const connection = {
          url: result.url,
          password: system?.type === 'SCO' ? 'sco' : 'adminWN*'
        };
        
        setVncConnections(prev => ({
          ...prev,
          [systemName]: connection
        }));
      } else {
        throw new Error(result.error || 'Failed to refresh VNC connection');
      }
    } catch (error) {
      console.error(`Failed to refresh VNC connection for ${systemName}:`, error);
      setVncError(`Failed to refresh connection to ${systemName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Add notification bell click handler
  const handleNotificationBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setUnreadNotificationsCount(0); // Clear count when opening panel
    }
  };

  // Update the addNotification function
  const addNotification = (message: string, type: 'error' | 'warning' | 'success' | 'info' = 'info') => {
    const newNotification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadNotificationsCount(prev => prev + 1);
  };

  const handleVNCModalToggle = () => { // Pb4ac
    setIsVNCModalOpen(!isVNCModalOpen);
  };

  const toggleNetworkAnalyzer = () => { // P0204
    setShowNetworkAnalyzer(!showNetworkAnalyzer);
  };

  // Return login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="dashboard">
      <Sidebar
        activeMenuItem={activeMenuItem}
        onMenuItemClick={handleMenuItemClick}
        className={isSidebarHidden ? 'hidden' : ''}
      />
      <div className="dashboard-content">
        <div className="top-right-controls">
          <button className="view-toggle-btn" onClick={toggleViewMode} title="Toggle View Mode">
            {viewMode === 'card' ? <FiList /> : <FiGrid />}
          </button>
          <button className="theme-toggle-btn" onClick={toggleDarkMode} title="Toggle Dark Mode">
            {isDarkMode ? <FiSun /> : <FiMoon />}
          </button>
          <div className="notification-bell-container">
            <button 
              className="notification-bell-button" 
              onClick={handleNotificationBellClick}
              title="Notifications"
            >
              <FiBell />
              {unreadNotificationsCount > 0 && (
                <span className="notification-badge">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {activeMenuItem === 'Dashboard' && (
          <div className="dashboard-main">
            <div className="dashboard-header">
              <h1>
                Dashboard
                <button 
                  className="changelog-button"
                  onClick={toggleChangelog}
                  title="View Changelog"
                >
                  <FiInfo />
                </button>
                <button 
                  className="vnc-toggle-button" 
                  onClick={handleVNCModalToggle} 
                  title="Toggle VNC Modal" // P6d18
                >
                  VNC
                </button>
                <button 
                  className="network-analyzer-toggle-button" 
                  onClick={toggleNetworkAnalyzer} 
                  title="Toggle Network Analyzer" // P0204
                >
                  Network Analyzer
                </button>
              </h1>
              {showChangelog && (
                <div className="changelog-panel">
                  <div className="changelog-header">
                    <h3>Changelog</h3>
                    <button 
                      className="changelog-close"
                      onClick={toggleChangelog}
                    >
                      ×
                    </button>
                  </div>
                  <div className="changelog-content">
                    <div className="changelog-entry">
                      <h4>Version 1.0.0 (Current)</h4>
                      <ul>
                        <li>Added VNC connection progress indicator</li>
                        <li>Implemented notification system for offline systems</li>
                        <li>Added dark mode support</li>
                        <li>Added multi-language support</li>
                      </ul>
                    </div>
                    <div className="changelog-entry">
                      <h4>Version 0.9.0</h4>
                      <ul>
                        <li>Added POS Adapter log download feature</li>
                        <li>Implemented system search functionality</li>
                        <li>Added system cards view</li>
                      </ul>
                    </div>
                    <div className="changelog-entry">
                      <h4>Version 0.8.0</h4>
                      <ul>
                        <li>Initial release with basic functionality</li>
                        <li>Basic system monitoring features</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dashboard-search">
              <div className="search-inputs">
                <div className="search-input-wrapper">s
                  <input
                    type="text"
                    placeholder="Zadejte TP server (např. TP0017)"
                    value={tpInput}
                    onChange={handleTPChange}
                    className="search-input"
                  />
                  {showSuggestions && (
                    <ul className="suggestions-list">
                      {suggestions.map((suggestion) => (
                        <li
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion.name)}
                        >
                          {suggestion.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="search-select-wrapper">
                  <select 
                    value={selectedType} 
                    onChange={handleTypeChange}
                    className="search-select"
                  >
                    <option value="">All Types</option>
                    <option value="POS">POS</option>
                    <option value="SCO">SCO</option>
                  </select>
                </div>
                <button onClick={handleSearch} disabled={isLoading || !tpInput} className="search-button">
                  Search
                </button>
                <button 
                  onClick={handleVNCMode} 
                  disabled={isLoading || systemCards.length === 0} 
                  className={`vnc-mode-button ${isVNCMode ? 'active' : ''}`}
                >
                  {isVNCMode ? 'Exit VNC Mode' : 'VNC Mode'}
                </button>
              </div>
            </div>
            <div className="system-cards-container">
              {isVNCMode ? (
                // VNC Grid Mode
                <div className="vnc-grid">
                  {Object.entries(vncConnections).map(([systemName, { url, password }]) => {
                    const system = systemCards.find(card => card.name === systemName);
                    const connectionProgress = vncConnectionProgress[systemName] || 0;
                    
                    return system ? (
                      <div key={systemName} className="vnc-item">
                        <div className="vnc-item-header">
                          <h4>{systemName}</h4>
                          <span className="vnc-system-type">{system.type}</span>
                          <div className="vnc-controls">
                            <FiRefreshCw 
                              className="vnc-refresh-icon" 
                              title="Refresh VNC connection" 
                              onClick={() => handleRefreshVNCConnection(systemName)}
                            />
                            <FiMonitor 
                              className="vnc-monitor-icon" 
                              title="Open VNC in full screen" 
                              onClick={() => handleVNCIconClick(systemName)}
                            />
                          </div>
                        </div>
                        {connectionProgress < 100 && (
                          <div className="vnc-progress-container">
                            <div 
                              className="vnc-progress-bar" 
                              style={{ width: `${connectionProgress}%` }}
                            />
                            <span className="vnc-progress-text">
                              Connecting... {connectionProgress}%
                            </span>
                          </div>
                        )}
                        <VncScreen
                          url={url}
                          rfbOptions={{
                            credentials: { password },
                            wsProtocols: ['binary'],
                          } as Partial<RFBOptions>}
                          scaleViewport
                          background="#000000"
                          style={{
                            width: '100%',
                            height: '240px',
                            display: connectionProgress === 100 ? 'block' : 'none'
                          }}
                          onConnect={() => {
                            console.log(`VNC connected to ${systemName}`);
                            setVncConnectionProgress(prev => ({
                              ...prev,
                              [systemName]: 100
                            }));
                          }}
                          onDisconnect={(e) => {
                            console.log(`VNC disconnected from ${systemName}:`, e);
                            setVncConnectionProgress(prev => ({
                              ...prev,
                              [systemName]: 0
                            }));
                          }}
                          onCredentialsRequired={(e) => {
                            console.log(`VNC credentials required for ${systemName}:`, e);
                            setVncConnectionProgress(prev => ({
                              ...prev,
                              [systemName]: 30
                            }));
                          }}
                          onSecurityFailure={(e) => {
                            console.error(`VNC security failure for ${systemName}:`, e);
                            setVncError(`Security failure for ${systemName}: ${e?.detail?.reason || 'Unknown reason'}`);
                            setVncConnectionProgress(prev => ({
                              ...prev,
                              [systemName]: 0
                            }));
                          }}
                          onClipboard={(e) => console.log(`VNC clipboard event for ${systemName}:`, e)}
                        />
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                // Regular Card Mode
                viewMode === 'card' ? (
                  systemCards.map((card, index) => (
                    <SystemCard
                      key={index}
                      {...card}
                      onDetailsClick={() => handleDetailsClick(card.name)}
                      onOpenParser={handleOpenParser}
                      onOpenVNC={() => handleVNCIconClick(card.name)}
                    />
                  ))
                ) : (
                  <SystemList
                    systems={systemCards}
                    onDetailsClick={handleDetailsClick}
                    onOpenParser={handleOpenParser}
                  />
                )
              )}
            </div>
            {showNetworkAnalyzer && <NetworkAnalyzer systemCards={systemCards} />} // Pad43
          </div>
        )}
        {activeMenuItem === 'iSCAN Parser' && <ISCANParser systemName={selectedSystemName || ''} />}
        {activeMenuItem === 'SQL Space' && <SQLSpace />}
        {activeMenuItem === 'POS Adapter Parser' && (
          <PosAdapterParser
            key={selectedSystemName || 'default'}
            systemName={selectedSystemName || ''}
            onBack={() => handleMenuItemClick('Dashboard')}
            initialState={posAdapterState}
            onStateChange={handlePosAdapterStateChange}
          />
        )}
        {activeMenuItem === 'TPiSCAN' && <TPiSCAN />}
        {activeMenuItem === 'Nastavení' && (
          <div className="settings-container">
            <div className="settings-item">
              <span className="settings-label">Dark Mode</span>
              <div className="settings-toggle">
                <input type="checkbox" id="dark-mode-toggle" checked={isDarkMode} onChange={toggleDarkMode} />
                <label htmlFor="dark-mode-toggle">{isDarkMode ? 'On' : 'Off'}</label>
              </div>
            </div>
            <div className="settings-item">
              <span className="settings-label">Notifications</span>
              <div className="settings-toggle">
                <input type="checkbox" id="notifications-toggle" checked={showNotifications} onChange={toggleNotifications} />
                <label htmlFor="notifications-toggle">{showNotifications ? 'On' : 'Off'}</label>
              </div>
            </div>
            <div className="settings-item">
              <span className="settings-label">Language</span>
              <select value={language} onChange={handleLanguageChange} className="settings-select">
                <option value="en">English</option>
                <option value="cs">Čeština</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>
        )}
        {activeMenuItem === 'XML Validator' && <XMLValidatorComponent />}
      </div>
      <LoadingModal isOpen={isLoading} progress={loadingProgress} onCancel={handleCancelLoading} />
      {showNotifications && (
        <NotificationsCenter
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onClearAll={clearAllNotifications}
          onRemoveNotification={removeNotification}
        />
      )}
      {isModalOpen && selectedSystem && (
        <DownloadLogsModal
          systemName={selectedSystem.name}
          scoType={selectedSystem.details.SCOType}
          onClose={handleCloseModal}
          onOpenParser={handleOpenParser}
        />
      )}
      {activeVNCModal && (
        <VNCModal
          isOpen={true}
          onClose={handleCloseVNCModal}
          systemName={activeVNCModal}
          systemType={systemCards.find(card => card.name === activeVNCModal)?.type || ''}
          url={vncConnections[activeVNCModal].url}
          password={vncConnections[activeVNCModal].password}
        />
      )}
      <VNCModal // P8f64
        isOpen={isVNCModalOpen}
        onClose={handleVNCModalToggle}
        systemName="Example System"
        systemType="SCO"
        url="wss://example.com/vnc"
        password="examplePassword"
      />
    </div>
  );
};

export default Dashboard;
