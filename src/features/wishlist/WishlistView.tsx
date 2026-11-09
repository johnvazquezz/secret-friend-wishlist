import { Heart } from 'lucide-react';
import type { ReactNode } from 'react';
import Badge, { type BadgeTone } from '../../components/ui/Badge';
import type { WishlistItem } from './api';
import { PRIORITY_LABELS } from './schemas';

const priorityTone: Record<number, BadgeTone> = {
  1: 'primary',
  2: 'neutral',
  3: 'neutral',
};

interface WishlistItemContentProps {
  item: WishlistItem;
  actions?: ReactNode;
}

export function WishlistItemContent({ item, actions }: WishlistItemContentProps) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${
          item.priority === 1 ? 'bg-primary-50' : 'bg-stone-100'
        }`}
      >
        <Heart
          className={`w-4 h-4 ${item.priority === 1 ? 'text-primary-600 fill-primary-600' : 'text-stone-400'}`}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium text-stone-900 break-words">{item.title}</p>
          <Badge tone={priorityTone[item.priority] ?? 'neutral'}>
            {PRIORITY_LABELS[item.priority] ?? PRIORITY_LABELS[2]}
          </Badge>
        </div>
        {item.notes && (
          <p className="mt-0.5 text-sm text-stone-600 whitespace-pre-wrap break-words">
            {item.notes}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}

interface WishlistViewProps {
  items: WishlistItem[];
  emptyMessage?: string;
}

/** Lista de deseos de solo lectura. */
export default function WishlistView({
  items,
  emptyMessage = 'Todavía no ha añadido deseos.',
}: WishlistViewProps) {
  if (items.length === 0) return <p className="text-sm text-stone-500 py-2">{emptyMessage}</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.id}>
          <WishlistItemContent item={item} />
        </li>
      ))}
    </ul>
  );
}
