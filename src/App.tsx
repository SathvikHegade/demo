import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './layout/Navbar';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Report } from './pages/Report';

// Main App wrapper matching the Forge theme
export function App() {
  return (
    <Router>
      <div className="min-h-screen text-forge-text selection:bg-forge-primary selection:text-white flex flex-col relative w-full overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-[-10%] -left-1/4 w-[50%] h-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1)_0%,rgba(0,0,0,0)_50%)] pointer-events-none z-[-1]" />
        <div className="absolute bottom-[-10%] -right-1/4 w-[50%] h-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.1)_0%,rgba(0,0,0,0)_50%)] pointer-events-none z-[-1]" />
        
        <Routes>
          {/* Main Layout containing Navbar */}
          <Route path="/" element={
            <>
              <Navbar />
              <Landing />
            </>
          } />
          
          <Route path="/dashboard/:jobId" element={
            <>
              <Navbar />
              <Dashboard />
            </>
          } />
          
          {/* Report route without main layout padding */}
          <Route path="/report/:jobId" element={<Report />} />
        </Routes>
      </div>
    </Router>
  );
}