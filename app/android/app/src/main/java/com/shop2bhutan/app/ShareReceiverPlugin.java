package com.shop2bhutan.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    private static final String PREFS_NAME =
        "shop2bhutan_native_share_receiver";

    private static final String KEY_URL = "pending_url";
    private static final String KEY_TITLE = "pending_title";
    private static final String KEY_RECEIVED_AT = "pending_received_at";

    public static void storePendingShare(
        Context context,
        String url,
        String title
    ) {
        if (context == null || url == null || url.trim().isEmpty()) {
            return;
        }

        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_URL, url.trim())
            .putString(KEY_TITLE, title == null ? "" : title.trim())
            .putLong(KEY_RECEIVED_AT, System.currentTimeMillis())
            .apply();
    }

    @PluginMethod()
    public void getPendingShare(PluginCall call) {
        SharedPreferences preferences =
            getContext().getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            );

        String url = preferences.getString(KEY_URL, "");
        String title = preferences.getString(KEY_TITLE, "");
        long receivedAt = preferences.getLong(KEY_RECEIVED_AT, 0L);

        JSObject result = new JSObject();
        result.put("url", url == null ? "" : url);
        result.put("title", title == null ? "" : title);
        result.put("receivedAt", receivedAt);

        if (url != null && !url.isEmpty()) {
            preferences
                .edit()
                .remove(KEY_URL)
                .remove(KEY_TITLE)
                .remove(KEY_RECEIVED_AT)
                .apply();
        }

        call.resolve(result);
    }
}
