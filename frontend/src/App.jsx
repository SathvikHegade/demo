import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './layout/Navbar';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Report } from './pages/Report';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<><Navbar /><Landing /></>} />
        <Route path="/dashboard/:jobId" element={<><Navbar /><Dashboard /></>} />
        <Route path="/report/:jobId" element={<Report />} />
      </Routes>
    </Router>
  );
}
