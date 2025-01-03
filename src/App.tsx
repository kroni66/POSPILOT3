import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import PluginManager from './components/PluginManager';
import './styles/App.css';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });

  const handleLogin = () => {
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
  };

  return (
    <div className="app">
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <>
          <Dashboard onLogout={handleLogout} />
          <PluginManager />
        </>
      )}
    </div>
  );
};

export default App;
