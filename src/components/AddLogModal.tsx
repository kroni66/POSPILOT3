import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import '../styles/AddLogModal.css';

interface AddLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLog: (logContent: string) => void;
}

const AddLogModal: React.FC<AddLogModalProps> = ({ isOpen, onClose, onAddLog }) => {
  const [logContent, setLogContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (logContent.trim()) {
      onAddLog(logContent);
      setLogContent('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-log-modal-overlay">
      <div className="add-log-modal">
        <button className="add-log-modal__close" onClick={onClose}>
          <FiX />
        </button>
        <h2 className="add-log-modal__title">Add Log Manually</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            className="add-log-modal__textarea"
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            placeholder="Paste or type your log content here..."
            rows={10}
          />
          <div className="add-log-modal__actions">
            <button type="button" className="add-log-modal__button add-log-modal__button--cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-log-modal__button add-log-modal__button--submit">
              Add Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLogModal;