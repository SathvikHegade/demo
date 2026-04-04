import React from 'react';

const MAP = {
  CRITICAL: 'chip chip-critical', SEVERE: 'chip chip-critical', EXTREME: 'chip chip-critical',
  WARNING:  'chip chip-warning',  MODERATE: 'chip chip-warning',
  INFO:     'chip chip-info',     MILD: 'chip chip-info',
  BALANCED: 'chip chip-success',
};

export const SeverityBadge = ({ level }) => (
  <span className={MAP[level?.toUpperCase()] ?? MAP[level] ?? 'chip chip-info'}>{level}</span>
);
