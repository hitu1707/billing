import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './Navbar';
import * as AuthContext from '../context/AuthContext';

describe('Navbar Component', () => {
  it('shows Login & Sign Up when user is logged out', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      logout: vi.fn()
    });

    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('shows User Name, Dashboard, and Logout when user is logged in', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { name: 'John Doe', avatar: null },
      isAuthenticated: true,
      logout: vi.fn()
    });

    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Scan Bill')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});