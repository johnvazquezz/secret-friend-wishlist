-- Datos de demo SOLO para el entorno local (npm run local:up -- --demo / local:reset -- --demo).
-- Nunca se ejecuta en producción ni forma parte de seed.sql (los tests parten del seed limpio).
--
-- Deja un evento publicado con 5 participantes (Jorge no participa), deseos, gustos,
-- conversaciones del sorteo y libres, y un aviso del organizador.
-- Cuentas (del seed): admin, ana, luis, maria, pedro, sofia, jorge  @local.test / Amigo2026local
do $$
declare
  v_admin constant uuid := '00000000-0000-4000-8000-000000000001';
  v_people constant uuid[] := array[
    '00000000-0000-4000-8000-000000000002', -- ana
    '00000000-0000-4000-8000-000000000003', -- luis
    '00000000-0000-4000-8000-000000000004', -- maria
    '00000000-0000-4000-8000-000000000005', -- pedro
    '00000000-0000-4000-8000-000000000006'  -- sofia
  ];
  v_jorge constant uuid := '00000000-0000-4000-8000-000000000007';
  v_event uuid;
  v_id uuid;
  v_thread uuid;
  v_wishes constant text[][] := array[
    array['Taza de cerámica artesanal', 'Libro de recetas italianas'],
    array['Auriculares inalámbricos', 'Juego de mesa cooperativo'],
    array['Planta suculenta con maceta bonita', 'Velas aromáticas'],
    array['Calcetines navideños divertidos', 'Café de especialidad'],
    array['Cuaderno de dibujo', 'Set de acuarelas']
  ];
  v_likes constant text[] := array[
    'Cocinar, el café y la música indie',
    'Videojuegos, series de ciencia ficción',
    'Plantas, decoración y tés',
    'Fútbol, café y chistes malos',
    'Dibujar, museos y gatos'
  ];
begin
  if exists (select 1 from public.events where status <> 'finished') then
    raise notice 'demo: ya hay un evento activo, no se crean datos de demo';
    return;
  end if;

  -- Como el admin (las RPC usan auth.uid()).
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  insert into public.events (name, description, budget_amount, currency, location, registration_deadline, exchange_at, created_by)
  values (
    'Navidad 2026 (demo)',
    'Evento de prueba del entorno local. ¡Escribe, despista y prepara tu regalo! 🎁',
    20, 'USD', 'Sala grande',
    now() + interval '1 day', now() + interval '7 days', v_admin
  )
  returning id into v_event;

  insert into public.event_participants (event_id, user_id)
  select v_event, unnest(v_people || v_jorge);

  perform public.open_event(v_event);
  for i in 1 .. array_length(v_people, 1) loop
    perform public.admin_set_participation(v_event, v_people[i], 'confirmed');
  end loop;
  perform public.admin_set_participation(v_event, v_jorge, 'declined');

  -- Deseos y gustos de cada participante.
  for i in 1 .. array_length(v_people, 1) loop
    insert into public.wishlist_items (user_id, title, priority, position)
    values (v_people[i], v_wishes[i][1], 1, 0), (v_people[i], v_wishes[i][2], 2, 1);
    insert into public.user_preferences (user_id, likes, sizes)
    values (v_people[i], v_likes[i], 'Talla M')
    on conflict (user_id) do nothing;
  end loop;

  perform public.run_draw(v_event);
  perform public.publish_draw(v_event);

  -- Cada participante saluda a la persona a la que regala (hilo del sorteo, anónimo).
  for i in 1 .. array_length(v_people, 1) loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_people[i], 'role', 'authenticated')::text, true);
    select c.thread_id into v_thread
    from public.get_my_conversations(v_event) c where c.is_my_recipient;
    perform public.send_thread_message(v_thread, '¡Hola! Soy tu amigo secreto 🤫 ¿Qué color te gusta más?');
  end loop;

  -- Chats libres: Ana escribe en secreto a Pedro; Luis escribe con su nombre a María.
  perform set_config('request.jwt.claims', json_build_object('sub', v_people[1], 'role', 'authenticated')::text, true);
  v_id := public.start_conversation(v_event, v_people[4], true, '¿Ya sabes quién soy? 👀');
  perform set_config('request.jwt.claims', json_build_object('sub', v_people[2], 'role', 'authenticated')::text, true);
  v_id := public.start_conversation(v_event, v_people[3], false, '¿Vamos juntos a comprar los regalos?');

  -- Aviso del organizador.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.send_announcement('Bienvenidos al entorno de pruebas', 'Todo lo de aquí es de mentira: prueba sin miedo 🎄');

  perform set_config('request.jwt.claims', '', true);
  raise notice 'demo: evento "Navidad 2026 (demo)" creado y publicado';
end;
$$;
