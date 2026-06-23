package com.redon.messenger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "Handling intent: " + action);

        // Check if intent carries FCM data payload (type=call or chatId)
        String chatId = intent.getStringExtra("chatId");
        String callerId = intent.getStringExtra("callerId");
        String type = intent.getStringExtra("type");

        if ("ANSWER_CALL".equals(action) || (callerId != null && "call".equals(type))) {
            String callerName = intent.getStringExtra("callerName");
            String callType = intent.getStringExtra("callType");
            if (callType == null) callType = intent.getStringExtra("callType");

            // Bridge the call data to the JS layer via a custom event
            try {
                String json = "{\"callerId\":\"" + (callerId != null ? callerId : "") +
                    "\",\"callerName\":\"" + (callerName != null ? callerName : "") +
                    "\",\"callType\":\"" + (callType != null ? callType : "audio") +
                    "\",\"chatId\":\"" + (chatId != null ? chatId : "") + "\"}";
                bridge.triggerWindowJSEvent("incoming-call", json);
            } catch (Exception e) {
                Log.e(TAG, "Failed to trigger JS event", e);
            }
        } else if ("DECLINE_CALL".equals(action)) {
            try {
                bridge.triggerWindowJSEvent("call-declined", "");
            } catch (Exception e) {
                Log.e(TAG, "Failed to trigger decline JS event", e);
            }
        } else if ("OPEN_CHAT".equals(action) || (chatId != null && "message".equals(type))) {
            if (chatId != null) {
                try {
                    bridge.triggerWindowJSEvent("open-chat", chatId);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to trigger open-chat JS event", e);
                }
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            // Channel for messages
            NotificationChannel messagesChannel = new NotificationChannel(
                "redon-messages",
                "Mensajes",
                NotificationManager.IMPORTANCE_HIGH
            );
            messagesChannel.setDescription("Notificaciones de mensajes");
            messagesChannel.enableVibration(true);
            messagesChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            messagesChannel.enableLights(true);
            messagesChannel.setShowBadge(true);
            nm.createNotificationChannel(messagesChannel);

            // Channel for calls
            NotificationChannel callsChannel = new NotificationChannel(
                "redon-calls",
                "Llamadas",
                NotificationManager.IMPORTANCE_HIGH
            );
            callsChannel.setDescription("Notificaciones de llamadas entrantes");
            callsChannel.enableVibration(true);
            callsChannel.setVibrationPattern(new long[]{0, 500, 300, 500, 300, 500});
            callsChannel.enableLights(true);
            callsChannel.setShowBadge(true);
            nm.createNotificationChannel(callsChannel);
        }
    }
}
