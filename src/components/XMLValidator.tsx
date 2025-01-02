import React, { useState } from 'react';
import { FaUpload, FaCheck, FaTimes, FaFileAlt } from 'react-icons/fa';
import { XMLValidator } from 'fast-xml-parser';

const XMLValidatorComponent: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setValidationResult(null);
      setShowSuccessModal(false);
    }
  };

  const validateXML = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = XMLValidator.validate(content);

      if (result === true) {
        setValidationResult({ isValid: true });
        setShowSuccessModal(true);
      } else {
        setValidationResult({ isValid: false, error: result.err.msg });
      }
    };
    reader.readAsText(file);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  return (
    <div className="xml-validator-component">
      <h2 className="xml-validator-component__title">XML Validátor</h2>
      <div className="xml-validator-component__content">
        <div className="xml-validator-component__input-area">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            id="xml-file-input"
            className="xml-validator-component__file-input"
          />
          <label htmlFor="xml-file-input" className="xml-validator-component__file-label">
            <FaUpload className="xml-validator-component__icon" />
            <span>{file ? file.name : 'Vyberte XML soubor'}</span>
          </label>
          <button 
            onClick={validateXML} 
            className="xml-validator-component__validate-btn" 
            disabled={!file}
          >
            Validovat XML
          </button>
        </div>
        {validationResult && !validationResult.isValid && (
          <div className="xml-validator-component__result invalid">
            <div className="xml-validator-component__result-content">
              <FaTimes className="xml-validator-component__icon invalid" />
              <h3>XML je neplatné</h3>
              <p className="xml-validator-component__error">{validationResult.error}</p>
            </div>
          </div>
        )}
      </div>
      {showSuccessModal && (
        <div className="xml-validator-component__modal-overlay">
          <div className="xml-validator-component__modal">
            <div className="xml-validator-component__modal-content">
              <FaCheck className="xml-validator-component__modal-icon valid" />
              <h3 className="xml-validator-component__modal-title">Úspěch!</h3>
              <p className="xml-validator-component__modal-message">XML je platné.</p>
              <button 
                className="xml-validator-component__modal-close-btn"
                onClick={closeSuccessModal}
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
//asdasdsasadasdsgsadasdsasdaasdsaadsadasdsadsadasdsaddsaadsdsadasdsadasdsadsadasdasdsdasdasdassdasdasdasdsaassadasddsadasasdasdsa
export default XMLValidatorComponent;