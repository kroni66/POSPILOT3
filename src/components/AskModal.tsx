import React from 'react';
import '../styles/AskModal.css';

interface AskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const AskModal: React.FC<AskModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="ask-modal-overlay">
      <div className="ask-modal">
        <p className="ask-modal__message">{message}</p>
        <div className="ask-modal__buttons">
          <button className="ask-modal__button ask-modal__button--cancel" onClick={onClose}>No</button>
          <button className="ask-modal__button ask-modal__button--confirm" onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
};

export default AskModal;