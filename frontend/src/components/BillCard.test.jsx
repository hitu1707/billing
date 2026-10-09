import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BillCard from './BillCard';

describe('BillCard Component', () => {
  const sampleBill = {
    _id: 'bill123',
    productName: 'Apple MacBook Pro M3',
    vendorName: 'Apple Store',
    totalPrice: 199999,
    purchaseDate: '2024-01-01',
    warrantyEndDate: '2026-01-01',
    warrantyStatus: 'Active',
    daysUntilWarrantyEnds: 300,
    billImageUrl: 'https://sample.com/bill.jpg'
  };

  it('renders product details and warranty badge correctly', () => {
    render(<BillCard bill={sampleBill} onDelete={vi.fn()} />);

    expect(screen.getByText('Apple MacBook Pro M3')).toBeInTheDocument();
    expect(screen.getByText('Apple Store')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('₹199,999')).toBeInTheDocument();
    expect(screen.getByText('300 days')).toBeInTheDocument();
  });

  it('renders download buttons when image is present', () => {
    render(<BillCard bill={sampleBill} onDelete={vi.fn()} />);

    const downloadButtons = screen.getAllByText(/Download/i);
    expect(downloadButtons.length).toBeGreaterThan(0);
  });

  it('calls onDelete when delete button is clicked and confirmed', () => {
    const handleDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<BillCard bill={sampleBill} onDelete={handleDelete} />);

    const deleteBtn = screen.getByTitle('Delete Bill');
    fireEvent.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledWith('bill123');
  });
});