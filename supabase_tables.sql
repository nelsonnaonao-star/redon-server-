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
