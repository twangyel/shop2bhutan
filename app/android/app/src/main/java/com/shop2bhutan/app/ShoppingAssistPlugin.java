package com.shop2bhutan.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "ShoppingAssist")
public class ShoppingAssistPlugin extends Plugin {

    private static final String PREFS_NAME =
        "shop2bhutan_shopping_assist";

    private static final String KEY_CAPTURE_JSON =
        "pending_capture_json";

    private static final Set<String> SUPPORTED_STORES =
        new HashSet<>(
            Arrays.asList(
                "amazon",
                "flipkart",
                "myntra",
                "meesho"
            )
        );

    public static void storePendingCapture(
        Context context,
        JSONObject capture
    ) {
        if (context == null || capture == null) {
            return;
        }

        context
            .getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            )
            .edit()
            .putString(
                KEY_CAPTURE_JSON,
                capture.toString()
            )
            .apply();
    }

    @PluginMethod()
    public void open(PluginCall call) {
        String store = normalizeStore(
            call.getString("store", "")
        );

        if (!SUPPORTED_STORES.contains(store)) {
            call.reject("Unsupported shopping store.");
            return;
        }

        String requestedUrl =
            safeString(call.getString("url", ""));

        String safeUrl =
            ShoppingAssistActivity.resolveStartUrl(
                store,
                requestedUrl
            );

        if (safeUrl.isEmpty()) {
            call.reject("The shopping URL is not supported.");
            return;
        }

        Intent intent = new Intent(
            getContext(),
            ShoppingAssistActivity.class
        );

        intent.putExtra(
            ShoppingAssistActivity.EXTRA_STORE,
            store
        );
        intent.putExtra(
            ShoppingAssistActivity.EXTRA_URL,
            safeUrl
        );

        Activity activity = getActivity();

        if (activity != null) {
            activity.startActivity(intent);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        result.put("store", store);
        result.put("url", safeUrl);
        call.resolve(result);
    }

    @PluginMethod()
    public void getPendingCapture(PluginCall call) {
        SharedPreferences preferences =
            getContext().getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            );

        String raw =
            preferences.getString(
                KEY_CAPTURE_JSON,
                ""
            );

        JSObject result = new JSObject();
        result.put("available", false);

        if (raw == null || raw.trim().isEmpty()) {
            call.resolve(result);
            return;
        }

        try {
            JSONObject capture =
                new JSONObject(raw);

            result.put("available", true);
            result.put("capture", capture);

            preferences
                .edit()
                .remove(KEY_CAPTURE_JSON)
                .apply();
        } catch (Exception error) {
            preferences
                .edit()
                .remove(KEY_CAPTURE_JSON)
                .apply();

            call.reject(
                "Stored product capture was invalid.",
                error
            );
            return;
        }

        call.resolve(result);
    }

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put(
            "stores",
            Arrays.asList(
                "amazon",
                "flipkart",
                "myntra",
                "meesho"
            )
        );
        call.resolve(result);
    }

    private String normalizeStore(String value) {
        return safeString(value)
            .toLowerCase(Locale.ROOT);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
