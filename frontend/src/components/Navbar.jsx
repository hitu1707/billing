import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Delete your account permanently? This removes all of your bills, scanned images and personal data. This cannot be undone.'
    );
    if (!confirmed) return;

    await deleteAccount();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          🧾 BillTracker
        </Link>

        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
              <Link to="/scan" className="nav-link">Scan Bill</Link>

              <div className="navbar-user">
                {user?.avatar && (
                  <img src={user.avatar} alt="Avatar" className="user-avatar" />
                )}
                <span className="user-name">{user?.name || 'User'}</span>
                <button onClick={handleLogout} className="btn-logout">Logout</button>
                <button onClick={handleDeleteAccount} className="btn-delete-account">Delete Account</button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
