import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FaUpload, FaSearch, FaArrowDown, FaPlus, FaSort, FaSortUp, FaSortDown, FaSync } from 'react-icons/fa';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { debounce } from 'lodash';
import LoadingModal from './LoadingModal';
import '../styles/PosAdapterParser.css';
import AddLogModal from './AddLogModal';
import { List as VirtualizedList } from 'react-virtualized';
const { ipcRenderer } = window.require('electron');

interface LogEntry {
  date: string;
  timestamp: string;
  restartSCO: string;
  currentBalance: string;
  balanceDifference: number | undefined;
  pickedAmount: string;
  uzavreniSCO: string;
  SCOConfirmation: string;
  DBBalance: string;
  fileName?: string;
  fileDate?: string;
  isDivider?: boolean;
}

const columns = [
  { label: 'Date', dataKey: 'date' as keyof LogEntry, width: 100 },
  { label: 'Time', dataKey: 'timestamp' as keyof LogEntry, width: 140 },
  { label: 'Restart', dataKey: 'restartSCO' as keyof LogEntry, width: 80, hasJumpIcon: true },
  { label: 'Curr Bal', dataKey: 'currentBalance' as keyof LogEntry, width: 100 },
  { label: 'Diff', dataKey: 'balanceDifference' as keyof LogEntry, width: 80 },
  { label: 'Picked', dataKey: 'pickedAmount' as keyof LogEntry, width: 100, hasJumpIcon: true },
  { label: 'Uzavreni', dataKey: 'uzavreniSCO' as keyof LogEntry, width: 100 },
  { label: 'SCO Conf', dataKey: 'SCOConfirmation' as keyof LogEntry, width: 100 },
  { label: 'DB Bal', dataKey: 'DBBalance' as keyof LogEntry, width: 100 }
];

export interface PosAdapterParserState {
  systemName: string;
  parsedData: LogEntry[];
  filteredData: LogEntry[];
  searchTerm: string;
  sortConfig: SortConfig;
  isLoading: boolean;
  loadingProgress: number;
  scoNames: string[];
  selectedScoName: string;
  logContents: { [fileName: string]: string };
  selectedFiles: string[];
  parserHeight: number;
  rawLogContent: string;
  editorHeight: number;
  isAddLogModalOpen: boolean;
  highlightedLine: number | null;
}

export interface PosAdapterParserProps {
  systemName: string | null;
  onBack: () => void;
  initialState: PosAdapterParserState;
  onStateChange: (newState: Partial<PosAdapterParserState>) => void;
}

interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending' | null;
}

const PosAdapterParser: React.FC<PosAdapterParserProps> = ({ systemName, onBack, initialState, onStateChange }) => {
  const [parsedData, setParsedData] = useState<LogEntry[]>(initialState.parsedData);
  const [filteredData, setFilteredData] = useState<LogEntry[]>(initialState.filteredData);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialState.sortConfig);
  const [isLoading, setIsLoading] = useState<boolean>(initialState.isLoading);
  const [loadingProgress, setLoadingProgress] = useState<number>(initialState.loadingProgress);
  const [scoNames, setScoNames] = useState<string[]>(initialState.scoNames);
  const [selectedScoName, setSelectedScoName] = useState<string>(initialState.selectedScoName);
  const [logContents, setLogContents] = useState<{ [fileName: string]: string }>(initialState.logContents);
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialState.selectedFiles);
  const workerRef = useRef<Worker | null>(null);
  const parserRef = useRef<HTMLDivElement>(null);
  const [parserHeight, setParserHeight] = useState<number>(initialState.parserHeight);
  const [rawLogContent, setRawLogContent] = useState<string>(initialState.rawLogContent);
  const logViewerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(initialState.editorHeight);
  const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(initialState.isAddLogModalOpen);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(initialState.highlightedLine);

  // Update the parent component's state when local state changes
  useEffect(() => {
    onStateChange({
      parsedData,
      filteredData,
      searchTerm,
      sortConfig,
      isLoading,
      loadingProgress,
      scoNames,
      selectedScoName,
      logContents,
      selectedFiles,
      parserHeight,
      rawLogContent,
      editorHeight,
      isAddLogModalOpen,
      highlightedLine,
    });
  }, [parsedData, filteredData, searchTerm, sortConfig, isLoading, loadingProgress, scoNames, selectedScoName, logContents, selectedFiles, parserHeight, rawLogContent, editorHeight, isAddLogModalOpen, highlightedLine, onStateChange]);

  const initializeWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    workerRef.current = new Worker(new URL('../workers/logParserWorker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event) => {
      console.log('Received message from worker:', event.data.type);
      if (event.data.type === 'progress') {
        setLoadingProgress(event.data.progress);
      } else if (event.data.type === 'complete') {
        console.log('Parsing complete. Processing entries...');
        const logEntries = event.data.logEntries;
        
        // No need to calculate balance differences or add dates here anymore
        // as it's now done in the worker
        
        console.log('Setting parsed data...');
        setParsedData(logEntries);
        setFilteredData(logEntries);
        setIsLoading(false);
      } else if (event.data.type === 'error') {
        console.error('Error parsing log file:', event.data.message);
        setIsLoading(false);
      }
    };
  }, []);

  useEffect(() => {
    initializeWorker();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initializeWorker]);

  const handleOpenDownloadsFolder = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadingProgress(0);
      console.log('Opening file dialog...');
      const filePaths = await ipcRenderer.invoke('open-log-file-dialog', 'PosAdapter', true);
      console.log('Selected file paths:', filePaths);

      if (filePaths && filePaths.length > 0) {
        setSelectedFiles(filePaths);
        const contents: { [fileName: string]: string } = {};
        let combinedRawContent = '';
        
        console.log('Reading file contents...');
        await Promise.all(filePaths.map(async (filePath: string, index: number) => {
          const content = await ipcRenderer.invoke('read-log-file', filePath);
          contents[filePath] = content;
          combinedRawContent += content + '\n';
          setLoadingProgress((index + 1) / filePaths.length * 50);
        }));

        console.log('File contents read. Sending to worker...');
        setLogContents(contents);
        setRawLogContent(combinedRawContent);
        
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'parse', contents });
        } else {
          console.error('Worker not initialized');
          setIsLoading(false);
        }
      } else {
        console.log('No files selected');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error opening or parsing log files:', error);
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        const filtered = parsedData.filter(entry =>
          Object.values(entry).some(value =>
            value.toString().toLowerCase().includes(lowercasedSearchTerm)
          )
        );
        setFilteredData(filtered);
      }, 300),
    [parsedData]
  );

  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setSearchTerm(newSearchTerm);
    onStateChange({ searchTerm: newSearchTerm });
    debouncedSearch(newSearchTerm);
  }, [debouncedSearch, onStateChange]);

  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parserRef.current,
    estimateSize: () => 30,
    overscan: 5,
  });

  const handleRowClick = useCallback((timestamp: string) => {
    if (rawLogContent) {
      const lines = rawLogContent.split('\n');
      const lineIndex = lines.findIndex((line) => line.includes(timestamp));
      
      if (lineIndex !== -1) {
        setHighlightedLine(lineIndex + 1);
      }
    }
  }, [rawLogContent]);

  const listRef = useRef<List>(null);

  const jumpToNextValue = useCallback((dataKey: string, currentIndex: number) => {
    const nextIndex = filteredData.findIndex((entry, index) => 
      index > currentIndex && entry[dataKey as keyof LogEntry]
    );
    if (nextIndex !== -1) {
      listRef.current?.scrollToItem(nextIndex, 'center');
    }
  }, [filteredData]);

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' | null = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = null;
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    onStateChange({ sortConfig: newSortConfig });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'ascending') return <FaSortUp />;
      if (sortConfig.direction === 'descending') return <FaSortDown />;
    }
    return <FaSort />;
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== '' && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof LogEntry];
        const bValue = b[sortConfig.key as keyof LogEntry];
        if (aValue !== undefined && bValue !== undefined && aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue !== undefined && bValue !== undefined && aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const entry = sortedData[index];
      if (!entry) return null;

      if (entry.isDivider) {
        return (
          <div
            style={{
              ...style,
              height: '30px',
            }}
            className="pos-adapter-parser__divider"
          >
            <span className="pos-adapter-parser__divider-date">{entry.fileDate}</span>
            <span className="pos-adapter-parser__divider-filename">{entry.fileName}</span>
          </div>
        );
      }

      return (
        <div 
          style={style} 
          className="pos-adapter-parser__row"
          onClick={() => handleRowClick(entry.timestamp)}
        >
          {columns.map((column) => (
            <div
              key={column.dataKey}
              className="pos-adapter-parser__cell"
              style={{ width: column.width, minWidth: column.width, maxWidth: column.width }}
            >
              {column.dataKey === 'date' ? (
                <div className="pos-adapter-parser__cell-content">
                  {entry.date}
                </div>
              ) : column.dataKey === 'balanceDifference' ? (
                entry.currentBalance !== null && entry.currentBalance !== '' ? (
                  <div className={`pos-adapter-parser__balance-diff ${entry.balanceDifference! > 0 ? 'positive' : entry.balanceDifference! < 0 ? 'negative' : ''}`}>
                    {entry.balanceDifference! !== 0 ? (entry.balanceDifference! > 0 ? '+' : '') + entry.balanceDifference! : ''}
                  </div>
                ) : (
                  <div></div> // Empty div when Curr Bal is empty
                )
              ) : column.dataKey === 'currentBalance' && entry[column.dataKey] ? (
                <div className="pos-adapter-parser__balance-cell">
                  {entry[column.dataKey]}
                </div>
              ) : (
                <div className="pos-adapter-parser__cell-content">
                  {entry[column.dataKey]}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    },
    [sortedData, handleRowClick]
  );

  const LogViewer = useMemo(() => {
    if (!rawLogContent) return null;

    const lines = rawLogContent.split('\n');

    const rowRenderer = ({ index, key, style }: { index: number; key: string; style: React.CSSProperties }) => {
      const line = lines[index];
      const isHighlighted = index + 1 === highlightedLine;
      return (
        <div
          key={key}
          style={style}
          className={`pos-adapter-parser__log-line ${isHighlighted ? 'pos-adapter-parser__log-line--highlighted' : ''}`}
        >
          {line}
        </div>
      );
    };

    return (
      <div className="pos-adapter-parser__log-viewer" style={{ height: `${editorHeight}px` }}>
        <h3>Log Viewer</h3>
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => {
            const listHeight = height - 40; // Subtract height of the h3 title
            const rowHeight = 20; // Adjust this value based on your font size
            const visibleRows = Math.floor(listHeight / rowHeight);
            const halfVisibleRows = Math.floor(visibleRows / 2);
            
            let scrollToIndex;
            if (highlightedLine) {
              scrollToIndex = highlightedLine - 1; // Subtract 1 to match the index
            }

            return (
              <VirtualizedList
                width={width}
                height={listHeight}
                rowCount={lines.length}
                rowHeight={rowHeight}
                rowRenderer={rowRenderer}
                scrollToIndex={scrollToIndex}
                scrollToAlignment="center"
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }, [rawLogContent, editorHeight, highlightedLine]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const newParserHeight = e.clientY;
    const maxHeight = window.innerHeight - 200;
    const newHeight = Math.max(300, Math.min(maxHeight, newParserHeight));
    setParserHeight(newHeight);
    setEditorHeight(window.innerHeight - newHeight - 50); // 50px for padding and margins
  }, []);

  const handleResizeEnd = useCallback((): void => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  const handleCancelLoading = useCallback((): void => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (systemName) {
      loadData(systemName);
    }
  }, [systemName]);

  const loadData = async (systemName: string) => {
    try {
      setIsLoading(true);
      setLoadingProgress(0);
      const logContent = await ipcRenderer.invoke('get-downloaded-adapter-logs', systemName);
      if (logContent) {
        handleLogContent(logContent);
      }
    } catch (error) {
      console.error('Error loading downloaded Adapter logs:', error);
      // Handle error (e.g., show error message to user)
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogContent = (content: string) => {
    setRawLogContent(content);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'parse', contents: { 'log.txt': content } });
    }
  };

  useEffect(() => {
    // Log the component mounting
    console.log('PosAdapterParser mounted for system:', systemName);
    return () => {
      console.log('PosAdapterParser unmounted for system:', systemName);
    };
  }, [systemName]);

  const handleAddLog = (logContent: string) => {
    setRawLogContent(prevContent => prevContent + '\n' + logContent);
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'parse', contents: { 'manual_log.txt': logContent } });
    }
    setIsAddLogModalOpen(false);
  };

  const extractDateFromFileName = (fileName: string): string => {
    const match = fileName.match(/Log_(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  };

  const handleRefresh = useCallback(async () => {
    if (!systemName) {
      console.error('System name is not defined');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingProgress(0);
      console.log('Refreshing logs for system:', systemName);
      
      // Invoke the main process to get all log files from the SCO's download folder
      const logFiles = await ipcRenderer.invoke('get-sco-log-files', systemName);
      
      if (logFiles && logFiles.length > 0) {
        const contents: { [fileName: string]: string } = {};
        let combinedRawContent = '';
        
        console.log('Reading file contents...');
        await Promise.all(logFiles.map(async (filePath: string, index: number) => {
          const content = await ipcRenderer.invoke('read-log-file', filePath);
          contents[filePath] = content;
          combinedRawContent += content + '\n';
          setLoadingProgress((index + 1) / logFiles.length * 50);
        }));

        console.log('File contents read. Sending to worker...');
        setLogContents(contents);
        setRawLogContent(combinedRawContent);
        
        if (workerRef.current) {
          workerRef.current.postMessage({ type: 'parse', contents });
        } else {
          console.error('Worker not initialized');
          setIsLoading(false);
        }
      } else {
        console.log('No log files found');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error refreshing log files:', error);
      setIsLoading(false);
    }
  }, [systemName]);

  return (
    <div className="pos-adapter-parser" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pos-adapter-parser__header">
        <h2>POS Adapter Parser {systemName ? `- ${systemName}` : ''}</h2>
      </div>
      <div className="pos-adapter-parser__controls">
        <button className="pos-adapter-parser__button" onClick={handleOpenDownloadsFolder}>
          <FaUpload /> Upload Log Files
        </button>
        <button className="pos-adapter-parser__button" onClick={handleRefresh}>
          <FaSync /> Refresh Logs
        </button>
        <div className="pos-adapter-parser__search-container">
          <input
            type="text"
            placeholder="Vyhledat..."
            value={searchTerm}
            onChange={handleSearch}
            className="pos-adapter-parser__search-input"
          />
        </div>
      </div>
      {sortedData.length > 0 && (
        <div className="pos-adapter-parser__results">
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <>
                <div className="pos-adapter-parser__header-row">
                  {columns.map(({ dataKey, label, width: columnWidth, hasJumpIcon }) => (
                    <div
                      key={dataKey}
                      className="pos-adapter-parser__header-cell"
                      style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }}
                      onClick={() => handleSort(dataKey)}
                    >
                      {label}
                      {getSortIcon(dataKey)}
                      {hasJumpIcon && (
                        <FaArrowDown 
                          className="pos-adapter-parser__header-jump-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToNextValue(dataKey, 0);
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <List
                  ref={listRef}
                  height={height - 40} // Subtract header height
                  itemCount={sortedData.length}
                  itemSize={(index) => (sortedData[index].isDivider ? 30 : 35)}
                  width={width}
                  itemData={sortedData}
                >
                  {Row}
                </List>
              </>
            )}
          </AutoSizer>
        </div>
      )}
      <div className="pos-adapter-parser__resize-handle" onMouseDown={handleResizeStart}></div>
      {LogViewer}
      <LoadingModal 
        isOpen={isLoading} 
        progress={loadingProgress} 
        onCancel={handleCancelLoading}
      />
      <AddLogModal
        isOpen={isAddLogModalOpen}
        onClose={() => setIsAddLogModalOpen(false)}
        onAddLog={handleAddLog}
      />
    </div>
  );
};

export default PosAdapterParser;