-- Rode isto no SQL Editor do Supabase (menu lateral > SQL Editor > New query).

create table if not exists public.estoque_dados (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.estoque_dados enable row level security;

-- Acesso liberado para a chave pública do app.
-- Qualquer pessoa com o endereço do site consegue ler e gravar,
-- então trate o link como interno e não coloque dado sensível aqui.
drop policy if exists "acesso_app" on public.estoque_dados;
create policy "acesso_app" on public.estoque_dados
  for all to anon
  using (true) with check (true);
