interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-slate-900">{title}</h3>
      {description && <p className="text-slate-500 mt-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
