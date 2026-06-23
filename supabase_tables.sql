-- HABILITAR REALTIME PARA MENSAJES
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- TABLA DE PARTICIPANTES DE CHATS
CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;

-- TABLA DE CONTACTOS
CREATE TABLE IF NOT EXISTS contacts (
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, contact_user_id)
);

-- TABLA DE NEGOCIOS
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  business_name TEXT NOT NULL,
  description TEXT,
  image_url TEXT DEFAULT '',
  zone TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  contact_name TEXT NOT NULL,
  contact_phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE MOMENTOS (Historias/Estados)
CREATE TABLE IF NOT EXISTS momentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT DEFAULT 'image',
  content TEXT DEFAULT '',
  name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '',
  has_unseen BOOLEAN DEFAULT true,
  image TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  anim_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE momentos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TABLA DE VISTAS DE MOMENTOS
CREATE TABLE IF NOT EXISTS momento_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  momento_id UUID NOT NULL REFERENCES momentos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA DE REACCIONES A MOMENTOS
CREATE TABLE IF NOT EXISTS momento_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  momento_id UUID NOT NULL REFERENCES momentos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
