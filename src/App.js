import React from 'react';
import Dashboard from './components/Dashboard';
import './styles/App.css';

function App() {
  const handleDetailsClick = (name, type, details) => {
    console.log(`Details for ${name}:`, { type, details });
    // Implement your logic here, e.g., open a modal with details
  };

  return (
    <div className="App">
      <Dashboard onDetailsClick={handleDetailsClick} />
    </div>
  );
}

export default App;