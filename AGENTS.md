# RED ON Messaging App — Progress

## Bug Fixes (Completed)

### 1. Save Contact No Longer Opens Chat
- Created `api.createChat()` — inserts chat + participants without sending a "Hello" message.
- `ChatList.handleAddNewContact` uses `createChat()` instead of `sendDirectMessage('¡Hola! 👋')`.
- `App.tsx` `onAddChat` handler no longer calls `setActiveChatId` (stays on chat list).

### 2. FCM Push Notifications
- **Server**: `device` field was hardcoded to `'web'` — now uses `req.body.device` from client, so Android tokens route through native FCM instead of web-push VAPID.
- **AndroidManifest.xml**: Added `VIBRATE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `ACCESS_NETWORK_STATE` permissions.
- **MainActivity.java**: Creates native notification channels `redon-messages` and `redon-calls` with `IMPORTANCE_HIGH`, vibration, badge in `onCreate`.
- **Server FCM payload**: Routes to correct `channelId` per type (call vs message), includes `click_action: 'OPEN_APP'`, vibration, visibility, priority.
- **Push data**: Message notifications now include `{ chatId, type: 'message', contactId }` in data payload for deep linking.
- **Notification tap handling**: Added `pushNotificationActionPerformed` listener in `pushCapacitor.ts` — dispatches `'open-chat'` custom event when user taps a message notification, or `'incoming-call'` for call notifications.
- **Service worker**: Created `public/firebase-messaging-sw.js` with `onBackgroundMessage` → `showNotification()` for both call (`requireInteraction: true`, `tag: "call"`) and message notifications. Registered in `index.html`.
- **Open-chat event**: `App.tsx` listens for `'open-chat'` event to navigate to the correct chat on notification tap.

### 3. WebRTC Call Fix
- **Channel reference**: Extracted `sendToCallChannel()` helper using `callChannelRef.current` consistently across all signaling events (ICE candidates, SDP answer, end-call, reactions).
- **Remote stream**: Added `useEffect` in `CallSuite.tsx` that re-applies `srcObject` to `remoteVideoRef` and calls `.play()` whenever `remoteStream` state changes — fixes bug where conditional `<video>` remount loses `srcObject` from `pc.ontrack`.

### 4. Audio Voice Notes — Received Play Button Missing
- **Root cause**: `handleSendAudioMessage` only sent text `'🎤 Nota de voz'` via `api.sendMessage`. The audio blob was never uploaded anywhere — the receiver got a text-only message with no `audioUrl`, which rendered as `<p>` instead of `<AudioPlayer>`.
- **Fix**: `handleSendAudioMessage` now uploads the audio blob to Supabase Storage (`voice-notes` bucket) and passes the public URL to `api.sendMessage` via new `audioOptions` parameter.
- **`api.sendMessage`**: Accepts optional `{ audioUrl, audioDuration, mimeType }` — stored in `messages` table columns `audio_url`, `audio_duration`, `mime_type`.
- **`api.getMessages`**: Maps `audio_url`, `audio_duration`, `mime_type` from DB rows into `Message` type.
- **`socket.ts`**: `MessageHandler` and `NewChatHandler` types now include `audioUrl`, `audioDuration`, `mimeType` — passed through in the realtime INSERT handler.
- **`App.tsx`**: `setMessageHandler` and `setNewChatHandler` include audio fields when creating message objects.

### 5. FCM Server Consolidation
- **Root `server.js`**: Deleted — was a standalone FCM push server on port 3001, now redundant.
- **Main server (`server/src/index.js`)**: Now has FCM routes (`/api/fcm/register`, `/api/fcm/send`) with `web-push` (for browser) and optional `firebase-admin` (for Android native).
- **`server/src/routes/fcm.js`**: Env vars match `.env` (`VITE_FIREBASE_VAPID_KEY`, `FIREBASE_PRIVATE_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT`).
- **`push_tokens` table**: Created in local SQLite DB (`server/src/db.js`).
- **Frontend push URLs**: Updated `api.ts` and `pushCapacitor.ts` to use the Express server (port 5000) — no more port 3001 references.
- **Package.json scripts**: `dev:server` and `dev:all` now point to `server/src/index.js`.
- **`.env`**: `SERVER_PORT=3001` replaced with `PORT=5000`.

### 6. Import Fix in MediaEditor.tsx
- Moved `import { getMusicLibrary, getMusicCategories, MusicTrack }` from line 2037 (middle of file) to the top with other imports.

### 7. FCM Headless Banner Fix (Jun 2026)
- **AndroidManifest.xml**: Added `USE_FULL_SCREEN_INTENT` (required for `setFullScreenIntent` heads-up on Android 14+), `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PATTERN`.
- **CallFcmService.java**: Added `setCategory(CATEGORY_CALL / CATEGORY_MESSAGE)`, `setCustomHeadsUpContentView`, `setVisibility(VISIBILITY_PRIVATE)`, channel re-creation with `setLockscreenVisibility(PUBLIC)`.
- **`pushCapacitor.ts`**: Simplified to single `getServerUrl()` using only `VITE_SERVER_URL`. Removed `fetchAll`/`getServerUrls` (no more IP guessing, no Railway).
- **`api.ts`**: Removed Railway fetch, `setServerIp`, `redon_server_ip` localStorage — centralized to `VITE_SERVER_URL`.
- **`server/src/index.js`**: Added `capacitor://localhost`, `file://` to CORS; CORS now supports dynamic origin matching + `CLIENT_ORIGIN` env var.
- **`stickerService.ts`**: Fixed `getStickerPacks` — Supabase returns 404 in body (not thrown), so `if (!error && data)` avoids "Uncaught 404".

### 8. WebRTC TURN + Producción (Jun 2026)
- **`CallSuite.tsx`**: New `fetchIceConfig()` — async function that calls server `POST /api/turn/credentials` before falling back to static env vars (VITE_TURN_URL/USERNAME/CREDENTIAL) and finally STUN-only.
- **`server/src/routes/turn.js`** (NEW): `POST /api/turn/credentials` — three-tier fallback: ① Metered.ca REST API (dynamic temp JWT credentials via `METERED_API_KEY`), ② static TURN from env vars, ③ Google STUN-only.
- **`.env`**: Restructured with `METERED_API_KEY`, `VITE_SERVER_URL`, dynamic CORS vars; old commented TURN lines now documented with two methods.
- **`.env.example`**: Full documentation of all env vars.
- **`server/src/index.js`**: CORS updated to accept dynamic origins + `CLIENT_ORIGIN` wildcard matching — works with any deployed frontend domain.
- **`pushCapacitor.ts` / `api.ts`**: All references to `localhost:5000`, `redon_server_ip`, `VITE_RENDER_API_URL` removed. Only `VITE_SERVER_URL` is used.
- **`setServerIp()` removed**: No more manual IP input. The app auto-discovers the backend via `VITE_SERVER_URL`.

## Infrastructure (Server + FCM + TURN)
To run in production you need a deployed Express server:
- **`VITE_SERVER_URL`** — set to your deployed server URL (Railway, Render, Fly.io, etc.)
- **`FIREBASE_SERVICE_ACCOUNT`** — Firebase Admin JSON for FCM push
- **`METERED_API_KEY`** — Metered.ca API key for dynamic TURN credentials (or static `VITE_TURN_URL/USERNAME/CREDENTIAL`)
- **`SUPABASE_SERVICE_KEY`** — Supabase service_role key (for push token lookups in `fcm.js`)
- **CORS**: server auto-whitelists `capacitor://localhost`, `file://`, and `CLIENT_ORIGIN`
- **Supabase Database Webhook**: Must be configured in Supabase Dashboard (Database → Webhooks). Table: `messages`, Event: `INSERT`, URL: `https://redon-server.onrender.com/api/fcm/webhook`, HTTP method: POST, trigger type: "HTTP Request". This fires server-side push for every new message — no frontend dependency.

### 9. MediaEditor Image/Video Fixes (Jun 2026)
- **Image breaks on touch**: Root cause — `URL.createObjectURL(file)` called in render body (no `useMemo`), creating new blob URL on every interaction, forcing `<img>` to reload from scratch. Fixed: wrapped `fileUrl` in `useMemo` with `[effectiveFile]` deps, added `useEffect` cleanup that revokes old blob URL on unmount/change.
- **Video gray screen + no audio**: Same `fileUrl` regeneration forced `<video>` to restart constantly (gray screen). `muted` was hardcoded, suppressing all original audio. Fixed: `muted={isVideoMuted}` with state toggle + volume SVG toggle button at top-right of video, `useEffect` re-calls `.play()` after unmute (mobile autoplay policy).

### 10. Voice Notes — Missing DB Columns (Jun 2026)
- **Root cause**: `audio_url`, `audio_duration`, `mime_type` columns never added to Supabase `messages` table. INSERT failed silently, message never saved (recipient never received). Fixed `supabase_messages_migration.sql` with `ALTER TABLE messages ADD COLUMN ...` — user executed successfully in Supabase SQL Editor.

### 11. FCM Architecture — Server-Side Push via Supabase Webhook (Jun 2026)
- **Root cause**: Push was sent from sender's frontend (`api.ts` fetch to `/api/fcm/send`). If sender closed the app or had a bad connection, notification never fired. SQLite `push_tokens` on Render was ephemeral — tokens lost on every deploy.
- **New flow**: 
  1. `push_tokens` moved from SQLite to Supabase Postgres (`supabase_push_tokens.sql`) — tokens survive deploys.
  2. `fcm.js` `/register` now stores tokens in Supabase (via `@supabase/supabase-js`), not SQLite.
  3. `fcm.js` `/send` reads tokens from Supabase.
  4. **New `POST /api/fcm/webhook` endpoint**: Receives Supabase Database Webhook on `messages` INSERT, looks up recipient's token in Supabase, sends FCM push via `firebase-admin`. No frontend dependency.
  5. `api.ts`: Removed the frontend `fetch` to `/api/fcm/send` for messages (replaced by webhook). Only calls use `/api/fcm/send` directly.
  6. Server `db.js`: Removed `push_tokens` table (only `password_reset_codes` remains for SMS recovery).
- **User must configure in Supabase Dashboard**: Database → Webhooks → Create webhook: Table `messages`, Event `INSERT`, URL `https://redon-server.onrender.com/api/fcm/webhook`, HTTP method POST, trigger type "HTTP Request".

## Known Issues (Not Yet Fixed)
- **Supabase Storage bucket**: The `voice-notes` bucket must exist and have public read + authenticated insert RLS policies. If missing, audio upload falls back to local blob URL (sender can play, receiver cannot).
- **Service worker scope**: Only applies to browser/PWA context. Capacitor native Android uses FCM SDK directly — no SW needed for native push.

## New Features
- **Email password recovery**: Added `real_email` column to `profiles`; optional email field in registration; `forgot()` uses `resetPasswordForEmail(real_email)` when available, falls back to SMS debugging codes.
- **Moment animation metadata**: `anim_meta` JSONB column on `momentos` stores text animation type/speed/font/color/position/bg + active filter. Viewer replays via CSS keyframes + `RainCanvas` overlay.
- **Call reactions/backgrounds**: Real-time floating emoji reactions, background filter options during video calls.

## Phase 2 — Auth Unification, Schema Extension & Dead Code Removal (Jun 2026)

### 1. Erradicated Dual Auth (SQLite + bcryptjs)
- **`server/src/middleware/auth.js`**: Replaced custom JWT (`'redon_mvp_secret_2026'`) with Supabase JWT verification using `SUPABASE_JWT_SECRET` (HS256), extracts `sub` → `req.userId`, `email` → `req.userEmail`, `role` → `req.userRole`.
- **`server/src/db.js`**: Removed all user-related tables (`users`, `chats`, `chat_participants`, `messages`, `contacts`, `businesses`). Kept only `push_tokens` and `password_reset_codes` (used by FCM and SMS recovery).
- **`server/src/routes/auth.js`**: Deleted `/register`, `/login`, `/forgot` endpoints (frontend uses Supabase Auth directly). Removed `bcryptjs`, `uuid` imports. Kept SMS recovery endpoints (`/send-reset-code`, `/verify-reset-code`, `/update-password`) — these use Supabase Admin SDK for profile lookups and password updates.
- **Deleted route files**: `chats.js`, `messages.js`, `contacts.js`, `profile.js`, `businesses.js`, `media.js` — all dead code; frontend uses Supabase directly for CRUD.
- **`server/package.json`**: Removed `bcryptjs`, `socket.io`, `uuid`, `ffmpeg-static`, `@ffprobe-installer/ffprobe`, `multer`, `sharp`.

### 2. Schema Extensions (`supabase_extensions.sql`)
- Created 13 missing tables: `sticker_packs`, `stickers`, `music_library`, `calls`, `encuestas`, `poll_options`, `poll_votes`, `interest_news`, `product_items`, `stories`, `story_views`, `profile_visits`, `link_clicks`.
- Each table has `ENABLE ROW LEVEL SECURITY` and proper `auth.uid()` policies.
- Includes indexes for all foreign keys and frequently queried columns.

### 3. Socket.io Removed
- **`server/src/index.js`**: Removed `socket.io` import, `httpServer`, `io` instantiation, `setupSocket` call, WebSocket HTTP hook (`res.json` override for `/api/messages/send` & `/api/messages/direct`).
- **`server/src/socket/`**: Entire directory deleted (contained `index.js` with `setupSocket`, `sendToUser`, user socket tracking).
- Server now uses bare `app.listen()` instead of `httpServer.listen()`.

### 4. SMS Debug Bypass Removed
- **`server/src/routes/auth.js`**: `/send-reset-code` no longer returns `debugCode` in JSON response. Code is only logged to server console (`[SMS-RECOVERY] Code for ...`).
- **`src/components/AuthView.tsx`**: Removed `debugCode` state variable, `setDebugCode(data.debugCode)` call, and auto-fill logic that injected the code into input fields.
- `.env.example` updated with `SUPABASE_JWT_SECRET` and `FIREBASE_SERVICE_ACCOUNT_PATH` documentation.

## Phase 3 — Error Boundaries, Toast Feedback & HTTP Security (Jun 2026)

### 1. Error Boundaries
- **`src/components/ErrorBoundary.tsx`**: New generic React class component with `componentDidCatch`, logs error + component stack to console, renders a minimal fallback UI with "Reintentar" button that resets error state.
- **`src/App.tsx`**: Wrapped 6 critical views with `<ErrorBoundary name="...">` — ChatDetail/ChatList (named "ChatDetail"), MomentsView, InterestsView, EmprendedorView, ProfileView, and CallSuite. A crash in any one module no longer freezes the entire app.

### 2. Visible Toast Feedback (catch blocks)
- **`src/services/toastService.ts`**: New lightweight global event-based service — `showToast(message, type)` dispatches to a registered listener.
- **`src/components/Toast.tsx`**: Animated floating toast with auto-dismiss (4 s), supports `error` (rose), `info` (blue), `success` (emerald) types, uses `motion/react` `AnimatePresence` for enter/exit transitions.
- **Replaced empty catch blocks in `App.tsx`**: 8 user-visible operations now show toast on failure — initial chat/moment load, sendMessage, sendAudioMessage, handleSelectChat, updateProfile, addMoment, getMessages on new chat, and handleAuthSuccess chat load.
- Best-effort operations (FCM push, markRead) remain silent to avoid toast noise.

### 3. HTTP Security Hardening
- **`server/src/index.js`**:
  - Added `helmet()` with `crossOriginResourcePolicy: 'cross-origin'` (allows Capacitor file:// bucket URLs) and `contentSecurityPolicy: false` (Vite HMR needs it).
  - Added global `express-rate-limit` — 100 requests per 5 minutes per IP on all `/api/*` routes.
  - Added strict SMS rate limiter — 3 requests per 15 minutes per IP on `/api/auth/send-reset-code` (prevents SMS spam/abuse).
- **`server/package.json`**: Added `helmet` ^8.1.0, `express-rate-limit` ^7.5.0.

## Phase 4 — Visual Polish & UX Improvements (Jun 2026)

### 1. Tab Transitions (AnimatePresence)
- **`src/App.tsx`**: Tab content area wrapped in `<AnimatePresence mode="wait">` + `<motion.div key={activeTab}>` with `initial={{ opacity: 0, x: 20 }}` / `exit={{ opacity: 0, x: -20 }}` for smooth slide transitions between Chats, Momentos, Indicadores, Emprendedor, and Perfil tabs.

### 2. Loading Skeletons
- **`src/components/Skeleton.tsx`**: New reusable components — `SkeletonLine`, `SkeletonAvatar`, `ChatListSkeleton` (5 shimmer rows), `MomentsSkeleton` (4 shimmer circles).
- **`src/App.tsx`**: Added `isLoading` state, set `true` on mount, `false` after session check completes.
- **`src/components/ChatList.tsx`**: Renders `<ChatListSkeleton />` when `isLoading` is true.
- **`src/components/MomentsView.tsx`**: Renders `<MomentsSkeleton />` when `isLoading` is true.

### 3. Empty States
- **`src/components/ChatList.tsx`**: Already had empty state (icon + "Ninguna conversación activa").
- **`src/components/MomentsView.tsx`**: Replaced plain text empty state with icon (`Sparkles`) + "Sin momentos" + CTA text ("Agrega el primero pulsando el botón superior"), only shown when `!isLoading`.

### 4. Date Dividers
- **`src/components/ChatDetail.tsx`**: Added `getDateLabel()` helper (returns "Hoy", "Ayer", or full date string). Each message checks if day changed from previous; if so, renders a centered pill `<span>` with backdrop blur between message groups.

### 5. Micro-interactions
- **`src/components/ChatDetail.tsx`**: Added `active:scale-90` to Plus/attach, Smiley/sticker, and cancel-recording buttons for tactile press feedback.
- Most other interactive elements (nav tabs, send/mic buttons, context menu items) already had `active:scale-95` or `active:scale-90`.

### 6. Responsive Container
- **`src/App.tsx`**: Root `<div>` now has `max-w-md mx-auto shadow-xl relative` — constrains app width on desktop/web, centers the UI with subtle shadow. Capacitor mobile APK unaffected (fullscreen native).

### 7. Animated Header
- **`src/App.tsx`**: Static `<h2>` replaced with `<AnimatePresence mode="wait">` + `<motion.span key={activeTab}>` — header title slides in/out (opacity + y-axis) when switching tabs.

## Phase 5 — Voice Note UX Overhaul (Jun 2026)

### 1. Lock Recording (Hands-Free)
- **`src/components/ChatDetail.tsx`**: Lock indicator with `ArrowUp` icon + "Desliza ↑" text appears during recording when not locked.
- Track `touchStartY` via ref; on `touchMove` if Y delta > 60px, set `isLocked = true` and `lockTriggeredRef = true`.
- When locked: mic button transforms into a red `Square` (Stop) button; user taps it to finish recording.
- `handleReleaseOnMic` checks `lockTriggeredRef` — if locked, ignores the release event so recording continues hands-free.

### 2. Preview Before Send
- **`src/components/ChatDetail.tsx`**: New `recordingState` state machine (`'idle' | 'recording' | 'preview'`).
- When recording stops (release or stop button), `finishRecording()` creates a `Blob` + `ObjectURL`, then transitions to `'preview'` state.
- Preview bar shows: `Trash2` (cancel/discard), `Play`/`Pause` (toggle playback with progress bar + timer), `Send` (confirm send to Supabase).
- `handleSendPreviewAudio` calls `onSendAudioMessage` only on explicit send tap.
- `handleCancelPreview` revokes the ObjectURL and resets to `'idle'`.
- Auto-send on release completely removed — audio never sends without user confirmation.

### 3. Playback Speed Selector
- **`src/components/MessageBubble.tsx`**: `AudioPlayer` gains `playbackRate` state (1 / 1.5 / 2).
- New speed badge button between progress bar and time: shows `{playbackRate}x`.
- `cycleSpeed()` cycles 1 → 1.5 → 2 → 1 on click; applies `audio.playbackRate = next` immediately.
- Visual styling: highlighted (more opaque/colored) when not 1x; subtle when 1x.

## Phase 6 — Message Edit & Delete for Everyone (Jun 2026)

### 1. Supabase Schema Migration (`supabase_messages_migration.sql`)
- ALTER TABLE `messages` ADD COLUMN `is_edited` BOOLEAN DEFAULT FALSE, `is_deleted` BOOLEAN DEFAULT FALSE.
- CREATE POLICY "Users can update their own messages" — UPDATE RLS check: `auth.uid() = sender_id`, restricting `is_edited` and `is_deleted` columns only (no content tampering unless editing). In practice, `editMessage()` updates `text` + `is_edited` together.

### 2. API (`src/services/api.ts`)
- `editMessage(id, newText)` — calls `supabase.from('messages').update({ text: newText, is_edited: true }).eq('id', id)`.
- `deleteMessage(id)` — calls `supabase.from('messages').update({ is_deleted: true }).eq('id', id)`.
- `getMessages()` — maps `is_edited` → `isEdited`, `is_deleted` → `isDeleted` from DB rows.
- Both functions exported via the `api` object.

### 3. Types (`src/types.ts`)
- `Message` interface gains `isEdited?: boolean` and `isDeleted?: boolean`.

### 4. ChatDetail (`src/components/ChatDetail.tsx`)
- **Editing state**: `editingMessageId`, `editingMessageText` — when set, `handleSend` performs `onEditMessage(editingMessageId, inputText)` instead of `onSendMessage`.
- **Context menu**: `contextMenuMsgId` state controls a bottom sheet modal with "Editar mensaje" and "Eliminar para todos" options.
- **Long-press**: `handlePressStart(msgId, isOwn)` and `handleTouchStart(msgId, isOwn)` — own messages → context menu, other messages → reaction picker (existing).
- **Right-click**: `handleContextMenu(e, msgId, isOwn)` — prevents default browser context menu for own messages, opens app context menu.
- **Edit banner**: When editing, a blue banner with "Editando mensaje..." + X cancel button appears above the input bar.
- **Cancel edit**: `handleCancelEdit` clears both editing state and input text.

### 5. MessageBubble (`src/components/MessageBubble.tsx`)
- **Deleted state**: Renders `"🚫 Este mensaje fue eliminado"` in italic gray when `msg.isDeleted` is true (hides original content).
- **Edited state**: Shows `"(editado)"` label (9px, subtle opacity) next to the timestamp when `msg.isEdited && !msg.isDeleted`.

### 6. App.tsx
- `handleEditMessage` callback: updates local message text + `isEdited: true`, then calls `api.editMessage()`. Shows toast on error.
- `handleDeleteMessage` callback: updates local message `isDeleted: true`, then calls `api.deleteMessage()`. Shows toast on error.
- Both passed to `<ChatDetail>` via `onEditMessage` and `onDeleteMessage` props.
