import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-forge-border bg-forge-bg/80 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-forge-primary to-forge-secondary flex items-center justify-center p-[1px]">
            <div className="bg-forge-surface w-full h-full rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-forge-primary group-hover:animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <span className="font-display font-bold text-xl tracking-tight">Data<span className="text-gradient">Forge</span></span>
        </Link>
        <div className="hidden md:flex items-center space-x-6 font-mono text-sm tracking-wide text-forge-muted">
          <Link to="/about" className="hover:text-forge-primary transition-colors">Documentation</Link>
          <a href="https://github.com/SathvikHegade/DataForge" target="_blank" rel="noreferrer" className="hover:text-forge-secondary transition-colors">GitHub</a>
        </div>
      </div>
    </nav>
  );
};