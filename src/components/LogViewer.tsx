import React, { useEffect, useRef } from 'react';
import '../styles/LogViewer.css';

interface LogViewerProps {
  fileName: string;
  content: string;
  selectedTimestamp: string | null;
}

const LogViewer: React.FC<LogViewerProps> = ({ fileName, content, selectedTimestamp }) => {
  const logContentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (selectedTimestamp && logContentRef.current) {
      const lines = content.split('\n');
      const lineIndex = lines.findIndex(line => line.includes(selectedTimestamp));
      if (lineIndex !== -1) {
        const lineElements = logContentRef.current.querySelectorAll('.log-viewer__line');
        const targetLine = lineElements[lineIndex] as HTMLElement;
        if (targetLine) {
          targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetLine.classList.add('log-viewer__line--highlighted');
        }
      }
    }
  }, [selectedTimestamp, content]);

  return (
    <div className="log-viewer">
      <h3 className="log-viewer__title">{fileName}</h3>
      <pre className="log-viewer__content" ref={logContentRef}>
        {content.split('\n').map((line, index) => (
          <div 
            key={index} 
            className={`log-viewer__line ${line.includes(selectedTimestamp || '') ? 'log-viewer__line--highlighted' : ''}`}
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
};

export default LogViewer;