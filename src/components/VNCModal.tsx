import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FiX, FiMaximize, FiMinimize, FiClipboard, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { BiReset } from 'react-icons/bi';
import { BsKeyboard } from 'react-icons/bs';
import { VncScreen } from 'react-vnc';
import { VscRemoteExplorer } from 'react-icons/vsc';
import '../styles/VNCModal.css';
import MockVNCScreen from './MockVNCScreen';
import LoadingModal from './LoadingModal';
const { ipcRenderer } = window.require('electron');

interface VNCModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemName: string;
  systemType: string;
  url: string;
  password: string;
}

const VNCModal: React.FC<VNCModalProps> = ({ isOpen, onClose, systemName, systemType, url, password }) => {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [scale, setScale] = useState(1);
  const [clipboardContent, setClipboardContent] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectIntervalRef = useRef<NodeJS.Timeout>();
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        // Get container dimensions
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        // Set dimensions to fill the container while maintaining aspect ratio
        setDimensions({
          width: containerWidth,
          height: containerHeight
        });
        
        // Scale is now 1 since we're stretching the screen
        setScale(1);
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isFullscreen]);

  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleClipboardCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clipboardContent);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [clipboardContent]);

  const handleClipboardPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardContent(text);
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
    }
  }, []);

  const attemptReconnect = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('connect-vnc', systemName);
      if (result.success) {
        setIsReconnecting(false);
        setReconnectAttempts(0);
        if (reconnectIntervalRef.current) {
          clearInterval(reconnectIntervalRef.current);
        }
        // Force refresh the VNC connection by remounting the component
        setKey(prev => prev + 1);
      } else {
        setReconnectAttempts(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setReconnectAttempts(prev => prev + 1);
    }
  }, [systemName]);

  const handleRestart = useCallback(async () => {
    if (systemType !== 'SCO') return;
    
    try {
      setIsRestarting(true);
      setIsReconnecting(true);
      setReconnectAttempts(0);
      
      const results = await ipcRenderer.invoke('restart-scos', [systemName]);
      const result = results[0];
      
      if (result.success) {
        console.log(`Successfully restarted ${systemName}`);
        // Start reconnection attempts
        reconnectIntervalRef.current = setInterval(attemptReconnect, 3000);
      } else {
        console.error(`Failed to restart ${systemName}:`, result.message);
        setIsReconnecting(false);
      }
    } catch (error) {
      console.error('Error restarting SCO:', error);
      setIsReconnecting(false);
    } finally {
      setIsRestarting(false);
    }
  }, [systemName, systemType, attemptReconnect]);

  const handleCtrlAltDel = useCallback(() => {
    const vncScreen = document.querySelector('.vnc-screen-container canvas');
    if (vncScreen) {
      // Create and dispatch keydown events
      const ctrlDown = new KeyboardEvent('keydown', { key: 'Control', keyCode: 17, bubbles: true });
      const altDown = new KeyboardEvent('keydown', { key: 'Alt', keyCode: 18, bubbles: true });
      const delDown = new KeyboardEvent('keydown', { key: 'Delete', keyCode: 46, bubbles: true });

      // Create and dispatch keyup events
      const ctrlUp = new KeyboardEvent('keyup', { key: 'Control', keyCode: 17, bubbles: true });
      const altUp = new KeyboardEvent('keyup', { key: 'Alt', keyCode: 18, bubbles: true });
      const delUp = new KeyboardEvent('keyup', { key: 'Delete', keyCode: 46, bubbles: true });

      // Send the key combination
      vncScreen.dispatchEvent(ctrlDown);
      vncScreen.dispatchEvent(altDown);
      vncScreen.dispatchEvent(delDown);

      // Release the keys in reverse order
      setTimeout(() => {
        vncScreen.dispatchEvent(delUp);
        vncScreen.dispatchEvent(altUp);
        vncScreen.dispatchEvent(ctrlUp);
      }, 100);

      console.log('Sent Ctrl+Alt+Del');
    } else {
      console.error('VNC screen canvas not found');
    }
  }, []);

  const handleOpenRemoteRegistry = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('open-remote-registry', systemName);
      if (!result.success) {
        console.error('Failed to open remote registry:', result.error);
      }
    } catch (error) {
      console.error('Error opening remote registry:', error);
    }
  }, [systemName]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className={`vnc-modal-overlay ${isFullscreen ? 'fullscreen' : ''}`} onClick={onClose}>
        <div className="vnc-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="vnc-modal-header">
            <h2>{systemName} - VNC Connection ({systemType})</h2>
            <div className="vnc-modal-controls">
              {systemType === 'SCO' && (
                <div className="vnc-modal-system-controls">
                  <button 
                    className="vnc-modal-control system-control"
                    onClick={handleOpenRemoteRegistry}
                    title="Open Remote Registry"
                  >
                    <VscRemoteExplorer />
                  </button>
                  <button 
                    className={`vnc-modal-control system-control ${isRestarting ? 'rotating' : ''}`}
                    onClick={handleRestart}
                    disabled={isRestarting}
                    title="Restart SCO"
                  >
                    <BiReset />
                  </button>
                  <button 
                    className="vnc-modal-control system-control"
                    onClick={handleCtrlAltDel}
                    title="Send Ctrl+Alt+Del"
                  >
                    <BsKeyboard />
                  </button>
                </div>
              )}
              <div className="vnc-modal-standard-controls">
                <button className="vnc-modal-control" onClick={handleClipboardCopy} title="Copy to Clipboard">
                  <FiClipboard />
                </button>
                <button className="vnc-modal-control" onClick={handleZoomIn} title="Zoom In">
                  <FiZoomIn />
                </button>
                <button className="vnc-modal-control" onClick={handleZoomOut} title="Zoom Out">
                  <FiZoomOut />
                </button>
                <button className="vnc-modal-control" onClick={handleFullscreenToggle} title="Toggle Fullscreen">
                  {isFullscreen ? <FiMinimize /> : <FiMaximize />}
                </button>
                <button className="vnc-modal-close" onClick={onClose}>
                  <FiX />
                </button>
              </div>
            </div>
          </div>
          <div className={`vnc-modal-body ${isFullscreen ? 'fullscreen' : ''}`}>
            <div className="vnc-screen-container" ref={containerRef}>
              {process.env.REACT_APP_USE_MOCK_VNC === 'true' ? (
                <MockVNCScreen
                  systemName={systemName}
                  systemType={systemType}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: "#000000",
                    cursor: 'default',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              ) : (
                <VncScreen
                  key={key}
                  url={url}
                  rfbOptions={{
                    credentials: { password },
                    wsProtocols: ['binary'],
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: "#000000",
                    cursor: 'pointer',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  onClipboard={(event) => event && setClipboardContent(event.detail.text)}
                  viewOnly={false}
                />
              )}
            </div>
            {showKeyboard && (
              <div className="vnc-virtual-keyboard">
                {/* Add virtual keyboard implementation here if needed */}
                <div className="keyboard-layout">
                  {/* Basic keyboard layout */}
                  <div className="keyboard-row">
                    <button>Esc</button>
                    <button>Tab</button>
                    <button>Ctrl</button>
                    <button>Alt</button>
                    <button>Del</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <LoadingModal 
        isOpen={isReconnecting}
        progress={Math.min((reconnectAttempts * 10), 90)} // Caps at 90%
        onCancel={() => {
          setIsReconnecting(false);
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
          }
        }}
      />
    </>
  );
};

export default VNCModal;
