package com.redon.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class CallFcmService extends FirebaseMessagingService {

    private static final String TAG = "CallFcmService";
    private static final String CHANNEL_CALLS = "redon-calls";
    private static final String CHANNEL_MESSAGES = "redon-messages";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        // Bridge to Capacitor JS so the registration listener fires
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception e) {
            Log.e(TAG, "Failed to bridge token to Capacitor JS", e);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Log.d(TAG, "Message received: " + message.getData());

        String type = message.getData().get("type");

        // With notification-block payload, onMessageReceived fires ONLY in foreground.
        // In background/killed, the FCM SDK auto-displays the notification and
        // the data payload is available as intent extras on tap.
        if ("call".equals(type)) {
            // Call notification uses a 'notification' block in the FCM payload,
            // so the system handles display automatically in background.
            // In foreground, the app handles the call UI via Realtime subscription.
            // No duplicate notification needed here.
            Log.d(TAG, "Call notification received in foreground — app handles via Realtime");
        } else {
            showMessageNotification(message);
        }
    }

    private void showMessageNotification(RemoteMessage message) {
        String title = message.getData().get("title");
        String body = message.getData().get("body");
        String chatId = message.getData().get("chatId");
        String contactId = message.getData().get("contactId");
        int notifCount = 1;
        try { notifCount = Integer.parseInt(message.getData().get("notificationCount")); } catch (Exception ignored) {}

        if (title == null) title = "RED ON";
        if (body == null) body = "Nuevo mensaje";

        int notificationId = (chatId != null ? chatId.hashCode() : (int) System.currentTimeMillis());

        // Ensure the channel exists (handle app not yet opened case)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                CHANNEL_MESSAGES, "Mensajes", NotificationManager.IMPORTANCE_HIGH
            );
            chan.setDescription("Notificaciones de mensajes");
            chan.enableVibration(true);
            chan.setVibrationPattern(new long[]{0, 300, 200, 300});
            chan.enableLights(true);
            chan.setShowBadge(true);
            chan.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            NotificationManager nmgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nmgr != null) nmgr.createNotificationChannel(chan);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("OPEN_CHAT");
        intent.putExtra("chatId", chatId);
        intent.putExtra("contactId", contactId);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notificacion");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_MESSAGES)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 200, 300})
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS)
            .setNumber(notifCount)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setColor(Color.parseColor("#1E88E5"));

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationId, builder.build());
        }
    }

}
