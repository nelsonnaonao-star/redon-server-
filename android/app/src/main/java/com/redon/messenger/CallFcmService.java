package com.redon.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CallFcmService extends FirebaseMessagingService {

    private static final String TAG = "CallFcmService";
    private static final String CHANNEL_CALLS = "redon-calls";
    private static final String CHANNEL_MESSAGES = "redon-messages";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Log.d(TAG, "Message received: " + message.getData());

        String type = message.getData().get("type");
        if ("call".equals(type)) {
            showCallNotification(message);
        } else {
            showMessageNotification(message);
        }
    }

    private void showCallNotification(RemoteMessage message) {
        String callerName = message.getData().get("callerName");
        String callType = message.getData().get("callType");
        String callerId = message.getData().get("callerId");
        String callerAvatar = message.getData().get("callerAvatar");
        String chatId = message.getData().get("chatId");

        if (callerName == null) callerName = "Llamada entrante";
        if (callType == null) callType = "audio";

        int notificationId = (callerId != null ? callerId.hashCode() : (int) System.currentTimeMillis());

        // Intent for answering
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setAction("ANSWER_CALL");
        answerIntent.putExtra("callerName", callerName);
        answerIntent.putExtra("callerId", callerId);
        answerIntent.putExtra("callType", callType);
        answerIntent.putExtra("chatId", chatId);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(
            this, notificationId, answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Intent for declining
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction("DECLINE_CALL");
        declineIntent.putExtra("notificationId", notificationId);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this, notificationId + 1000, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build the custom notification layout
        RemoteViews notificationLayout = new RemoteViews(getPackageName(), R.layout.call_notification);
        notificationLayout.setTextViewText(R.id.caller_name, callerName);
        notificationLayout.setTextViewText(R.id.call_type_label, callType.equals("video") ? "Videollamada entrante" : "Llamada entrante");

        // Set call type indicator
        notificationLayout.setImageViewResource(R.id.call_type_icon,
            callType.equals("video") ? android.R.drawable.ic_menu_camera : android.R.drawable.ic_menu_call);

        // Set button PendingIntents
        notificationLayout.setOnClickPendingIntent(R.id.btn_answer, answerPendingIntent);
        notificationLayout.setOnClickPendingIntent(R.id.btn_decline, declinePendingIntent);

        // Load avatar in background thread
        if (callerAvatar != null && !callerAvatar.isEmpty()) {
            new Thread(() -> {
                try {
                    URL url = new URL(callerAvatar);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    Bitmap avatarBitmap = BitmapFactory.decodeStream(input);
                    if (avatarBitmap != null) {
                        notificationLayout.setImageViewBitmap(R.id.caller_avatar, avatarBitmap);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to load avatar", e);
                }

                // Build and show notification after avatar attempt
                showNotification(notificationId, notificationLayout, message, true);
            }).start();
        } else {
            showNotification(notificationId, notificationLayout, message, true);
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

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

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
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setNumber(notifCount)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setColor(Color.parseColor("#1E88E5"));

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationId, builder.build());
        }
    }

    private void showNotification(int notificationId, RemoteViews notificationLayout, RemoteMessage message, boolean isCall) {
        String channelId = isCall ? CHANNEL_CALLS : CHANNEL_MESSAGES;

        // Full-screen intent for heads-up on lock screen
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.setAction("ANSWER_CALL");
        fullScreenIntent.putExtra("callerName", message.getData().get("callerName"));
        fullScreenIntent.putExtra("callerId", message.getData().get("callerId"));
        fullScreenIntent.putExtra("callType", message.getData().get("callType"));
        fullScreenIntent.putExtra("chatId", message.getData().get("chatId"));
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, notificationId + 2000, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                channelId,
                isCall ? "Llamadas" : "Mensajes",
                NotificationManager.IMPORTANCE_HIGH
            );
            chan.setDescription(isCall ? "Notificaciones de llamadas" : "Notificaciones de mensajes");
            chan.enableLights(true);
            chan.setLightColor(Color.parseColor("#1E88E5"));
            chan.enableVibration(true);
            chan.setVibrationPattern(isCall ? new long[]{0, 500, 300, 500, 300, 500} : new long[]{0, 200, 100, 200});
            chan.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(chan);
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setCustomContentView(notificationLayout)
            .setCustomHeadsUpContentView(notificationLayout)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(isCall ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(false)
            .setOngoing(isCall)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setSound(soundUri)
            .setVibrate(isCall ? new long[]{0, 500, 300, 500, 300, 500} : new long[]{0, 200, 100, 200})
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(Color.parseColor("#1E88E5"))
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationId, builder.build());
        }
    }
}
