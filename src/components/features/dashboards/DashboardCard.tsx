import { type KeyboardEvent, type MouseEvent } from "react";
import { LayoutDashboard, Clock, BarChart3, Users, Trash2, ArrowUpRight } from "lucide-react";
import { ActionButtonGroup } from "../../shared/ActionButtonGroup";
import { initialsFor, toneFor } from "../../shared/tone";

interface Dashboard {
  id: number | string;
  name: string;
  description: string;
  charts: number;
  lastUpdated: string;
  icon?: any;
  collaborators?: number;
}

interface DashboardCardProps {
  dashboard: Dashboard;
  viewMode: 'grid' | 'list';
  onDelete: (e: MouseEvent) => void;
  onClick: () => void;
}

/** Decorative bar cover, stable per dashboard so each card is recognisable. */
function DashboardCover({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) | 0;
  const bars = Array.from({ length: 9 }, (_, i) => 28 + (Math.abs(Math.sin(h + i * 1.7)) * 62));
  const peak = bars.indexOf(Math.max(...bars));
  return (
    <div className="ws-dash-cover" aria-hidden="true">
      {bars.map((pct, i) => (
        <span key={i} className={i === peak ? "is-peak" : ""} style={{ height: `${pct}%` }} />
      ))}
    </div>
  );
}

export function DashboardCard({ dashboard, viewMode, onDelete, onClick }: DashboardCardProps) {
  const Icon = dashboard.icon || LayoutDashboard;
  const tone = toneFor(dashboard.name);
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
      e.preventDefault();
      onClick();
    }
  };
  const deleteAction = (
    <ActionButtonGroup
      actions={[
        {
          icon: <Trash2 />,
          onClick: (e) => {
            e?.stopPropagation();
            onDelete(e as MouseEvent);
          },
          label: "Delete dashboard",
          variant: "ghost",
          className: "hover:text-destructive"
        }
      ]}
    />
  );
  const stats = (
    <>
      <span className="ws-dash-stat" title={`${dashboard.charts} charts`}>
        <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
        {dashboard.charts} {dashboard.charts === 1 ? "chart" : "charts"}
      </span>
      {!!dashboard.collaborators && (
        <span className="ws-dash-stat" title={`${dashboard.collaborators} collaborators`}>
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          {dashboard.collaborators}
        </span>
      )}
      <span className="ws-dash-stat">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        {dashboard.lastUpdated}
      </span>
    </>
  );

  if (viewMode === 'list') {
    return (
      <div className="ws-dash-row group" role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} aria-label={`Open ${dashboard.name}`}>
        <span className={`app-tile tone-${tone}`} aria-hidden="true">{initialsFor(dashboard.name)}</span>
        <div className="ws-dash-row-text">
          <p className="ws-dash-name">{dashboard.name}</p>
          <p className="ws-dash-desc ws-dash-desc--one">{dashboard.description || "No description"}</p>
        </div>
        <div className="ws-dash-row-stats">{stats}</div>
        <div className="ws-dash-tools">{deleteAction}</div>
      </div>
    );
  }

  return (
    <div className="ws-dash-card group" role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} aria-label={`Open ${dashboard.name}`}>
      <div className={`ws-dash-cover-wrap tone-${tone}`}>
        <DashboardCover seed={String(dashboard.id) + dashboard.name} />
        <span className="ws-dash-open" aria-hidden="true">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
      <div className="ws-dash-body">
        <div className="ws-dash-title-row">
          <span className={`app-tile tone-${tone}`} aria-hidden="true">
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="ws-dash-name">{dashboard.name}</p>
            <p className="ws-dash-desc">{dashboard.description || "No description"}</p>
          </div>
          <div className="ws-dash-tools">{deleteAction}</div>
        </div>
        <div className="ws-dash-foot">{stats}</div>
      </div>
    </div>
  );
}
