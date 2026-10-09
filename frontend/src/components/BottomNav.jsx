import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/mobileCamera.css';

const BottomNav = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  return (
    <nav className="bottom-app-bar">
      <Link
        to="/dashboard"
        className={`app-bar-tab ${location.pathname === '/dashboard' ? 'active' : ''}`}
      >
        <span className="tab-icon">📊</span>
        <span>Dashboard</span>
      </Link>

      <Link
        to="/scan"
        className="scan-floating-btn"
        title="Scan Bill"
      >
        📸
      </Link>

      <Link
        to="/dashboard"
        className={`app-bar-tab ${location.pathname === '/expiring' ? 'active' : ''}`}
      >
        <span className="tab-icon">🛡️</span>
        <span>Warranties</span>
      </Link>
    </nav>
  );
};

export default BottomNav;
