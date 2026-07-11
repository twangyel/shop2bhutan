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
    private static final String APP_SCHEME = "com.shop2bhutan.app";

    private static final Pattern WEB_URL_PATTERN =
        Pattern.compile("https?://[^\\s]+", Pattern.CASE_INSENSITIVE);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Intent launchIntent = getIntent();
        prepareIncomingShare(launchIntent);

        // BridgeActivity reads getIntent() during startup. Persist the converted
        // ACTION_VIEW intent so Capacitor App.getLaunchUrl() can see it.
        setIntent(launchIntent);

        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        prepareIncomingShare(intent);

        // Required for singleTask activities so getIntent() no longer points to
        // the old launcher intent.
        setIntent(intent);

        super.onNewIntent(intent);
    }

    /**
     * Converts Android ACTION_SEND content into a Shop2Bhutan deep link:
     * com.shop2bhutan.app://share?url=<encoded-url>&title=<optional-title>
     */
    private void prepareIncomingShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        String productUrl = extractSharedWebUrl(intent);

        if (productUrl.isEmpty()) {
            Log.w(TAG, "Share intent received, but no HTTP/HTTPS URL was found.");
            return;
        }

        String sharedTitle = safeString(
            intent.getStringExtra(Intent.EXTRA_SUBJECT)
        );

        Uri.Builder deepLinkBuilder = new Uri.Builder()
            .scheme(APP_SCHEME)
            .authority("share")
            .appendQueryParameter("url", productUrl);

        if (!sharedTitle.isEmpty()) {
            deepLinkBuilder.appendQueryParameter("title", sharedTitle);
        }

        Uri deepLink = deepLinkBuilder.build();

        Log.d(TAG, "Converted Android share to: " + deepLink);

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(deepLink);
        intent.setType(null);
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.removeExtra(Intent.EXTRA_SUBJECT);
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
            for (int index = 0; index < clipData.getItemCount(); index++) {
                ClipData.Item item = clipData.getItemAt(index);

                if (item.getText() != null) {
                    appendCandidate(candidates, item.getText());
                }

                if (item.getUri() != null) {
                    appendCandidate(candidates, item.getUri().toString());
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
        if (sharedText == null) {
            return "";
        }

        Matcher matcher = WEB_URL_PATTERN.matcher(sharedText.trim());

        if (!matcher.find()) {
            return "";
        }

        String url = safeString(matcher.group());

        // Shopping apps sometimes append sentence punctuation after the URL.
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
