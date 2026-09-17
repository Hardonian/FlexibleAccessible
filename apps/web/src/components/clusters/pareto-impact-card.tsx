import Link from "next/link";
import { TrendingUp, Sparkles, ArrowRight, CheckCircle2, Layers, DollarSign, Clock } from "lucide-react";

interface ParetoCluster {
  id: string;
  name: string;
  severity: string;
  findingCount: number;
  pageCount: number;
  impactScore: number;
  paretoRank: number;
  issuePercentage: number;
  estimatedHours: number;
  estimatedCost: number;
  cumulativePercentage: number;
}

interface ParetoImpactCardProps {
  analysis: {
    clusters: ParetoCluster[];
    totalImpact: number;
    paretoCut: number;
  };
  siteId?: string;
}

export function ParetoImpactCard({ analysis, siteId }: ParetoImpactCardProps) {
  const { clusters, paretoCut } = analysis;

  if (clusters.length === 0) {
    return null;
  }

  const topClusters = clusters.slice(0, Math.max(paretoCut, 3));
  const totalHoursSaved = topClusters.reduce((sum, c) => sum + c.estimatedHours, 0);
  const totalCostSaved = topClusters.reduce((sum, c) => sum + c.estimatedCost, 0);
  const topCutPercentage = topClusters[topClusters.length - 1]?.cumulativePercentage ?? 80;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/70 via-white to-brand-50/50 p-6 shadow-sm">
      {/* Decorative accent */}
      <div className="absolute right-0 top-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-brand-100/50 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              Pareto 80/20 Leverage Rule
            </span>
            <span className="text-xs font-medium text-slate-500">
              High-ROI Remediation Sequencing
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Fixing just the top {Math.max(paretoCut, 1)} template {paretoCut === 1 ? "cluster" : "clusters"} resolves{" "}
            <span className="text-brand-700 underline decoration-brand-400 decoration-2 underline-offset-2">
              ~{Math.round(topCutPercentage)}% of site defects
            </span>
          </h2>

          <p className="text-xs text-slate-600 leading-relaxed">
            Accessibility issues concentrate in shared design system components and templates. Remediating these high-leverage clusters eliminates defects across dozens of pages in a single pull request.
          </p>
        </div>

        {/* ROI Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5 text-brand-600" /> Dev Time Saved
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              ~{Math.round(totalHoursSaved)} hrs
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Estimated ROI
            </div>
            <p className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
              ${Math.round(totalCostSaved).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* High-Leverage Clusters List */}
      <div className="relative z-10 mt-6 pt-5 border-t border-teal-100 grid grid-cols-1 md:grid-cols-3 gap-3">
        {topClusters.map((cluster, index) => (
          <Link
            key={cluster.id}
            href={`/clusters/${cluster.id}`}
            className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-brand-400 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  #{index + 1}
                </span>
                <span className={`badge text-[10px] uppercase font-mono ${
                  cluster.severity === "CRITICAL"
                    ? "badge-critical"
                    : cluster.severity === "SERIOUS"
                    ? "badge-moderate"
                    : "badge-minor"
                }`}>
                  {cluster.severity}
                </span>
              </div>

              <h3 className="mt-2 text-xs font-semibold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                {cluster.name}
              </h3>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>{cluster.pageCount} pages impacted</span>
              <span className="flex items-center gap-1 text-brand-600 font-medium group-hover:translate-x-0.5 transition-transform">
                View Fix <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
