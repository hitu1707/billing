import { useState } from 'react';

const BillCard = ({ bill, onDelete }) => {
  const [downloading, setDownloading] = useState(false);

  const getBadgeClass = (status) => {
    switch (status) {
      case 'Active':
        return 'badge badge-active';
      case 'Expiring Soon':
        return 'badge badge-expiring';
      case 'Expired':
        return 'badge badge-expired';
      default:
        return 'badge badge-unknown';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDownload = async () => {
    if (!bill.billImageUrl) {
      alert('No receipt image available for this bill.');
      return;
    }

    try {
      setDownloading(true);

      const response = await fetch(bill.billImageUrl);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;

      const cleanName = (bill.productName || 'bill')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .substring(0, 30);
      link.download = `${cleanName}_receipt.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed, opening in new tab:', err);
      window.open(bill.billImageUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bill-card">
      {bill.billImageUrl ? (
        <div style={{ position: 'relative' }}>
          <img src={bill.billImageUrl} alt={bill.productName} className="bill-card-img" />
          <button
            onClick={handleDownload}
            className="btn-quick-download"
            title="Download Receipt PNG"
            disabled={downloading}
          >
            {downloading ? '⏳' : '📥 Download'}
          </button>
        </div>
      ) : (
        <div
          className="bill-card-img"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af'
          }}
        >
          📄 No Image
        </div>
      )}

      <div className="bill-card-body">
        <div className="bill-card-header">
          <h3 className="bill-product-name">{bill.productName}</h3>
          <span className={getBadgeClass(bill.warrantyStatus)}>
            {bill.warrantyStatus}
          </span>
        </div>

        {bill.vendorName && (
          <div className="bill-info-row">
            <span>Store:</span>
            <strong>{bill.vendorName}</strong>
          </div>
        )}

        <div className="bill-info-row">
          <span>Purchased:</span>
          <span>{formatDate(bill.purchaseDate)}</span>
        </div>

        {bill.warrantyEndDate && (
          <div className="bill-info-row">
            <span>Warranty Ends:</span>
            <span>{formatDate(bill.warrantyEndDate)}</span>
          </div>
        )}

        {bill.daysUntilWarrantyEnds !== null && bill.daysUntilWarrantyEnds !== undefined && (
          <div className="bill-info-row">
            <span>Days Remaining:</span>
            <strong
              style={{
                color: bill.daysUntilWarrantyEnds < 30 ? '#dc2626' : '#16a34a'
              }}
            >
              {bill.daysUntilWarrantyEnds > 0
                ? `${bill.daysUntilWarrantyEnds} days`
                : 'Expired'}
            </strong>
          </div>
        )}

        {bill.expiryDate && (
          <div className="bill-info-row">
            <span>Expiry Date:</span>
            <span>{formatDate(bill.expiryDate)}</span>
          </div>
        )}

        <div className="bill-card-footer">
          <div className="bill-price">
            {bill.totalPrice || bill.price
              ? `₹${(bill.totalPrice || bill.price).toLocaleString()}`
              : 'N/A'}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownload}
              className="btn-action"
              title="Download Receipt PNG"
              disabled={downloading}
            >
              📥 Download PNG
            </button>
            <button
              onClick={() => onDelete(bill._id)}
              className="btn-action-delete"
              title="Delete Bill"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillCard;
