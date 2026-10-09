import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import '../styles/auth.css';

const Login = () => {
  const [searchParams] = useSearchParams();

  const urlStep = searchParams.get('step');
  const urlEmail = searchParams.get('email');
  const urlError = searchParams.get('error');

  const [step, setStep] = useState(() => (urlStep === 'otp' && urlEmail ? 2 : 1));
  const [targetEmail, setTargetEmail] = useState(() => urlEmail || '');
  const [error, setError] = useState(() => (urlError ? 'Google login failed. Please try again.' : ''));
  const [successMsg, setSuccessMsg] = useState(() =>
    urlStep === 'otp' && urlEmail ? 'Enter the 6-digit verification code sent to your email.' : ''
  );

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const { checkAuthStatus } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await API.post('/auth/login', formData);

      if (res.data.data?.requiresOtp) {
        setTargetEmail(res.data.data.email);
        setStep(2);
      } else {
        await checkAuthStatus();
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      await API.post('/auth/verify-otp', {
        email: targetEmail || formData.email,
        otp
      });
      await checkAuthStatus();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccessMsg('');
    try {
      await API.post('/auth/resend-otp', {
        email: targetEmail || formData.email
      });
      setSuccessMsg('A new 6-digit code has been sent to your email!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {step === 2 ? (
          <>
            <div className="auth-header">
              <h2>📩 Check Your Email</h2>
              <p>We sent a 6-digit verification code to:</p>
              <strong style={{ color: '#4f46e5' }}>{targetEmail || formData.email}</strong>
            </div>

            {error && <div className="error-message">{error}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

            <form onSubmit={handleOtpSubmit}>
              <div className="form-group">
                <label>Enter 6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{
                    textAlign: 'center',
                    fontSize: '26px',
                    letterSpacing: '8px',
                    fontWeight: 'bold'
                  }}
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleResendOtp}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                🔄 Didn't receive code? Resend
              </button>
            </div>

            <div className="auth-footer">
              <button
                onClick={() => {
                  setStep(1);
                  setOtp('');
                  setError('');
                  setSuccessMsg('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                ← Back to login
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-header">
              <h2>Welcome Back</h2>
              <p>Login to track your bills and warranties</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
                {loading ? 'Sending Code...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <div className="social-auth-grid">
              <a href={`${API.defaults.baseURL}/auth/google`} className="btn-social btn-google">
                🌐 Continue with Google
              </a>
              <a href={`${API.defaults.baseURL}/auth/facebook`} className="btn-social btn-facebook">
                📘 Continue with Facebook
              </a>
              <a href={`${API.defaults.baseURL}/auth/discord`} className="btn-social btn-discord">
                🎮 Continue with Discord
              </a>
            </div>

            <div className="auth-footer">
              Don't have an account? <Link to="/register">Create one</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
