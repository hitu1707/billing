import  { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import BillCard from '../components/BillCard';
import '../styles/bills.css';

const Dashboard = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadBills = async () => {
      try {
        const res = await API.get('/bills');
        if (isMounted) {
          setBills(res.data.data || []);
        }
      } catch (err) {
        console.error('Error loading bills:', err);
        if (isMounted) {
          setError('Failed to fetch bills. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBills();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBills = useMemo(() => {
    let result = [...bills];

    if (activeFilter !== 'All') {
      result = result.filter((bill) => bill.warrantyStatus === activeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (bill) =>
          bill.productName?.toLowerCase().includes(q) ||
          bill.vendorName?.toLowerCase().includes(q) ||
          bill.category?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [search, activeFilter, bills]);

  const handleDelete = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;

    try {
      await API.delete(`/bills/${billId}`);
      setBills((prevBills) => prevBills.filter((b) => b._id !== billId));
    } catch (err) {
      console.error('Error deleting bill:', err);
      alert('Failed to delete bill.');
    }
  };

  const totalBills = bills.length;
  const activeWarranties = bills.filter((b) => b.warrantyStatus === 'Active').length;
  const expiringSoon = bills.filter((b) => b.warrantyStatus === 'Expiring Soon').length;
  const expired = bills.filter((b) => b.warrantyStatus === 'Expired').length;

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
          <h1>My Tracked Bills</h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Monitor your warranties, expiry dates, and receipts
          </p>
        </div>
        <Link to="/scan" className="btn btn-primary">
          + Scan New Bill
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Bills</span>
          <span className="stat-value">{totalBills}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Warranty</span>
          <span className="stat-value" style={{ color: '#16a34a' }}>
            {activeWarranties}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expiring Soon (&le;30d)</span>
          <span className="stat-value" style={{ color: '#d97706' }}>
            {expiringSoon}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expired</span>
          <span className="stat-value" style={{ color: '#dc2626' }}>
            {expired}
          </span>
        </div>
      </div>

      <div className="controls-bar">
        <input
          type="text"
          placeholder="Search by product, store, or category..."
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-tabs">
          {['All', 'Active', 'Expiring Soon', 'Expired'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading your bills...</div>
      ) : filteredBills.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧾</div>
          <h3>No bills found</h3>
          <p style={{ marginTop: '6px' }}>
            {search || activeFilter !== 'All'
              ? 'Try changing your search or filter criteria'
              : 'Scan your first bill to start tracking warranties and expiry dates!'}
          </p>
          {!search && activeFilter === 'All' && (
            <Link
              to="/scan"
              className="btn btn-primary"
              style={{ marginTop: '16px', display: 'inline-block' }}
            >
              Scan Your First Bill
            </Link>
          )}
        </div>
      ) : (
        <div className="bills-grid">
          {filteredBills.map((bill) => (
            <BillCard key={bill._id} bill={bill} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
