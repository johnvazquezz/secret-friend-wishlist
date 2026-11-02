import { ExternalLink, Heart } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney } from '../../lib/format';
import type { WishlistItem } from './api';
import { isSafeUrl, PRIORITY_LABELS } from './schemas';

const priorityTone: Record<number, string> = {
  1: 'bg-primary/10 text-primary-dark',
  2: 'bg-gray-100 text-gray-700',
  3: 'bg-gray-50 text-gray-500',
};

function formatPrice(amount: number, currency?: string): string {
  return currency ? formatMoney(amount, currency) : String(amount);
}

interface WishlistItemContentProps {
  item: WishlistItem;
  currency?: string;
  actions?: ReactNode;
}

export function WishlistItemContent({ item, currency, actions }: WishlistItemContentProps) {
  const safeUrl = item.url && isSafeUrl(item.url) ? item.url : null;
  return (
    <div className="flex gap-3">
      <Heart
        aria-hidden="true"
        className={`w-5 h-5 mt-0.5 shrink-0 ${item.priority === 1 ? 'text-primary fill-primary' : 'text-primary/50'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-gray-800 break-words">{item.title}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${priorityTone[item.priority] ?? priorityTone[2]}`}
          >
            {PRIORITY_LABELS[item.priority] ?? PRIORITY_LABELS[2]}
          </span>
          {item.price_hint != null && (
            <span className="text-xs text-gray-500">
              aprox. {formatPrice(item.price_hint, currency)}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{item.notes}</p>
        )}
        {safeUrl && (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark break-all"
          >
            <ExternalLink aria-hidden="true" className="w-4 h-4 shrink-0" />
            {new URL(safeUrl).hostname}
          </a>
        )}
      </div>
      {actions}
    </div>
  );
}

interface WishlistViewProps {
  items: WishlistItem[];
  currency?: string;
  emptyMessage?: string;
}

/** Lista de deseos de solo lectura. */
export default function WishlistView({
  items,
  currency,
  emptyMessage = 'Todavía no ha añadido deseos.',
}: WishlistViewProps) {
  if (items.length === 0) return <p className="text-gray-500 italic">{emptyMessage}</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <WishlistItemContent item={item} currency={currency} />
        </li>
      ))}
    </ul>
  );
}
