/**
 * Prometheus Metrics Exporter
 * For FlexibleAccessible: WCAG violations, scan results, fix validation
 */

import { Registry, Counter, Gauge, Histogram } from 'prom-client';

const register = new Registry();

export const scansTotal = new Counter({
  name: 'accessible_scans_total',
  help: 'Total scans',
  labelNames: ['status', 'wcag_level'],
  registers: [register],
});

export const violationsOpen = new Gauge({
  name: 'accessible_violations_open',
  help: 'Open WCAG violations',
  labelNames: ['wcag_level', 'principle'],
  registers: [register],
});

export const violationsFixed = new Counter({
  name: 'accessible_violations_fixed_total',
  help: 'Total violations fixed',
  labelNames: ['wcag_level', 'principle'],
  registers: [register],
});

export const falsePositives = new Counter({
  name: 'accessible_false_positives_total',
  help: 'Reported false positives',
  labelNames: ['violation_type'],
  registers: [register],
});
