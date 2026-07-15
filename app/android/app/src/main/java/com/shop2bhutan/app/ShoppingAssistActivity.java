package com.shop2bhutan.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONTokener;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class ShoppingAssistActivity extends AppCompatActivity {

    private static final String LOG_TAG =
        "S2BShoppingAssist";

    public static final String EXTRA_STORE =
        "shop2bhutan_store";

    public static final String EXTRA_URL =
        "shop2bhutan_url";

    private static final String[] AMAZON_DOMAINS = {
        "amazon.in",
        "amzn.in"
    };

    private static final String[] FLIPKART_DOMAINS = {
        "flipkart.com",
        "fkrt.it"
    };

    private static final String[] MYNTRA_DOMAINS = {
        "myntra.com"
    };

    private static final String[] MEESHO_DOMAINS = {
        "meesho.com"
    };

    private static final Map<String, String> STORE_HOME =
        new HashMap<>();

    static {
        STORE_HOME.put(
            "amazon",
            "https://www.amazon.in/"
        );
        STORE_HOME.put(
            "flipkart",
            "https://www.flipkart.com/"
        );
        STORE_HOME.put(
            "myntra",
            "https://www.myntra.com/"
        );
        STORE_HOME.put(
            "meesho",
            "https://www.meesho.com/"
        );
    }

    private WebView webView;
    private ProgressBar progressBar;
    private TextView storeTitle;
    private TextView pageTitle;
    private TextView detectionStatus;
    private TextView detectedPrice;
    private TextView priceConfidence;
    private Button addButton;
    private View backButton;
    private View forwardButton;

    private final Handler handler =
        new Handler(Looper.getMainLooper());

    private String store = "";
    private String captureScript = "";
    private JSONObject strongestCapture = null;
    private int strongestScore = 0;
    private String activePageUrl = "";
    private boolean finishingWithCapture = false;
    private long lastInteractionCaptureAt = 0L;

    public static String resolveStartUrl(
        String store,
        String requestedUrl
    ) {
        String normalizedStore =
            safeString(store)
                .toLowerCase(Locale.ROOT);

        String fallback =
            STORE_HOME.get(normalizedStore);

        if (fallback == null) {
            return "";
        }

        String candidate =
            safeString(requestedUrl);

        if (candidate.isEmpty()) {
            return fallback;
        }

        try {
            Uri uri = Uri.parse(candidate);

            if (
                !"https".equalsIgnoreCase(uri.getScheme()) ||
                !isSupportedHost(
                    normalizedStore,
                    uri.getHost()
                )
            ) {
                return fallback;
            }

            return uri.toString();
        } catch (Exception ignored) {
            return fallback;
        }
    }

    @Override
    protected void onCreate(
        @Nullable Bundle savedInstanceState
    ) {
        super.onCreate(savedInstanceState);

        setContentView(
            R.layout.activity_shopping_assist
        );
        configureSystemBars();

        store =
            safeString(
                getIntent().getStringExtra(
                    EXTRA_STORE
                )
            ).toLowerCase(Locale.ROOT);

        String startUrl =
            resolveStartUrl(
                store,
                getIntent().getStringExtra(
                    EXTRA_URL
                )
            );

        if (startUrl.isEmpty()) {
            finish();
            return;
        }

        bindViews();
        captureScript =
            readAssetText(
                "shopping_assist_capture.js"
            );

        configureToolbar();
        configureWebView();
        updateNavigationButtons();

        storeTitle.setText(
            storeDisplayName(store)
        );

        webView.loadUrl(startUrl);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        window.setStatusBarColor(Color.WHITE);
        window.setNavigationBarColor(Color.WHITE);

        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller =
                decorView.getWindowInsetsController();

            if (controller != null) {
                controller.setSystemBarsAppearance(
                    WindowInsetsController
                        .APPEARANCE_LIGHT_STATUS_BARS |
                    WindowInsetsController
                        .APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController
                        .APPEARANCE_LIGHT_STATUS_BARS |
                    WindowInsetsController
                        .APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        } else {
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            );
        }
    }

    private void bindViews() {
        webView =
            findViewById(
                R.id.shopping_assist_webview
            );
        progressBar =
            findViewById(
                R.id.shopping_assist_progress
            );
        storeTitle =
            findViewById(
                R.id.shopping_assist_store
            );
        pageTitle =
            findViewById(
                R.id.shopping_assist_page_title
            );
        detectionStatus =
            findViewById(
                R.id.shopping_assist_status
            );
        detectedPrice =
            findViewById(
                R.id.shopping_assist_price
            );
        priceConfidence =
            findViewById(
                R.id.shopping_assist_price_confidence
            );
        addButton =
            findViewById(
                R.id.shopping_assist_add
            );
        backButton =
            findViewById(
                R.id.shopping_assist_back
            );
        forwardButton =
            findViewById(
                R.id.shopping_assist_forward
            );
    }

    private void configureToolbar() {
        findViewById(
            R.id.shopping_assist_close
        ).setOnClickListener(
            view -> finish()
        );

        backButton.setOnClickListener(view -> {
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                finish();
            }
        });

        forwardButton.setOnClickListener(view -> {
            if (webView.canGoForward()) {
                webView.goForward();
            }
        });

        findViewById(
            R.id.shopping_assist_reload
        ).setOnClickListener(
            view -> webView.reload()
        );

        findViewById(
            R.id.shopping_assist_external
        ).setOnClickListener(
            view -> openExternally(
                webView.getUrl()
            )
        );

        addButton.setEnabled(false);
        addButton.setOnClickListener(view -> {
            captureCurrentProduct(true);
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings =
            webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(
            WebSettings.MIXED_CONTENT_NEVER_ALLOW
        );
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(true);

        CookieManager cookies =
            CookieManager.getInstance();

        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(
            webView,
            true
        );

        webView.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                scheduleInteractionCapture();
            }

            return false;
        });

        webView.setWebChromeClient(
            new WebChromeClient() {
                @Override
                public void onProgressChanged(
                    WebView view,
                    int newProgress
                ) {
                    progressBar.setProgress(
                        newProgress
                    );

                    progressBar.setVisibility(
                        newProgress >= 100
                            ? View.GONE
                            : View.VISIBLE
                    );
                }

                @Override
                public void onReceivedTitle(
                    WebView view,
                    String title
                ) {
                    String clean =
                        safeString(title);

                    if (!clean.isEmpty()) {
                        pageTitle.setText(clean);
                    }
                }
            }
        );

        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request
                ) {
                    return handleNavigation(
                        request.getUrl()
                    );
                }

                @Override
                @SuppressWarnings("deprecation")
                public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url
                ) {
                    return handleNavigation(
                        Uri.parse(url)
                    );
                }

                @Override
                public void onPageStarted(
                    WebView view,
                    String url,
                    android.graphics.Bitmap favicon
                ) {
                    resetCaptureForPage(url);
                    updateNavigationButtons();
                }

                @Override
                public void doUpdateVisitedHistory(
                    WebView view,
                    String url,
                    boolean isReload
                ) {
                    super.doUpdateVisitedHistory(
                        view,
                        url,
                        isReload
                    );

                    if (!samePageUrl(activePageUrl, url)) {
                        resetCaptureForPage(url);
                    }

                    scheduleCapturePasses();
                }

                @Override
                public void onPageFinished(
                    WebView view,
                    String url
                ) {
                    if (!samePageUrl(activePageUrl, url)) {
                        resetCaptureForPage(url);
                    }

                    updateNavigationButtons();
                    pageTitle.setText(
                        cleanPageTitle(
                            view.getTitle()
                        )
                    );

                    scheduleCapturePasses();
                }

                @Override
                public void onReceivedSslError(
                    WebView view,
                    SslErrorHandler handler,
                    SslError error
                ) {
                    handler.cancel();

                    Toast.makeText(
                        ShoppingAssistActivity.this,
                        "This page could not be opened securely.",
                        Toast.LENGTH_LONG
                    ).show();
                }
            }
        );

        webView.setDownloadListener(
            (url, userAgent, contentDisposition, mimetype, contentLength) ->
                openExternally(url)
        );
    }

    private boolean handleNavigation(Uri uri) {
        if (uri == null) {
            return true;
        }

        String scheme =
            safeString(uri.getScheme())
                .toLowerCase(Locale.ROOT);

        if ("https".equals(scheme)) {
            if (
                isSupportedHost(
                    store,
                    uri.getHost()
                )
            ) {
                return false;
            }

            openExternally(uri.toString());
            return true;
        }

        if (
            "http".equals(scheme) ||
            "intent".equals(scheme) ||
            "market".equals(scheme) ||
            "mailto".equals(scheme) ||
            "tel".equals(scheme)
        ) {
            openExternally(uri.toString());
            return true;
        }

        return true;
    }

    private void scheduleCapturePasses() {
        handler.removeCallbacksAndMessages(null);

        int[] delays = {
            350,
            900,
            1600,
            2600,
            4000,
            5800
        };

        for (int delay : delays) {
            handler.postDelayed(
                () -> captureCurrentProduct(false),
                delay
            );
        }
    }

    private void scheduleInteractionCapture() {
        if (
            finishingWithCapture ||
            webView == null ||
            !isLikelyProductUrl(webView.getUrl())
        ) {
            return;
        }

        long now = System.currentTimeMillis();

        if (now - lastInteractionCaptureAt < 650L) {
            return;
        }

        lastInteractionCaptureAt = now;

        int[] delays = {
            450,
            1100,
            2200,
            3800
        };

        for (int delay : delays) {
            handler.postDelayed(
                () -> captureCurrentProduct(false),
                delay
            );
        }
    }

    private void resetCaptureForPage(
        String url
    ) {
        handler.removeCallbacksAndMessages(null);
        activePageUrl = safeString(url);
        strongestCapture = null;
        strongestScore = 0;

        addButton.setEnabled(false);
        addButton.setText(
            "Add to Request Bag"
        );
        detectionStatus.setText(
            "Checking this page…"
        );
        detectedPrice.setVisibility(
            View.GONE
        );
        priceConfidence.setVisibility(
            View.GONE
        );
    }

    private static boolean samePageUrl(
        String first,
        String second
    ) {
        return pageIdentity(first).equals(
            pageIdentity(second)
        );
    }

    private static String pageIdentity(
        String value
    ) {
        String clean = safeString(value);

        if (clean.isEmpty()) {
            return "";
        }

        try {
            Uri uri = Uri.parse(clean);
            String host = safeString(
                uri.getHost()
            ).toLowerCase(Locale.ROOT);
            String path = safeString(
                uri.getPath()
            ).toLowerCase(Locale.ROOT);

            if (host.contains("amazon.")) {
                java.util.regex.Matcher matcher =
                    java.util.regex.Pattern
                        .compile(
                            "/(?:dp|gp/product)/([a-z0-9]{8,16})(?:/|$)",
                            java.util.regex.Pattern.CASE_INSENSITIVE
                        )
                        .matcher(path);

                if (matcher.find()) {
                    return "amazon:" + matcher.group(1);
                }
            }

            if (host.contains("flipkart.")) {
                String pid = safeString(
                    uri.getQueryParameter("pid")
                ).toLowerCase(Locale.ROOT);

                if (!pid.isEmpty()) {
                    return "flipkart:" + pid;
                }

                java.util.regex.Matcher matcher =
                    java.util.regex.Pattern
                        .compile(
                            "/p/(itm[a-z0-9]+)(?:/|$)",
                            java.util.regex.Pattern.CASE_INSENSITIVE
                        )
                        .matcher(path);

                if (matcher.find()) {
                    return "flipkart:" + matcher.group(1);
                }
            }

            if (host.contains("myntra.")) {
                String[] segments = path.split("/");

                for (
                    int index = segments.length - 1;
                    index >= 0;
                    index -= 1
                ) {
                    if (
                        segments[index].matches("\\d{5,}")
                    ) {
                        return "myntra:" + segments[index];
                    }
                }
            }

            if (host.contains("meesho.")) {
                java.util.regex.Matcher matcher =
                    java.util.regex.Pattern
                        .compile(
                            "/p/([a-z0-9_-]+)(?:/|$)",
                            java.util.regex.Pattern.CASE_INSENSITIVE
                        )
                        .matcher(path);

                if (matcher.find()) {
                    return "meesho:" + matcher.group(1);
                }
            }

            return host + path;
        } catch (Exception ignored) {
            return clean;
        }
    }

    private void captureCurrentProduct(
        boolean finishAfterCapture
    ) {
        if (
            webView == null ||
            captureScript.isEmpty()
        ) {
            if (finishAfterCapture) {
                storeFallbackCaptureAndFinish();
            }
            return;
        }

        String currentUrl =
            safeString(webView.getUrl());

        if (
            !isAllowedPageUrl(
                store,
                currentUrl
            )
        ) {
            if (finishAfterCapture) {
                Toast.makeText(
                    this,
                    "Open a supported product page first.",
                    Toast.LENGTH_SHORT
                ).show();
            }
            return;
        }

        webView.evaluateJavascript(
            captureScript,
            value -> {
                JSONObject capture =
                    parseJavascriptResult(value);

                if (capture == null) {
                    if (finishAfterCapture) {
                        storeFallbackCaptureAndFinish();
                    }
                    return;
                }

                normalizeCapture(capture);

                Log.d(
                    LOG_TAG,
                    "store=" + store +
                    " pass=" + capture.optInt(
                        "capturePass",
                        0
                    ) +
                    " pageKey=" + safeString(
                        capture.optString(
                            "pageKey",
                            ""
                        )
                    ) +
                    " titleStable=" +
                    capture.optBoolean(
                        "titleStable",
                        false
                    ) +
                    " priceStable=" +
                    capture.optBoolean(
                        "priceStable",
                        false
                    ) +
                    " titleSource=" + safeString(
                        capture.optString(
                            "titleSource",
                            ""
                        )
                    ) +
                    " priceSource=" + safeString(
                        capture.optString(
                            "priceSource",
                            ""
                        )
                    ) +
                    " priceConfidence=" +
                    capture.optInt(
                        "priceConfidence",
                        0
                    ) +
                    " priceStatus=" + safeString(
                        capture.optString(
                            "priceStatus",
                            "missing"
                        )
                    ) +
                    " priceAgreement=" +
                    capture.optInt(
                        "priceAgreement",
                        0
                    ) +
                    " imageSource=" + safeString(
                        capture.optString(
                            "imageSource",
                            ""
                        )
                    )
                );

                String capturedUrl =
                    safeString(
                        capture.optString(
                            "sourceUrl",
                            currentUrl
                        )
                    );

                if (
                    !samePageUrl(
                        activePageUrl,
                        capturedUrl
                    )
                ) {
                    activePageUrl = capturedUrl;
                    strongestCapture = null;
                    strongestScore = 0;
                }

                if (strongestCapture != null) {
                    String strongestUrl =
                        safeString(
                            strongestCapture.optString(
                                "sourceUrl",
                                ""
                            )
                        );

                    if (
                        !samePageUrl(
                            strongestUrl,
                            capturedUrl
                        )
                    ) {
                        strongestCapture = null;
                        strongestScore = 0;
                    }
                }

                int score =
                    captureScore(capture);

                // The JavaScript engine already stabilizes each field
                // across multiple passes. Always keep the newest result
                // for the current product instead of retaining an older,
                // more complete but possibly stale snapshot.
                strongestCapture = capture;
                strongestScore = score;
                renderCapture(capture, score);

                if (finishAfterCapture) {
                    JSONObject finalCapture = capture;

                    if (
                        captureScore(finalCapture) < 25
                    ) {
                        Toast.makeText(
                            this,
                            "Open a product page before adding it.",
                            Toast.LENGTH_SHORT
                        ).show();
                        return;
                    }

                    saveCaptureAndFinish(
                        finalCapture
                    );
                }
            }
        );
    }

    private void normalizeCapture(
        JSONObject capture
    ) {
        try {
            String sourceUrl =
                safeString(
                    capture.optString(
                        "sourceUrl",
                        webView.getUrl()
                    )
                );

            capture.put(
                "sourceUrl",
                sourceUrl
            );
            String canonicalUrl =
                safeString(
                    capture.optString(
                        "canonicalUrl",
                        sourceUrl
                    )
                );

            if (
                canonicalUrl.isEmpty() ||
                !samePageUrl(
                    sourceUrl,
                    canonicalUrl
                )
            ) {
                canonicalUrl = sourceUrl;
            }

            capture.put(
                "canonicalUrl",
                canonicalUrl
            );
            capture.put("store", store);
            capture.put("currency", "INR");
            capture.put(
                "capturedAt",
                System.currentTimeMillis()
            );

            double displayedPrice = capture.optDouble(
                "displayedPrice",
                0
            );
            int detectedConfidence = Math.max(
                0,
                Math.min(
                    100,
                    capture.optInt(
                        "priceConfidence",
                        0
                    )
                )
            );
            String status = safeString(
                capture.optString(
                    "priceStatus",
                    displayedPrice > 0
                        ? "verify"
                        : "missing"
                )
            ).toLowerCase(Locale.ROOT);

            if (
                !"high".equals(status) &&
                !"verify".equals(status) &&
                !"missing".equals(status)
            ) {
                status = displayedPrice > 0
                    ? "verify"
                    : "missing";
            }

            if (displayedPrice <= 0) {
                status = "missing";
                detectedConfidence = 0;
                capture.put("originalPrice", 0);
            } else if (
                "high".equals(status) &&
                detectedConfidence < 80
            ) {
                status = "verify";
            }

            capture.put(
                "priceConfidence",
                detectedConfidence
            );
            capture.put("priceStatus", status);
        } catch (Exception ignored) {
            // JSONObject is best-effort.
        }
    }

    private void renderCapture(
        JSONObject capture,
        int score
    ) {
        String title =
            safeString(
                capture.optString("title", "")
            );

        double price =
            capture.optDouble(
                "displayedPrice",
                0
            );

        if (!title.isEmpty()) {
            detectionStatus.setText(
                title
            );
        } else {
            detectionStatus.setText(
                "Product page detected"
            );
        }

        String priceStatus = safeString(
            capture.optString(
                "priceStatus",
                price > 0 ? "verify" : "missing"
            )
        ).toLowerCase(Locale.ROOT);
        int detectedConfidence = Math.max(
            0,
            Math.min(
                100,
                capture.optInt(
                    "priceConfidence",
                    0
                )
            )
        );

        if (price > 0) {
            detectedPrice.setText(
                "₹" + formatPrice(price)
            );
            detectedPrice.setVisibility(
                View.VISIBLE
            );

            if ("high".equals(priceStatus)) {
                priceConfidence.setText(
                    "High confidence · " +
                    detectedConfidence + "%"
                );
                priceConfidence.setTextColor(
                    Color.parseColor("#15803D")
                );
            } else {
                priceConfidence.setText(
                    "Please verify · " +
                    detectedConfidence + "%"
                );
                priceConfidence.setTextColor(
                    Color.parseColor("#B45309")
                );
            }

            priceConfidence.setVisibility(
                View.VISIBLE
            );
        } else {
            detectedPrice.setText(
                "Price not found"
            );
            detectedPrice.setVisibility(
                View.VISIBLE
            );
            priceConfidence.setText(
                "Review before adding"
            );
            priceConfidence.setTextColor(
                Color.parseColor("#64748B")
            );
            priceConfidence.setVisibility(
                View.VISIBLE
            );
        }

        addButton.setEnabled(score >= 25);
        addButton.setText(
            score >= 55 && "high".equals(priceStatus)
                ? "Add to Request Bag"
                : "Review product"
        );
    }

    private void saveCaptureAndFinish(
        JSONObject capture
    ) {
        if (finishingWithCapture) {
            return;
        }

        finishingWithCapture = true;

        ShoppingAssistPlugin
            .storePendingCapture(
                getApplicationContext(),
                capture
            );

        setResult(RESULT_OK);
        finish();
    }

    private void storeFallbackCaptureAndFinish() {
        try {
            JSONObject capture =
                new JSONObject();

            String sourceUrl =
                safeString(webView.getUrl());

            capture.put(
                "sourceUrl",
                sourceUrl
            );
            capture.put(
                "canonicalUrl",
                sourceUrl
            );
            capture.put("store", store);
            capture.put(
                "title",
                cleanPageTitle(
                    webView.getTitle()
                )
            );
            capture.put("image", "");
            capture.put(
                "displayedPrice",
                0
            );
            capture.put("currency", "INR");
            capture.put("variant", "");
            capture.put(
                "captureMethod",
                "page_fallback"
            );
            capture.put("confidence", 25);
            capture.put("priceConfidence", 0);
            capture.put("priceStatus", "missing");
            capture.put("priceAgreement", 0);
            capture.put(
                "priceReason",
                "No reliable current selling price was found."
            );
            capture.put("originalPrice", 0);
            capture.put(
                "capturedAt",
                System.currentTimeMillis()
            );

            if (
                captureScore(capture) < 25
            ) {
                Toast.makeText(
                    this,
                    "Open a product page first.",
                    Toast.LENGTH_SHORT
                ).show();
                return;
            }

            saveCaptureAndFinish(capture);
        } catch (Exception error) {
            Toast.makeText(
                this,
                "This product could not be prepared.",
                Toast.LENGTH_SHORT
            ).show();
        }
    }

    private JSONObject parseJavascriptResult(
        String value
    ) {
        String raw =
            safeString(value);

        if (
            raw.isEmpty() ||
            "null".equals(raw) ||
            "undefined".equals(raw)
        ) {
            return null;
        }

        try {
            Object first =
                new JSONTokener(raw)
                    .nextValue();

            if (first instanceof JSONObject) {
                return (JSONObject) first;
            }

            if (first instanceof String) {
                String json =
                    safeString(
                        (String) first
                    );

                if (!json.isEmpty()) {
                    return new JSONObject(json);
                }
            }
        } catch (Exception ignored) {
            return null;
        }

        return null;
    }

    private int captureScore(
        JSONObject capture
    ) {
        int score = 0;

        String title =
            safeString(
                capture.optString("title", "")
            );

        String image =
            safeString(
                capture.optString("image", "")
            );

        double price =
            capture.optDouble(
                "displayedPrice",
                0
            );

        String url =
            safeString(
                capture.optString(
                    "sourceUrl",
                    ""
                )
            );

        if (title.length() >= 5) {
            score += 35;
        }

        if (price > 0) {
            int detectedConfidence = Math.max(
                0,
                Math.min(
                    100,
                    capture.optInt(
                        "priceConfidence",
                        60
                    )
                )
            );

            score += detectedConfidence >= 85
                ? 25
                : 18;
        }

        if (
            image.startsWith("https://")
        ) {
            score += 20;
        }

        if (isLikelyProductUrl(url)) {
            score += 20;
        }

        return Math.min(score, 100);
    }

    private boolean isLikelyProductUrl(
        String url
    ) {
        String lower =
            safeString(url)
                .toLowerCase(Locale.ROOT);

        if (lower.isEmpty()) {
            return false;
        }

        if ("amazon".equals(store)) {
            return lower.contains("/dp/") ||
                lower.contains("/gp/product/") ||
                lower.contains("/product/");
        }

        if ("flipkart".equals(store)) {
            return lower.contains("/p/") ||
                lower.contains("pid=");
        }

        if ("myntra".equals(store)) {
            return lower.matches(
                ".*myntra\\.com/(?:[^/?]+/)*\\d+(?:/.*)?(?:\\?.*)?$"
            );
        }

        if ("meesho".equals(store)) {
            return lower.contains("/s/p/") ||
                lower.contains("/product/");
        }

        return false;
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (webView != null) {
            handler.postDelayed(
                () -> captureCurrentProduct(false),
                500
            );
        }
    }

    private void updateNavigationButtons() {
        if (webView == null) {
            return;
        }

        backButton.setEnabled(
            webView.canGoBack()
        );
        forwardButton.setEnabled(
            webView.canGoForward()
        );

        backButton.setAlpha(
            webView.canGoBack()
                ? 1f
                : 0.35f
        );
        forwardButton.setAlpha(
            webView.canGoForward()
                ? 1f
                : 0.35f
        );
    }

    private void openExternally(
        String url
    ) {
        String clean =
            safeString(url);

        if (clean.isEmpty()) {
            return;
        }

        try {
            Intent intent;

            if (
                clean.startsWith("intent:")
            ) {
                intent =
                    Intent.parseUri(
                        clean,
                        Intent.URI_INTENT_SCHEME
                    );
            } else {
                intent =
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(clean)
                    );
            }

            startActivity(intent);
        } catch (
            ActivityNotFoundException error
        ) {
            Toast.makeText(
                this,
                "No app is available to open this link.",
                Toast.LENGTH_SHORT
            ).show();
        } catch (Exception ignored) {
            Toast.makeText(
                this,
                "This link could not be opened.",
                Toast.LENGTH_SHORT
            ).show();
        }
    }

    private String readAssetText(
        String name
    ) {
        try (
            InputStream input =
                getAssets().open(name);
            BufferedReader reader =
                new BufferedReader(
                    new InputStreamReader(
                        input,
                        StandardCharsets.UTF_8
                    )
                )
        ) {
            StringBuilder builder =
                new StringBuilder();

            String line;

            while (
                (line = reader.readLine()) != null
            ) {
                builder.append(line)
                    .append('\n');
            }

            return builder.toString();
        } catch (Exception error) {
            return "";
        }
    }

    private String cleanPageTitle(
        String value
    ) {
        String clean =
            safeString(value)
                .replace(
                    "Online Shopping India - Buy Mobiles, Electronics, Appliances, Clothing and More Online at Flipkart.com",
                    ""
                )
                .replace(
                    "Amazon.in: Online Shopping India - Buy mobiles, laptops, cameras, books, watches, apparel, shoes and e-Gift Cards. Free Shipping & Cash on Delivery Available.",
                    ""
                )
                .trim();

        if (clean.length() > 180) {
            clean =
                clean.substring(0, 180);
        }

        return clean.isEmpty()
            ? storeDisplayName(store)
            : clean;
    }

    private String formatPrice(
        double price
    ) {
        long rounded =
            Math.round(price);

        return String.format(
            Locale.ENGLISH,
            "%,d",
            rounded
        );
    }

    private static boolean isAllowedPageUrl(
        String store,
        String value
    ) {
        try {
            Uri uri =
                Uri.parse(
                    safeString(value)
                );

            return
                "https".equalsIgnoreCase(
                    uri.getScheme()
                ) &&
                isSupportedHost(
                    store,
                    uri.getHost()
                );
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean isSupportedHost(
        String store,
        String host
    ) {
        String normalizedHost =
            safeString(host)
                .toLowerCase(Locale.ROOT);

        String normalizedStore =
            safeString(store)
                .toLowerCase(Locale.ROOT);

        String[] allowed;

        switch (normalizedStore) {
            case "amazon":
                allowed = AMAZON_DOMAINS;
                break;
            case "flipkart":
                allowed = FLIPKART_DOMAINS;
                break;
            case "myntra":
                allowed = MYNTRA_DOMAINS;
                break;
            case "meesho":
                allowed = MEESHO_DOMAINS;
                break;
            default:
                return false;
        }

        for (String domain : allowed) {
            if (
                normalizedHost.equals(domain) ||
                normalizedHost.endsWith(
                    "." + domain
                )
            ) {
                return true;
            }
        }

        return false;
    }

    private String storeDisplayName(
        String store
    ) {
        switch (
            safeString(store)
                .toLowerCase(Locale.ROOT)
        ) {
            case "amazon":
                return "Amazon";
            case "flipkart":
                return "Flipkart";
            case "myntra":
                return "Myntra";
            case "meesho":
                return "Meesho";
            default:
                return "S2B Shopping Assist";
        }
    }

    private static String safeString(
        String value
    ) {
        return value == null
            ? ""
            : value.trim();
    }

    @Override
    public void onBackPressed() {
        if (
            webView != null &&
            webView.canGoBack()
        ) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);

        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}
