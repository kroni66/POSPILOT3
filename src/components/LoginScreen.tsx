import React, { useState } from 'react';
import { FiLock } from 'react-icons/fi';
import '../styles/LoginScreen.css';
const { ipcRenderer } = window.require('electron');

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await ipcRenderer.invoke('authenticate-local', { password });
      
      if (result.success) {
        localStorage.setItem('isLoggedIn', 'true');
        onLogin();
      } else {
        setError(result.error || 'Neplatné heslo');
      }
    } catch (err) {
      setError(`Chyba při přihlašování: ${err instanceof Error ? err.message : 'Neznámá chyba'}`);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-screen__logo">
        <FiLock />
      </div>
      {error && (
        <div className="login-screen__error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="login-screen__form">
        <div className="login-screen__input-wrapper">
          <FiLock className="login-screen__input-icon" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            className="login-screen__input"
          />
        </div>
        <button type="submit" className="login-screen__submit-button">
          Přihlásit se
        </button>
      </form>
    </div>
  );
};

export default LoginScreen; 