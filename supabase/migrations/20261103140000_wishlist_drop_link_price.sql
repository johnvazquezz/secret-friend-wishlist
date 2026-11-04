-- La lista de deseos ya no tiene enlace ni precio aproximado (decisión de producto).
-- Los privilegios por columna sobre estas columnas desaparecen con ellas.
alter table public.wishlist_items
  drop column url,
  drop column price_hint;
