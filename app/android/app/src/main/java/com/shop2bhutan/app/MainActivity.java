package com.shop2bhutan.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "Shop2BhutanShare";

    private static final Pattern WEB_URL_PATTERN =
        Pattern.compile("https?://[^\\s]+", Pattern.CASE_INSENSITIVE);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Capacitor requires local plugins to be registered before super.
        registerPlugin(ShareReceiverPlugin.class);

        storeIncomingShare(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        storeIncomingShare(intent);

        // Keep getIntent() current for singleTask activity launches.
        setIntent(intent);
        super.onNewIntent(intent);
    }

    private void storeIncomingShare(Intent intent) {
        if (
            intent == null ||
            !Intent.ACTION_SEND.equals(intent.getAction())
        ) {
            return;
        }

        String mimeType = intent.getType();

        if (mimeType == null || !mimeType.startsWith("text/")) {
            Log.w(TAG, "Ignored non-text Android share.");
            return;
        }

        String productUrl = extractSharedWebUrl(intent);

        if (productUrl.isEmpty()) {
            Log.w(TAG, "Share received, but no HTTP/HTTPS URL was found.");
            return;
        }

        String title = safeString(
            intent.getStringExtra(Intent.EXTRA_SUBJECT)
        );

        ShareReceiverPlugin.storePendingShare(
            getApplicationContext(),
            productUrl,
            title
        );

        Log.d(TAG, "Stored shared product URL: " + productUrl);

        // The share is handled by ShareReceiverPlugin, not by the App
        // deep-link plugin. Sanitizing prevents it being mistaken for a
        // normal launcher/deep-link intent.
        intent.setAction(Intent.ACTION_MAIN);
        intent.setData(null);
        intent.setType(null);
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.removeExtra(Intent.EXTRA_SUBJECT);
        intent.setClipData(null);
    }

    private String extractSharedWebUrl(Intent intent) {
        StringBuilder candidates = new StringBuilder();

        appendCandidate(
            candidates,
            intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
        );

        appendCandidate(
            candidates,
            intent.getStringExtra(Intent.EXTRA_SUBJECT)
        );

        Uri data = intent.getData();

        if (data != null) {
            appendCandidate(candidates, data.toString());
        }

        ClipData clipData = intent.getClipData();

        if (clipData != null) {
            for (
                int index = 0;
                index < clipData.getItemCount();
                index++
            ) {
                ClipData.Item item = clipData.getItemAt(index);

                if (item.getText() != null) {
                    appendCandidate(candidates, item.getText());
                }

                if (item.getUri() != null) {
                    appendCandidate(
                        candidates,
                        item.getUri().toString()
                    );
                }
            }
        }

        return extractFirstWebUrl(candidates.toString());
    }

    private void appendCandidate(
        StringBuilder builder,
        CharSequence value
    ) {
        if (value == null) {
            return;
        }

        String text = value.toString().trim();

        if (text.isEmpty()) {
            return;
        }

        if (builder.length() > 0) {
            builder.append('\n');
        }

        builder.append(text);
    }

    private String extractFirstWebUrl(String sharedText) {
        Matcher matcher =
            WEB_URL_PATTERN.matcher(safeString(sharedText));

        if (!matcher.find()) {
            return "";
        }

        String url = safeString(matcher.group());

        // Remove punctuation that sharing apps may append after the URL.
        while (!url.isEmpty()) {
            char last = url.charAt(url.length() - 1);

            if (
                last == '.' ||
                last == ',' ||
                last == ';' ||
                last == ')' ||
                last == ']' ||
                last == '}' ||
                last == '"' ||
                last == '\''
            ) {
                url = url.substring(0, url.length() - 1);
            } else {
                break;
            }
        }

        return url;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
