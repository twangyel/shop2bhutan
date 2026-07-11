package com.shop2bhutan.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    private static final String APP_SCHEME = "com.shop2bhutan.app";
    private static final Pattern WEB_URL_PATTERN =
        Pattern.compile("https?://[^\\s]+", Pattern.CASE_INSENSITIVE);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        prepareIncomingShare(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        prepareIncomingShare(intent);
        super.onNewIntent(intent);
    }

    /**
     * Android sends shared product links through ACTION_SEND.
     * Capacitor's App plugin already handles normal deep links, so convert the
     * share intent into the app's own safe deep link before BridgeActivity
     * processes it.
     */
    private void prepareIncomingShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        String mimeType = intent.getType();
        if (mimeType == null || !mimeType.startsWith("text/")) {
            return;
        }

        CharSequence sharedTextValue =
            intent.getCharSequenceExtra(Intent.EXTRA_TEXT);

        if (sharedTextValue == null) {
            return;
        }

        String productUrl = extractFirstWebUrl(sharedTextValue.toString());
        if (productUrl.isEmpty()) {
            return;
        }

        String sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        Uri.Builder deepLinkBuilder = new Uri.Builder()
            .scheme(APP_SCHEME)
            .authority("share")
            .appendQueryParameter("url", productUrl);

        if (sharedTitle != null && !sharedTitle.trim().isEmpty()) {
            deepLinkBuilder.appendQueryParameter(
                "title",
                sharedTitle.trim()
            );
        }

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(deepLinkBuilder.build());
        intent.setType(null);
        intent.removeExtra(Intent.EXTRA_TEXT);
        intent.removeExtra(Intent.EXTRA_SUBJECT);
    }

    private String extractFirstWebUrl(String sharedText) {
        if (sharedText == null) {
            return "";
        }

        Matcher matcher = WEB_URL_PATTERN.matcher(sharedText.trim());
        if (!matcher.find()) {
            return "";
        }

        String url = matcher.group();
        if (url == null) {
            return "";
        }

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
}
