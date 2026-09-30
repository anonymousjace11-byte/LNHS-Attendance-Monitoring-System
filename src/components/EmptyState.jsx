import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, subtitle }) {
  return (
    <div className="empty-state">
      <Icon className="empty-state__icon" aria-hidden="true" />
      <div className="empty-state__title">{title}</div>
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
    </div>
  );
}

export function EmptyTableRow({ colSpan, ...props }) {
  return (
    <tr>
      <td className="empty-state-cell" colSpan={colSpan}>
        <EmptyState {...props} />
      </td>
    </tr>
  );
}