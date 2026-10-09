import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import '../styles/bills.css';
import '../styles/mobileCamera.css';

const ScanBill = () => {
  const [stream, setStream] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Live camera viewfinder not available, using file picker:', err);
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, cameraActive]);

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `bill-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError('');
  };

  const handleScanWithAI = async () => {
    if (!capturedFile) {
      setError('Please capture or select a bill photo first');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('billImage', capturedFile);

    try {
      const res = await API.post('/bills/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to scan bill. Make sure your server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '600px', margin: '20px auto 40px' }}>
      <div className="card">
        <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>📸 Scan Bill & Receipt</h2>
        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
          Capture a clear photo of your receipt to auto-extract warranty and expiry dates.
        </p>

        {error && <div className="error-message">{error}</div>}

        {cameraActive && !previewUrl && (
          <div className="camera-container">
            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />

            <div className="camera-overlay">
              <div className="scanner-frame"></div>
              <div className="scanner-hint">Align receipt within the frame</div>
            </div>

            <div className="camera-controls">
              <label htmlFor="camera-file-picker" className="camera-secondary-btn">
                📁 Files
                <input
                  id="camera-file-picker"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </label>

              <button
                type="button"
                onClick={takeSnapshot}
                className="btn-shutter"
                title="Capture Photo"
              />

              <button
                type="button"
                onClick={stopCamera}
                className="camera-secondary-btn"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!cameraActive && !previewUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={startCamera}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              📷 Open Camera Viewfinder
            </button>

            <label
              htmlFor="native-upload-input"
              className="btn"
              style={{
                background: '#f3f4f6',
                color: '#374151',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #d1d5db'
              }}
            >
              📱 Choose from Gallery / Take Photo
              <input
                id="native-upload-input"
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}

        {previewUrl && !result && (
          <div className="image-preview-container">
            <img src={previewUrl} alt="Receipt Preview" className="image-preview" />

            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button
                onClick={handleRetake}
                className="btn"
                style={{ flex: 1, background: '#e5e7eb', color: '#374151' }}
                disabled={loading}
              >
                🔄 Retake
              </button>
              <button
                onClick={handleScanWithAI}
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={loading}
              >
                {loading ? 'Analyzing with AI...' : '🚀 Scan with AI'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="scan-progress">
            <div className="spinner"></div>
            <h3>Reading Bill with AI...</h3>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>
              Extracting product names, dates, prices, and warranty terms.
            </p>
          </div>
        )}

        {result && (
          <div className="result-card">
            <div className="success-message">
              ✅ Bill Scanned & Saved to Database!
            </div>

            <h3 style={{ fontSize: '18px', color: '#111827' }}>{result.productName}</h3>

            <div className="result-grid">
              <div><strong>Vendor:</strong> {result.vendorName || 'N/A'}</div>
              <div><strong>Price:</strong> {result.totalPrice ? `₹${result.totalPrice}` : 'N/A'}</div>
              <div><strong>Warranty:</strong> {result.warrantyPeriod || 'N/A'}</div>
              <div><strong>Status:</strong> {result.warrantyStatus}</div>
              <div><strong>Purchased:</strong> {result.purchaseDate?.split('T')[0] || 'N/A'}</div>
              <div><strong>Warranty End:</strong> {result.warrantyEndDate?.split('T')[0] || 'N/A'}</div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                View in Dashboard
              </button>
              <button
                onClick={handleRetake}
                className="btn"
                style={{ background: '#f3f4f6', color: '#374151' }}
              >
                Scan Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanBill;
