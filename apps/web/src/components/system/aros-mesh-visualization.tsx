'use client';

import React from 'react';
import Image from 'next/image';

interface Props {
  className?: string;
}

/**
 * ArosMeshVisualization
 * 
 * Provides a premium 3D-styled visualization of the AROS system state.
 * Uses a pre-rendered 3D asset with Tailwind-based micro-animations and
 * robust accessibility considerations.
 */
export function ArosMeshVisualization({ className = '' }: Props) {
  return (
    <div 
      className={`relative overflow-hidden rounded-xl bg-slate-950 p-6 ${className}`}
      role="region"
      aria-labelledby="mesh-viz-title"
    >
      {/* Accessibility: Descriptive title for screen readers */}
      <h3 id="mesh-viz-title" className="sr-only">
        System Topology Visualization
      </h3>

      <div className="flex flex-col items-center justify-center space-y-6 lg:flex-row lg:space-x-8 lg:space-y-0">
        <div className="relative h-64 w-64 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl">
          {/* 
            3D Asset: Pre-rendered Blender Cycles output.
            Animation: Floating 'breath' effect using Tailwind mesh-float.
          */}
          <div className="w-full h-full motion-safe:animate-mesh-float">
            <Image
              src="/aros_system_mesh.png"
              alt="3D crystalline orbital mesh representing accessibility data remediation."
              width={256}
              height={256}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
          
          {/* Glassmorphism overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none" />
        </div>

        <div className="flex-1 space-y-4 text-center lg:text-left">
          <div className="space-y-1">
            <h4 className="text-xl font-bold tracking-tight text-white">
              Neural Remediation Mesh
            </h4>
            <p className="text-sm leading-relaxed text-slate-400">
              Visualizing real-time propagation of accessibility fixes across your organization&apos;s digital topography.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Mesh Integrity" value="99.9%" trend="Stable" />
            <StatCard label="Remediation Velocity" value="2.4k/s" trend="Optimal" />
          </div>

          {/* Accessibility Indicator */}
          <div 
            className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-emerald-400/80"
            aria-hidden="true"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
            Operational Awareness Active
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/5 p-3 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-lg font-mono font-bold text-white">{value}</span>
        <span className="text-[10px] text-emerald-400">{trend}</span>
      </div>
    </div>
  );
}
