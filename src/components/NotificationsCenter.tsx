import React from 'react';
import { FiBell, FiX, FiAlertCircle, FiInfo, FiCheckCircle } from 'react-icons/fi';

interface Notification {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
  timestamp: Date;
}

interface NotificationsCenterProps {
  notifications: Notification[];
  onClose: () => void;
  onClearAll: () => void;
  onRemoveNotification: (id: number) => void;
}

const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  onClose,
  onClearAll,
  onRemoveNotification,
}) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <FiAlertCircle className="notification-icon error" />;
      case 'warning':
        return <FiAlertCircle className="notification-icon warning" />;
      case 'success':
        return <FiCheckCircle className="notification-icon success" />;
      default:
        return <FiInfo className="notification-icon info" />;
    }
  };

  const sortedNotifications = [...notifications].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const groupedNotifications = {
    error: sortedNotifications.filter(n => n.type === 'error'),
    warning: sortedNotifications.filter(n => n.type === 'warning'),
    success: sortedNotifications.filter(n => n.type === 'success'),
    info: sortedNotifications.filter(n => n.type === 'info'),
  };

  return (
    <div className="notifications-center">
      <div className="notifications-center-header">
        <div className="notifications-title">
          <FiBell className="notifications-bell-icon" />
          <h3>Notifications Center</h3>
        </div>
        <div className="notifications-actions">
          <button 
            className="clear-all-button"
            onClick={onClearAll}
            disabled={notifications.length === 0}
          >
            Clear All
          </button>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
      </div>
      
      <div className="notifications-content">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <p>No notifications</p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([type, items]) => (
            items.length > 0 && (
              <div key={type} className="notification-group">
                <div className="notification-group-header">
                  <h4>{type.charAt(0).toUpperCase() + type.slice(1)}s</h4>
                  <span className="notification-count">{items.length}</span>
                </div>
                <ul className="notification-list">
                  {items.map(notification => (
                    <li key={notification.id} className={`notification-item ${notification.type}`}>
                      {getNotificationIcon(notification.type)}
                      <div className="notification-content">
                        <p className="notification-message">{notification.message}</p>
                        <span className="notification-time">
                          {notification.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <button
                        className="remove-notification"
                        onClick={() => onRemoveNotification(notification.id)}
                      >
                        <FiX />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsCenter; 