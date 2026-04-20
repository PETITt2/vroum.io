insert into app_users (id, email, password_hash, display_name, handle, bio, visibility)
values
  ('11111111-1111-1111-1111-111111111111', 'alex@example.com', '$demo$', 'Alex', 'alex.routes', 'Compte de demonstration pour le livrable.', 'public'),
  ('22222222-2222-2222-2222-222222222222', 'lea@example.com', '$demo$', 'Lea', 'lea.garage', 'Profil partage pour les tests collaboratifs.', 'public')
on conflict (id) do nothing;

insert into vehicles (id, owner_id, name, brand, model, year, plate, fuel_type, odometer, color, notes, visibility)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Peugeot 308 SW', 'Peugeot', '308 SW', 2018, 'AB-318-CD', 'Diesel', 128540, 'Bleu magnetique', 'Vehicule principal.', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Renault Zoe', 'Renault', 'Zoe', 2020, 'EF-920-GH', 'Electrique', 64200, 'Blanc nacre', 'Vehicule urbain.', 'public')
on conflict (id) do nothing;

insert into vehicle_members (vehicle_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'editor')
on conflict (vehicle_id, user_id) do nothing;
