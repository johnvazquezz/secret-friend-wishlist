import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getErrorMessage } from '../../lib/errors';
import { MAX_WISHLIST_ITEMS, type WishlistItem } from './api';
import {
  useCreateWishlistItem,
  useDeleteWishlistItem,
  useReorderWishlist,
  useUpdateWishlistItem,
} from './hooks';
import WishlistItemForm from './WishlistItemForm';
import { WishlistItemContent } from './WishlistView';

export default function WishlistEditor({
  items,
  currency,
}: {
  items: WishlistItem[];
  currency?: string;
}) {
  const create = useCreateWishlistItem();
  const update = useUpdateWishlistItem();
  const remove = useDeleteWishlistItem();
  const reorder = useReorderWishlist();
  const [adding, setAdding] = useState(items.length === 0);
  const [editing, setEditing] = useState<WishlistItem | null>(null);
  const [error, setError] = useState('');

  const full = items.length >= MAX_WISHLIST_ITEMS;
  const onError = (err: unknown) => setError(getErrorMessage(err));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setError('');
    reorder.mutate(ids, { onError });
  };

  const handleDelete = (item: WishlistItem) => {
    if (!window.confirm(`¿Quitar "${item.title}" de tu lista?`)) return;
    setError('');
    remove.mutate(item.id, { onError });
  };

  const iconButton =
    'p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <li key={item.id} className="py-3">
              <WishlistItemContent
                item={item}
                currency={currency}
                actions={
                  <div className="flex items-start gap-1 shrink-0">
                    <button
                      type="button"
                      className={iconButton}
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || reorder.isPending}
                      aria-label={`Subir "${item.title}"`}
                    >
                      <ArrowUp aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1 || reorder.isPending}
                      aria-label={`Bajar "${item.title}"`}
                    >
                      <ArrowDown aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      onClick={() => setEditing(item)}
                      aria-label={`Editar "${item.title}"`}
                    >
                      <Pencil aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={`${iconButton} hover:!text-red-600`}
                      onClick={() => handleDelete(item)}
                      aria-label={`Quitar "${item.title}"`}
                    >
                      <Trash2 aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {full ? (
        <p className="text-sm text-gray-500">
          Llegaste al máximo de {MAX_WISHLIST_ITEMS} deseos. Quita alguno para añadir otro.
        </p>
      ) : adding ? (
        <div className="bg-gray-50 rounded-xl p-4">
          <WishlistItemForm
            submitLabel="Añadir a mi lista"
            onSubmit={(input) =>
              create.mutateAsync({
                input,
                position: items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0,
              })
            }
            onCancel={items.length > 0 ? () => setAdding(false) : undefined}
          />
        </div>
      ) : (
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="w-5 h-5" />
          Añadir deseo
        </Button>
      )}

      {editing && (
        <Modal title="Editar deseo" onClose={() => setEditing(null)}>
          <WishlistItemForm
            item={editing}
            submitLabel="Guardar"
            onSubmit={async (input) => {
              await update.mutateAsync({ id: editing.id, input });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
