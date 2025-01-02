import React, { useState } from 'react';
import { FiHome, FiTool, FiSettings, FiChevronRight, FiChevronDown, FiDatabase, FiMenu } from 'react-icons/fi';
import { FaExchangeAlt, FaCashRegister, FaFileCode } from 'react-icons/fa';
import beruskaLogo from '../styles/beruska.png'; // Import the image


interface MenuItem {
  name: string;
  icon: JSX.Element;
  subItems?: MenuItem[];
}

interface SidebarProps {
  activeMenuItem: string;
  onMenuItemClick: (itemName: string) => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeMenuItem, onMenuItemClick, className }) => {
  const [toolsExpanded, setToolsExpanded] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const menuItems: MenuItem[] = [
    { name: 'Dashboard', icon: <FiHome /> },
    {
      name: 'Nástroje',
      icon: <FiTool />, 
      subItems: [
        { name: 'iSCAN Parser', icon: <FiChevronRight /> },
        { name: 'SQL Space', icon: <FiDatabase /> },
        { name: 'POS Adapter Parser', icon: <FaExchangeAlt /> },
        { name: 'TPiSCAN', icon: <FaCashRegister /> },
        { name: 'XML Validator', icon: <FaFileCode /> }, // Add this line
      ]
    },
    { name: 'Nastavení', icon: <FiSettings /> }
  ];

  const handleToolsClick = () => {
    setToolsExpanded(!toolsExpanded);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <>
      <div className={`sidebar ${className || ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <img src={beruskaLogo} alt="Beruska" className="sidebar-logo" />
            <h1 className="sidebar-title">
              <span className="sidebar-title-bold">Beetle</span>
              <span className="sidebar-title-thin">Link</span>
            </h1>
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <div key={item.name}>
                <div
                  className={`sidebar-nav-item ${activeMenuItem === item.name ? 'active' : ''}`}
                  onClick={() => item.subItems ? handleToolsClick() : onMenuItemClick(item.name)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-text">{item.name}</span>
                  {item.subItems && (toolsExpanded ? <FiChevronDown /> : <FiChevronRight />)}
                </div>
                {item.subItems && toolsExpanded && (
                  <div className="sidebar-subnav">
                    {item.subItems.map((subItem) => (
                      <div
                        key={subItem.name}
                        className={`sidebar-nav-item ${activeMenuItem === subItem.name ? 'active' : ''}`}
                        onClick={() => onMenuItemClick(subItem.name)}
                      >
                        <span className="sidebar-icon">{subItem.icon}</span>
                        <span className="sidebar-text">{subItem.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="sidebar-version">
          <span className="version-text">v1.0.8</span>
        </div>
      </div>
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        <FiMenu />
      </button>
    </>
  );
};

export default Sidebar;