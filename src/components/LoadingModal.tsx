import React from 'react';
import '../styles/LoadingModal.css';

interface LoadingModalProps {
  isOpen: boolean;
  progress: number;
  onCancel: () => void;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, progress, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal">
        <div className="loading-icon"></div>
        <h2 className="loading-text">Načítám...</h2>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="progress-text">{Math.round(progress)}%</p>
        <button className="cancel-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default LoadingModal;
