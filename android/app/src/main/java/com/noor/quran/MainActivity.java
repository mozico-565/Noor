package com.noor.quran;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.app.PendingIntent;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Surface;
import android.app.DownloadManager;
import android.database.Cursor;
import android.content.Context;
import android.content.res.Configuration;
import android.content.Intent;
import android.content.ClipData;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.provider.DocumentsContract;
import android.app.AlarmManager;
import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.CancellationSignal;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Base64;

import androidx.core.content.FileProvider;

import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.FilterInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;
import org.json.JSONArray;
import java.util.UUID;
import java.util.Locale;
import java.util.HashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import java.lang.ref.WeakReference;

public class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_PREFIX = "/assets/";

    private final ExecutorService aiExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService audioExecutor = Executors.newSingleThreadExecutor();
    private final ExecutorService playbackCacheExecutor = Executors.newSingleThreadExecutor();
    private volatile boolean audioDownloadRunning = false;
    private volatile boolean audioDownloadCancelled = false;
    private MediaPlayer downloadedPlayer;

    private volatile int recitationRequest = 0;
    private boolean recitationPaused = false, recitationPrepared = false;
    private String recitationVerseId="";
    private void audioEvent(int token, String id, String event) {
        evalJs("window.noorAudioEvent&&window.noorAudioEvent("+token+","+JSONObject.quote(id)+","+JSONObject.quote(event)+")");
    }
    private void configureRecitationPlayer(MediaPlayer player, String id, int token) {
        recitationPaused=false;recitationPrepared=false;recitationVerseId=id;
        player.setOnPreparedListener(mp -> {
            if (downloadedPlayer!=mp || token!=recitationRequest) return;
            recitationPrepared=true;
            if (!recitationPaused) {mp.start();audioEvent(token,id,"playing");}
        });
        player.setOnCompletionListener(mp -> {
            if(downloadedPlayer!=mp || token!=recitationRequest)return;
            releaseDownloadedPlayer();audioEvent(token,id,"ended");
        });
        player.setOnErrorListener((mp,what,extra) -> {
            if(downloadedPlayer==mp && token==recitationRequest){releaseDownloadedPlayer();audioEvent(token,id,"error");}
            return true;
        });
    }
    private void releaseDownloadedPlayer() {
        if (downloadedPlayer != null) {
            try { downloadedPlayer.release(); } catch (Exception ignored) {}
            downloadedPlayer = null;
        }
        recitationPrepared=false;
    }

    private static String reciterDirectory(String id) {
        if ("sudais".equals(id)) return "Abdurrahmaan_As-Sudais_192kbps";
        if ("minshawy".equals(id)) return "Minshawy_Murattal_128kbps";
        if ("ali_jaber".equals(id)) return "Ali_Jaber_64kbps";
        if ("shuraim".equals(id)) return "Saood_ash-Shuraym_128kbps";
        if ("dosari".equals(id)) return "Yasser_Ad-Dussary_128kbps";
        return null;
    }

    private WebView webView;
    private SharedPreferences prefs;
    private static WeakReference<MainActivity> activeInstance = new WeakReference<>(null);
    private boolean activityForeground = false;
    private SpeechRecognizer speechRecognizer;
    private LocalQuranAsr localQuranAsr;
    private boolean voicePermissionPending = false;
    private boolean qiblaLocationPending = false;
    private SensorManager sensorManager;
    private Sensor qiblaSensor;
    private boolean qiblaCompassRequested = false;
    private SensorEventListener qiblaSensorListener;
    private LocationListener qiblaMovementListener;
    private Location qiblaLastAcceptedLocation;
    private float qiblaSmoothedHeading = 0f;
    private boolean qiblaHeadingInitialized = false;
    private String pendingWidgetAction = "";

    public static boolean showIqamaIfForeground(String prayer, long iqamaAt) {
        MainActivity activity = activeInstance.get();
        if (activity == null || !activity.activityForeground || activity.webView == null) return false;
        activity.evalJs("window.noorShowIqama&&window.noorShowIqama(" +
                JSONObject.quote(prayer == null ? "الصلاة" : prayer) + "," + iqamaAt + ")");
        return true;
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        RecitationService.listener=json -> evalJs("window.noorNativeRepeat&&window.noorNativeRepeat("+json+")");
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        prefs = getSharedPreferences("noor", MODE_PRIVATE);
        pendingWidgetAction = getIntent()==null?"":String.valueOf(getIntent().getStringExtra("noor_widget_action"));
        cleanupLegacySpeechModels();

        webView = new WebView(this);
        boolean startupDark = resolvedThemeDark();
        webView.setBackgroundColor(themeChromeColor(startupDark));
        applyThemeChrome(startupDark);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        if (android.os.Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (android.os.Build.VERSION.SDK_INT >= 27) WebView.setSafeBrowsingWhitelist(java.util.Collections.emptyList(), null);

        /*
         * Noor used to open index.html through file:///android_asset/.
         * Modern Android WebView blocks fetch() from a file:// page in several
         * configurations, which caused the Quran JSON to fail even though it
         * was correctly bundled inside the APK.
         *
         * The app now exposes packaged assets through a private HTTPS-style
         * origin and serves them directly from Android assets below.
         * Relative fetch("./data/quran.json") is therefore same-origin and
         * works completely offline.
         */
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {

                Uri uri = request.getUrl();

                if ("https".equals(uri.getScheme())
                        && APP_HOST.equals(uri.getHost())
                        && uri.getPath() != null
                        && uri.getPath().startsWith(APP_PREFIX)) {

                    String assetPath = uri.getPath().substring(APP_PREFIX.length());
                    if (assetPath.matches("audio/sudais/[0-9]{6}\\.mp3")) {
                        File audio = new File(new File(getFilesDir(), "sudais"),
                                assetPath.substring("audio/sudais/".length()));
                        if (audio.isFile() && audio.length() > 1024) {
                            try {
                                long length = audio.length(), start = 0;
                                String range = request.getRequestHeaders().get("Range");
                                if (range != null && range.matches("bytes=[0-9]+-.*"))
                                    start = Math.min(length - 1, Long.parseLong(range.substring(6).split("-", 2)[0]));
                                final long remaining = length - start;
                                FileInputStream fileStream = new FileInputStream(audio);
                                fileStream.skip(start);
                                InputStream stream = new FilterInputStream(fileStream) {
                                    long left = remaining;
                                    @Override public int read() throws IOException {
                                        if (left <= 0) return -1;
                                        int value = super.read(); if (value >= 0) left--; return value;
                                    }
                                    @Override public int read(byte[] b, int off, int len) throws IOException {
                                        if (left <= 0) return -1;
                                        int count = super.read(b, off, (int)Math.min(len, left));
                                        if (count > 0) left -= count; return count;
                                    }
                                };
                                HashMap<String,String> headers = new HashMap<>();
                                headers.put("Accept-Ranges", "bytes");
                                headers.put("Content-Length", Long.toString(remaining));
                                if (range != null) headers.put("Content-Range", "bytes " + start + "-" + (length - 1) + "/" + length);
                                return new WebResourceResponse("audio/mpeg", null,
                                        range == null ? 200 : 206, range == null ? "OK" : "Partial Content", headers, stream);
                            } catch (Exception ignored) {}
                        }
                    }

                    // Do not allow path traversal.
                    if (assetPath.contains("..")) {
                        return new WebResourceResponse(
                                "text/plain", "UTF-8", 403, "Forbidden",
                                null, new java.io.ByteArrayInputStream(new byte[0]));
                    }

                    try {
                        InputStream stream = getAssets().open(assetPath);
                        return new WebResourceResponse(
                                mimeType(assetPath), "UTF-8", stream);
                    } catch (IOException ignored) {
                        return null;
                    }
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                dispatchSystemTheme();
                dispatchWidgetAction();
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view, WebResourceRequest request) {

                Uri uri = request.getUrl();

                if (APP_HOST.equals(uri.getHost())) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {}
                return true;
            }
        });

        webView.addJavascriptInterface(new NoorBridge(), "Android");
        // WebView does not reliably inset its HTML viewport with setPadding.
        // Inset a native parent so the viewport, fixed HTML bars and touch area
        // all occupy the same safe rectangle on older phones and edge-to-edge.
        android.widget.FrameLayout safeFrame = new android.widget.FrameLayout(this);
        safeFrame.setBackgroundColor(themeChromeColor(startupDark));
        safeFrame.addView(webView, new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(safeFrame, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(
                androidx.core.view.WindowInsetsCompat.Type.systemBars() |
                androidx.core.view.WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return androidx.core.view.WindowInsetsCompat.CONSUMED;
        });
        setContentView(safeFrame);
        androidx.core.view.ViewCompat.requestApplyInsets(safeFrame);

        // Private local origin. No internet connection is required.
        webView.loadUrl(
                "https://" + APP_HOST + "/assets/www/index.html"
        );
    }

    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        pendingWidgetAction=intent==null?"":String.valueOf(intent.getStringExtra("noor_widget_action"));
        dispatchWidgetAction();
    }

    private void dispatchWidgetAction(){
        if(webView==null||pendingWidgetAction==null||pendingWidgetAction.isEmpty()||"null".equals(pendingWidgetAction))return;
        final String action=pendingWidgetAction;pendingWidgetAction="";
        webView.postDelayed(() -> evalJs("window.noorWidgetAction&&window.noorWidgetAction("+JSONObject.quote(action)+")"),180);
    }

    private String mimeType(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private void evalJs(String js) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private boolean currentSystemDark() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private String savedThemeMode() {
        String mode = prefs == null ? "system" : prefs.getString("theme_mode", "system");
        return "light".equals(mode) || "dark".equals(mode) ? mode : "system";
    }

    private boolean resolvedThemeDark() {
        String mode = savedThemeMode();
        return "dark".equals(mode) || ("system".equals(mode) && currentSystemDark());
    }

    private int themeChromeColor(boolean dark) {
        return dark ? Color.rgb(6, 17, 13) : Color.rgb(232, 238, 233);
    }

    private void applyThemeChrome(boolean dark) {
        runOnUiThread(() -> {
            int color = themeChromeColor(dark);
            getWindow().setStatusBarColor(color);
            getWindow().setNavigationBarColor(color);
            getWindow().getDecorView().setBackgroundColor(color);
            if (webView != null) {
                webView.setBackgroundColor(color);
                if (webView.getParent() instanceof android.view.View) {
                    ((android.view.View) webView.getParent()).setBackgroundColor(color);
                }
            }
            if (android.os.Build.VERSION.SDK_INT >= 28) getWindow().setNavigationBarDividerColor(color);
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            if (dark) {
                flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (android.os.Build.VERSION.SDK_INT >= 26) flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            } else {
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (android.os.Build.VERSION.SDK_INT >= 26) flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            getWindow().getDecorView().setSystemUiVisibility(flags);
        });
    }

    private void dispatchSystemTheme() {
        boolean systemDark = currentSystemDark();
        applyThemeChrome(resolvedThemeDark());
        evalJs("window.noorSystemThemeChanged&&window.noorSystemThemeChanged(" + systemDark + ")");
    }

    private void emitIqamaStatus(boolean success, String status) {
        evalJs("window.noorIqamaStatus&&window.noorIqamaStatus(" +
                success + "," + JSONObject.quote(status) + ")");
    }

    private void emitVoiceResult(String text, String error) {
        evalJs("window.noorVoiceSearchResult&&window.noorVoiceSearchResult(" +
                JSONObject.quote(text == null ? "" : text) + "," +
                JSONObject.quote(error == null ? "" : error) + ")");
    }

    private void emitVoiceStatus(String status) {
        evalJs("window.noorVoiceStatus&&window.noorVoiceStatus(" + JSONObject.quote(status) + ")");
    }

    private boolean validReciterId(String id) { return id != null && id.matches("[a-zA-Z0-9_-]{1,100}"); }
    private boolean validOnlineBaseUrl(String raw) {
        if (raw == null || raw.length() > 2048) return false;
        try {
            Uri uri = Uri.parse(raw);
            String host = uri.getHost(), path = uri.getPath();
            return "https".equals(uri.getScheme()) && host != null && !host.equalsIgnoreCase("localhost") &&
                    !host.endsWith(".local") && !host.matches("[0-9.]+") && !host.contains(":") &&
                    (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null &&
                    uri.getQuery() == null && uri.getFragment() == null && path != null &&
                    !path.contains("..") && !path.contains("\\");
        } catch (Exception error) { return false; }
    }
    private String reciterBaseUrl(String id) {
        if (!validReciterId(id)) return null;
        String directory = reciterDirectory(id);
        if (directory != null) return "https://everyayah.com/data/" + directory;
        String base = prefs.getString("online_reciter_" + id + "_base", "");
        return validOnlineBaseUrl(base) ? base : null;
    }
    // Numbering comes from the unchanged bundled Quran, not from its text.
    private static final int[] SURAH_AYAH_COUNTS = {7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6};
    private static int globalAyahNumber(String verseId) {
        if (verseId == null || !verseId.matches("[0-9]{6}")) return -1;
        int surah = Integer.parseInt(verseId.substring(0,3)), ayah = Integer.parseInt(verseId.substring(3));
        if (surah < 1 || surah > 114 || ayah < 1 || ayah > SURAH_AYAH_COUNTS[surah-1]) return -1;
        int number = ayah;
        for (int i=0;i<surah-1;i++) number += SURAH_AYAH_COUNTS[i];
        return number;
    }
    private String reciterAyahUrl(String reciter, String id) {
        String base = reciterBaseUrl(reciter);
        int number = globalAyahNumber(id);
        if (base == null || number < 1) return null;
        boolean global = "global".equals(prefs.getString("online_reciter_" + reciter + "_numbering", "verseId"));
        return base + "/" + (global ? String.valueOf(number) : id) + ".mp3";
    }
    private static boolean isMp3File(File file) {
        if (!file.isFile() || file.length() <= 1024) return false;
        try (InputStream input = new FileInputStream(file)) {
            byte[] head = new byte[4096];int count = input.read(head);
            if (count >= 3 && head[0] == 'I' && head[1] == 'D' && head[2] == '3') return true;
            for (int i=0;i<count-1;i++) if ((head[i]&255) == 255 && (head[i+1]&224) == 224) return true;
        } catch (IOException ignored) {}
        return false;
    }
    private void emitReciterProgress(String reciter,int done,int total,String message,boolean running) {
        evalJs("window.noorReciterProgress?window.noorReciterProgress(" + JSONObject.quote(reciter) + "," + done + "," + total + "," +
                JSONObject.quote(message) + "," + running + "):window.noorSudaisProgress&&window.noorSudaisProgress(" +
                done + "," + total + "," + JSONObject.quote(message) + ")");
    }

    private void emitQiblaLocation(double lat, double lon, String error) {
        evalJs("window.noorQiblaLocation&&window.noorQiblaLocation(" + lat + "," + lon + "," +
                JSONObject.quote(error == null ? "" : error) + ")");
    }

    private void emitQiblaHeading(float heading, int accuracy) {
        evalJs("window.noorQiblaHeading&&window.noorQiblaHeading(" + heading + "," + accuracy + ")");
    }

private void emitSudaisProgress(int done, int total, String message) {
        evalJs("window.noorSudaisProgress&&window.noorSudaisProgress(" + done + "," + total + "," +
                JSONObject.quote(message) + ")");
    }

    private void downloadSudaisFiles(String csv) { downloadReciterFiles("sudais", csv); }

    /** Persist an ayah automatically when the user streams it. The temporary
     * file is promoted only after a complete response so an interrupted
     * connection never masquerades as a valid offline recitation. */
    private void cacheReciterAyahInBackground(String reciter, String id, String url) {
        if (!validReciterId(reciter) || url == null || globalAyahNumber(id) < 1) return;
        playbackCacheExecutor.submit(() -> {
            File dir = new File(getFilesDir(), reciter);
            if (!dir.exists() && !dir.mkdirs()) return;
            File target = new File(dir, id + ".mp3");
            if (isMp3File(target)) return;
            File temp = new File(dir, id + ".autocache.part");
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection)new URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(25000);
                if (conn.getResponseCode() != 200) return;
                try (InputStream input = conn.getInputStream(); FileOutputStream output = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[32768];
                    int n;
                    while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
                }
                if (!isMp3File(temp) || (conn.getContentLengthLong() > 0 && temp.length() != conn.getContentLengthLong())) return;
                if (isMp3File(target)) return;
                if (!temp.renameTo(target)) {
                    try (InputStream input = new FileInputStream(temp); FileOutputStream output = new FileOutputStream(target)) {
                        byte[] buffer = new byte[32768]; int n;
                        while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
                if (temp.exists()) temp.delete();
            }
        });
    }

    private synchronized boolean downloadReciterFiles(String reciter, String csv) {
        if (reciterBaseUrl(reciter) == null) return false;
        if (audioDownloadRunning) return false;
        if (csv == null || csv.length() > 50000) return false;
        String[] ids = csv.split(",");
        if (ids.length == 0 || ids.length > 6236) return false;
        for (String id : ids) if (globalAyahNumber(id) < 1) return false;
        audioDownloadRunning = true;
        audioDownloadCancelled = false;
        audioExecutor.submit(() -> {
            File dir = new File(getFilesDir(), reciter);
            if (!dir.exists() && !dir.mkdirs()) { audioDownloadRunning = false; emitReciterProgress(reciter, 0, ids.length, "لا توجد مساحة تخزين للتلاوة", false); return; }
            int done = 0;
            try {
                for (String id : ids) {
                    if (audioDownloadCancelled) break;
                    File target = new File(dir, id + ".mp3");
                    if (!isMp3File(target)) {
                        HttpURLConnection conn = null;
                        File temp = new File(dir, id + ".part");
                        try {
                            conn = (HttpURLConnection)new URL(reciterAyahUrl(reciter,id)).openConnection();
                            conn.setConnectTimeout(15000);conn.setReadTimeout(25000);
                            if (conn.getResponseCode() != 200) throw new IOException("HTTP " + conn.getResponseCode());
                            try (InputStream input = conn.getInputStream(); FileOutputStream output = new FileOutputStream(temp)) {
                                byte[] buffer = new byte[32768];int n;
                                while ((n = input.read(buffer)) != -1) {if (audioDownloadCancelled) break;output.write(buffer,0,n);}
                            }
                            if (audioDownloadCancelled) { temp.delete(); break; }
                            if (!isMp3File(temp) || (conn.getContentLengthLong() > 0 && temp.length() != conn.getContentLengthLong()) || !temp.renameTo(target)) throw new IOException("الملف الصوتي ناقص");
                        } finally { if (conn != null) conn.disconnect();if (temp.exists()) temp.delete(); }
                    }
                    done++;
                    if (done == 1 || done % 5 == 0 || done == ids.length)
                        emitReciterProgress(reciter, done, ids.length, "جاري تنزيل التلاوة: " + done + " / " + ids.length, true);
                }
                emitReciterProgress(reciter, done, ids.length, audioDownloadCancelled ? "أوقفت التنزيل؛ يمكنك استكماله لاحقًا" : "✓ اكتمل تنزيل التلاوة", false);
            } catch (Exception error) {
                emitReciterProgress(reciter, done, ids.length, "توقف التنزيل عند الآية " + (done+1) + ". تحقق من الإنترنت والمساحة ثم استأنف", false);
            } finally {audioDownloadRunning = false;audioDownloadCancelled = false;}
        });
        return true;
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[1024 * 1024];
            int n;
            while ((n = in.read(buffer)) > 0) digest.update(buffer, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : digest.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @Override public void onBackPressed() {
        webView.evaluateJavascript(
                "window.noorHandleBack?window.noorHandleBack():false",
                handled -> {
                    if (!"true".equals(handled)) {
                        if (webView.canGoBack()) webView.goBack();
                        else MainActivity.super.onBackPressed();
                    }
                });
    }

    @Override protected void onDestroy() {
        MainActivity current = activeInstance.get();
        if (current == this) activeInstance.clear();
        audioDownloadCancelled = true;
        audioExecutor.shutdownNow();
        playbackCacheExecutor.shutdownNow();
        releaseDownloadedPlayer();
        aiExecutor.shutdownNow();
        stopVoiceRecognitionNative();
        if (localQuranAsr != null) localQuranAsr.close();
        unregisterQiblaCompass(true);
        RecitationService.listener=null;
        super.onDestroy();
    }

    @Override protected void onResume() {
        super.onResume();
        RecitationService.sync();
        activityForeground = true;
        activeInstance = new WeakReference<>(this);
        dispatchSystemTheme();
        if(qiblaCompassRequested) registerQiblaCompass();
    }

    @Override protected void onPause() {
        activityForeground = false;
        recitationPaused=true;
        try{if(downloadedPlayer!=null&&recitationPrepared&&downloadedPlayer.isPlaying())downloadedPlayer.pause();}catch(Exception ignored){}
        evalJs("window.noorAudioBackground&&window.noorAudioBackground()");
        unregisterQiblaCompass(false);
        super.onPause();
    }

    private static final int RECITATION_EXPORT_REQ=4420;
    private static final int RECITATION_IMPORT_REQ=4421;
    private static final int RECITER_FOLDER_REQ=4422;
    private String pendingExportReciter = null;

    private static final int LOCATION_REQ=4412;
    private static final int NOTIFICATION_REQ=4413;

    private void requestPrayerLocation(boolean dark) {
        prefs.edit().putBoolean("iqama_dark",dark).putBoolean("iqama_auto_enabled",true).apply();
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_REQ);
            return;
        }
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},LOCATION_REQ);
            return;
        }
        acquirePrayerLocation();
    }

    @SuppressLint("MissingPermission")
    private void acquirePrayerLocation() {
        LocationManager lm=(LocationManager)getSystemService(Context.LOCATION_SERVICE);
        if(lm==null){emitIqamaStatus(false,"خدمة الموقع غير متاحة على هذا الجهاز");return;}
        boolean gps=lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean network=lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        if(!gps&&!network){emitIqamaStatus(false,"فعّل GPS أو خدمة الموقع ثم حاول مرة أخرى");return;}
        String provider=gps?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;
        if(android.os.Build.VERSION.SDK_INT>=30){
            lm.getCurrentLocation(provider,new CancellationSignal(),getMainExecutor(),loc->{
                if(loc!=null){PrayerTimeManager.saveLocationAndSchedule(this,loc,prefs.getBoolean("iqama_dark",false));emitIqamaStatus(true,"تم تحديد الموقع وجدولة الإقامة ✓");}
                else emitIqamaStatus(false,"تعذر الحصول على الموقع. اقترب من نافذة أو فعّل دقة الموقع ثم حاول مجددًا");
            });
        } else {
            Location loc=lm.getLastKnownLocation(provider);
            long age=loc==null?Long.MAX_VALUE:Math.max(0,System.currentTimeMillis()-loc.getTime());
            boolean fresh=loc!=null&&age<120_000L&&(!loc.hasAccuracy()||loc.getAccuracy()<=150f);
            if(fresh){PrayerTimeManager.saveLocationAndSchedule(this,loc,prefs.getBoolean("iqama_dark",false));emitIqamaStatus(true,"تم تحديث الموقع وجدولة الإقامة ✓");return;}
            lm.requestSingleUpdate(provider,new LocationListener(){
                @Override public void onLocationChanged(Location current){
                    if(current==null){emitIqamaStatus(false,"تعذر الحصول على موقع حديث");return;}
                    PrayerTimeManager.saveLocationAndSchedule(MainActivity.this,current,prefs.getBoolean("iqama_dark",false));
                    emitIqamaStatus(true,"تم تحديث الموقع وجدولة الإقامة ✓");
                }
                @Override public void onStatusChanged(String p,int status,Bundle extras){}
                @Override public void onProviderEnabled(String p){}
                @Override public void onProviderDisabled(String p){emitIqamaStatus(false,"تم إيقاف خدمة الموقع قبل اكتمال التحديد");}
            },Looper.getMainLooper());
        }
    }

    private static final int MIC_REQ=4414;
    private static final int SPEECH_REQ=4416;
    private static final int QIBLA_LOCATION_REQ=4415;

    private boolean launchSpeechIntent() {
        try {
            Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
            speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-SA");
            speech.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            if (speech.resolveActivity(getPackageManager()) == null) return false;
            startActivityForResult(speech, SPEECH_REQ);
            return true;
        } catch (Exception unavailable) {
            return false;
        }
    }

    private void cleanupLegacySpeechModels() {
        // Release 40 migration: remove speech models used by the retired generic ASR engine.
        // Quran ASR lives separately under files/quran-asr and is never touched here.
        String[] legacy = {"whisper-tiny-q5_1.bin", "whisper-tiny-q5_1.download"};
        for (String name : legacy) {
            File file = new File(getFilesDir(), name);
            if (file.isFile()) { try { file.delete(); } catch (Throwable ignored) {} }
        }
    }

    private void startVoiceRecognitionNative() {
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            voicePermissionPending = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQ);
            return;
        }
        if (localQuranAsr == null) localQuranAsr = new LocalQuranAsr(this, new LocalQuranAsr.Listener() {
            @Override public void status(String message) { emitVoiceStatus(message); }
            @Override public void result(String text, String error) { emitVoiceResult(text, error); }
        });
        localQuranAsr.start();
    }

    // Legacy device recognizer retained only for compatibility with existing Android code.
    private void startDeviceRecognitionLegacy() {
        if (launchSpeechIntent()) return;
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            emitVoiceResult("", "لا يوجد تطبيق تعرّف صوتي مثبت يدعم زر الإملاء. فعّل خدمة عربية أو تطبيق إملاء محلي يدعم التعرف الصوتي ثم حاول مجددًا.");
            return;
        }
        runOnUiThread(() -> {
            stopVoiceRecognitionNative();
            try {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onPartialResults(Bundle partialResults) {}
                    @Override public void onEvent(int eventType, Bundle params) {}
                    @Override public void onError(int error) {
                        if (error == SpeechRecognizer.ERROR_CLIENT || error == SpeechRecognizer.ERROR_SERVER || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                            stopVoiceRecognitionNative();
                            if (!launchSpeechIntent()) emitVoiceResult("", "تعذر فتح خدمة التعرف الصوتي على هذا الهاتف");
                            return;
                        }
                        String msg = error == SpeechRecognizer.ERROR_NO_MATCH ? "لم أسمع كلمات واضحة، حاول مرة أخرى" :
                                error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ? "لم أسمع قراءة، حاول الاقتراب من الميكروفون" :
                                error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "اسمح للميكروفون من إعدادات التطبيق" :
                                error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "خدمة التعرف الصوتي تحتاج إنترنت أو حزمة لغة عربية محمّلة" :
                                "خدمة التعرف الصوتي غير متاحة؛ تأكد من وجود خدمة تدعم العربية على الهاتف";
                        emitVoiceResult("", msg);
                        stopVoiceRecognitionNative();
                    }
                    @Override public void onResults(Bundle results) {
                        java.util.ArrayList<String> values = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        emitVoiceResult(values != null && !values.isEmpty() ? values.get(0) : "", values == null || values.isEmpty() ? "لم أسمع كلمات واضحة" : "");
                        stopVoiceRecognitionNative();
                    }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-SA");
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                speechRecognizer.startListening(intent);
            } catch (Throwable error) {
                emitVoiceResult("", "تعذر بدء الميكروفون");
                stopVoiceRecognitionNative();
            }
        });
    }

    private void emitRecitationTransfer(boolean success, String message) {
        evalJs("window.noorRecitationTransfer&&window.noorRecitationTransfer(" + success + "," + JSONObject.quote(message) + ")");
    }

    private void startRecitationExport(String reciter) {
        if (reciterDirectory(reciter) == null) { emitRecitationTransfer(false, "تصدير القراء المخصصين غير مدعوم بعد"); return; }
        File dir = new File(getFilesDir(), reciter);
        File[] files = dir.listFiles((d, name) -> name.matches("[0-9]{6}\\.mp3"));
        if (files == null || files.length == 0) { emitRecitationTransfer(false, "لا توجد تلاوات منزلة لهذا القارئ"); return; }
        pendingExportReciter = reciter;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/zip")
                .putExtra(Intent.EXTRA_TITLE, "Noor-recitations-" + reciter + ".noorrecitations.zip");
        startActivityForResult(intent, RECITATION_EXPORT_REQ);
    }

    private void writeRecitationPackage(Uri uri, String reciter) {
        aiExecutor.submit(() -> {
            File dir = new File(getFilesDir(), reciter);
            File[] files = dir.listFiles((d, name) -> name.matches("[0-9]{6}\\.mp3"));
            if (files == null || files.length == 0) { emitRecitationTransfer(false, "لا توجد ملفات صالحة للتصدير"); return; }
            java.util.Arrays.sort(files, java.util.Comparator.comparing(File::getName));
            try (OutputStream raw = getContentResolver().openOutputStream(uri, "w"); ZipOutputStream zip = new ZipOutputStream(raw)) {
                JSONObject manifest = new JSONObject();
                manifest.put("format", "noor-recitations-v1"); manifest.put("reciter", reciter); manifest.put("count", files.length);
                JSONArray entries = new JSONArray();
                for (File f : files) { JSONObject e = new JSONObject(); e.put("file", f.getName()); e.put("size", f.length()); e.put("sha256", sha256(f)); entries.put(e); }
                manifest.put("files", entries);
                zip.putNextEntry(new ZipEntry("manifest.json")); zip.write(manifest.toString().getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
                byte[] buffer = new byte[32768];
                for (File f : files) { zip.putNextEntry(new ZipEntry("audio/" + f.getName())); try (FileInputStream in = new FileInputStream(f)) { int n; while ((n=in.read(buffer))>0) zip.write(buffer,0,n); } zip.closeEntry(); }
                emitRecitationTransfer(true, "✓ تم تصدير " + files.length + " ملف تلاوة");
            } catch (Exception e) { emitRecitationTransfer(false, "تعذر تصدير التلاوات"); }
        });
    }

    private void startRecitationImport() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/zip");
        startActivityForResult(intent, RECITATION_IMPORT_REQ);
    }

    private void importRecitationPackage(Uri uri) {
        aiExecutor.submit(() -> {
            File staging = new File(getCacheDir(), "recitation-import-" + UUID.randomUUID()); staging.mkdirs();
            JSONObject manifest = null;
            try (InputStream raw = getContentResolver().openInputStream(uri); ZipInputStream zip = new ZipInputStream(raw)) {
                ZipEntry entry; byte[] buffer = new byte[32768]; long total = 0;
                while ((entry=zip.getNextEntry()) != null) {
                    String name=entry.getName();
                    if (entry.isDirectory() || name.contains("..") || name.startsWith("/") || name.startsWith("\\")) { zip.closeEntry(); continue; }
                    if ("manifest.json".equals(name)) {
                        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream(); int n; while((n=zip.read(buffer))>0){total+=n;if(total>2_000_000_000L)throw new IOException("package too large");out.write(buffer,0,n);} manifest=new JSONObject(out.toString("UTF-8"));
                    } else if (name.matches("audio/[0-9]{6}\\.mp3")) {
                        File f=new File(staging,name.substring(6)); try(FileOutputStream out=new FileOutputStream(f)){int n;while((n=zip.read(buffer))>0){total+=n;if(total>2_000_000_000L)throw new IOException("package too large");out.write(buffer,0,n);}}
                    }
                    zip.closeEntry();
                }
                if (manifest==null || !"noor-recitations-v1".equals(manifest.optString("format"))) throw new IOException("bad manifest");
                String reciter=manifest.optString("reciter"); if(reciterDirectory(reciter)==null) throw new IOException("unknown reciter");
                JSONArray expected=manifest.optJSONArray("files"); if(expected==null || expected.length()>6236) throw new IOException("bad file list");
                File targetDir=new File(getFilesDir(),reciter); if(!targetDir.exists()&&!targetDir.mkdirs())throw new IOException("storage");
                int imported=0;
                for(int i=0;i<expected.length();i++){JSONObject e=expected.getJSONObject(i);String file=e.getString("file");if(!file.matches("[0-9]{6}\\.mp3"))throw new IOException("bad name");File staged=new File(staging,file);if(!staged.isFile()||staged.length()!=e.getLong("size")||!sha256(staged).equalsIgnoreCase(e.getString("sha256")))throw new IOException("checksum");File dest=new File(targetDir,file);try(FileInputStream in=new FileInputStream(staged);FileOutputStream out=new FileOutputStream(dest,false)){int n;while((n=in.read(buffer))>0)out.write(buffer,0,n);}imported++;}
                emitRecitationTransfer(true,"✓ تم استيراد " + imported + " ملف تلاوة لـ " + reciter);
            } catch(Exception e){emitRecitationTransfer(false,"تعذر الاستيراد: الحزمة تالفة أو غير متوافقة");}
            finally { File[] fs=staging.listFiles();if(fs!=null)for(File f:fs)f.delete();staging.delete(); }
        });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RECITATION_EXPORT_REQ) {
            String reciter=pendingExportReciter; pendingExportReciter=null;
            if(resultCode==RESULT_OK && data!=null && data.getData()!=null && reciter!=null) writeRecitationPackage(data.getData(),reciter);
            else emitRecitationTransfer(false,"تم إلغاء التصدير");
            return;
        }
        if (requestCode == RECITATION_IMPORT_REQ) {
            if(resultCode==RESULT_OK && data!=null && data.getData()!=null) importRecitationPackage(data.getData());
            else emitRecitationTransfer(false,"تم إلغاء الاستيراد");
            return;
        }
        if (requestCode == RECITER_FOLDER_REQ) {
            if(resultCode==RESULT_OK && data!=null && data.getData()!=null){
                Uri uri=data.getData();
                try{
                    int flags=data.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    getContentResolver().takePersistableUriPermission(uri,flags&Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }catch(Throwable ignored){}
                String label="مجلد التلاوات";
                try{String id=DocumentsContract.getTreeDocumentId(uri);if(id!=null&&!id.isEmpty()){String[] parts=id.split(":",2);label=parts.length>1&&!parts[1].isEmpty()?parts[1]:parts[0];}}catch(Throwable ignored){}
                int foundFiles=0;java.util.HashSet<String> foundSurahs=new java.util.HashSet<>();
                try{
                    String treeId=DocumentsContract.getTreeDocumentId(uri);
                    Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(uri,treeId);
                    try(Cursor cursor=getContentResolver().query(children,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
                        if(cursor!=null)while(cursor.moveToNext()){
                            String name=cursor.getString(0);
                            if(name!=null&&name.matches("[0-9]{6}\\.mp3")){foundFiles++;foundSurahs.add(name.substring(0,3));}
                        }
                    }
                }catch(Throwable ignored){}
                evalJs("window.noorReciterFolderPicked&&window.noorReciterFolderPicked("+JSONObject.quote(uri.toString())+","+JSONObject.quote(label)+",'',"+foundFiles+","+foundSurahs.size()+")");
            }else evalJs("window.noorReciterFolderPicked&&window.noorReciterFolderPicked('','','تم إلغاء اختيار المجلد')");
            return;
        }
        if (requestCode == SPEECH_REQ) {
            java.util.ArrayList<String> words = data == null ? null : data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            emitVoiceResult(resultCode == RESULT_OK && words != null && !words.isEmpty() ? words.get(0) : "",
                    resultCode == RESULT_OK && words != null && !words.isEmpty() ? "" :
                    "لم تُرجع خدمة التعرف الصوتي نصًا. تأكد من السماح بالميكروفون وتوفر خدمة تعرف صوتي بالعربية على هاتفك.");
        }
    }

    private void stopVoiceRecognitionNative() {
        runOnUiThread(() -> {
            if (speechRecognizer != null) {
                try { speechRecognizer.cancel(); } catch (Throwable ignored) {}
                try { speechRecognizer.destroy(); } catch (Throwable ignored) {}
                speechRecognizer = null;
            }
        });
    }

    private void saveQiblaLocation(Location loc) {
        if (loc == null) return;
        qiblaLastAcceptedLocation = new Location(loc);
        prefs.edit().putLong("prayer_lat", Double.doubleToRawLongBits(loc.getLatitude()))
                .putLong("prayer_lon", Double.doubleToRawLongBits(loc.getLongitude()))
                .putLong("prayer_location_saved_at", System.currentTimeMillis())
                .putFloat("prayer_location_accuracy", loc.hasAccuracy()?loc.getAccuracy():-1f)
                .putBoolean("prayer_location_saved", true).apply();
        emitQiblaLocation(loc.getLatitude(), loc.getLongitude(), "");
        NoorWidgetProvider.updateAllWidgets(MainActivity.this);
        if (qiblaCompassRequested) startQiblaLocationUpdates();
    }

    @SuppressLint("MissingPermission")
    private void startQiblaLocationUpdates() {
        if (!qiblaCompassRequested || (android.os.Build.VERSION.SDK_INT >= 23 &&
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)) return;
        LocationManager lm = (LocationManager)getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;
        if (qiblaMovementListener == null) {
            qiblaMovementListener = new LocationListener() {
                @Override public void onLocationChanged(Location current) {
                    if (current == null || (current.hasAccuracy() && current.getAccuracy() > 150f)) return;
                    Location previous = qiblaLastAcceptedLocation;
                    float accuracyGate = Math.max(35f, current.hasAccuracy() ? current.getAccuracy() * .75f : 35f);
                    if (previous == null || previous.distanceTo(current) >= accuracyGate) saveQiblaLocation(current);
                }
                @Override public void onStatusChanged(String p, int status, Bundle extras) {}
                @Override public void onProviderEnabled(String p) {}
                @Override public void onProviderDisabled(String p) {}
            };
        }
        try { lm.removeUpdates(qiblaMovementListener); } catch (Throwable ignored) {}
        String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        try { lm.requestLocationUpdates(provider, 15_000L, 35f, qiblaMovementListener, Looper.getMainLooper()); }
        catch (Throwable ignored) {}
    }

    private void stopQiblaLocationUpdates() {
        if (qiblaMovementListener == null) return;
        LocationManager lm = (LocationManager)getSystemService(Context.LOCATION_SERVICE);
        if (lm != null) try { lm.removeUpdates(qiblaMovementListener); } catch (Throwable ignored) {}
    }

    private void requestQiblaLocationNative() {
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            qiblaLocationPending = true;
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, QIBLA_LOCATION_REQ);
            return;
        }
        acquireQiblaLocation();
    }

    @SuppressLint("MissingPermission")
    private void acquireQiblaLocation() {
        LocationManager lm = (LocationManager)getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) { emitQiblaLocation(0, 0, "خدمة الموقع غير متاحة على هذا الجهاز"); return; }
        boolean gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean network = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        if (!gps && !network) { emitQiblaLocation(0, 0, "فعّل خدمة الموقع ثم حاول مرة أخرى"); return; }
        String provider = gps ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            lm.getCurrentLocation(provider, new CancellationSignal(), getMainExecutor(), loc -> {
                if (loc != null) saveQiblaLocation(loc);
                else emitQiblaLocation(0, 0, "تعذر تحديد الموقع الآن");
            });
        } else {
            Location loc = lm.getLastKnownLocation(provider);
            long age = loc == null ? Long.MAX_VALUE : Math.max(0, System.currentTimeMillis() - loc.getTime());
            boolean fresh = loc != null && age < 120_000L && (!loc.hasAccuracy() || loc.getAccuracy() <= 150f);
            if (fresh) { saveQiblaLocation(loc); return; }
            lm.requestSingleUpdate(provider, new LocationListener() {
                @Override public void onLocationChanged(Location current) {
                    if(current!=null) saveQiblaLocation(current);
                    else emitQiblaLocation(0,0,"تعذر تحديد موقع حديث للقبلة");
                }
                @Override public void onStatusChanged(String p, int status, Bundle extras) {}
                @Override public void onProviderEnabled(String p) {}
                @Override public void onProviderDisabled(String p) { emitQiblaLocation(0, 0, "تم إيقاف الموقع قبل اكتمال التحديد"); }
            }, Looper.getMainLooper());
        }
    }

    private float trueNorthHeading(float magneticHeading) {
        if (!prefs.getBoolean("prayer_location_saved", false)) return magneticHeading;
        double lat = Double.longBitsToDouble(prefs.getLong("prayer_lat", 0));
        double lon = Double.longBitsToDouble(prefs.getLong("prayer_lon", 0));
        GeomagneticField field = new GeomagneticField((float)lat, (float)lon, 0f, System.currentTimeMillis());
        float heading = magneticHeading + field.getDeclination();
        return (heading % 360f + 360f) % 360f;
    }

    private void ensureQiblaListener() {
        if (qiblaSensorListener != null) return;
        qiblaSensorListener = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) {
                if (event == null || event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR) return;
                float[] matrix = new float[9];
                float[] adjusted = new float[9];
                SensorManager.getRotationMatrixFromVector(matrix, event.values);
                int rotation = getWindowManager().getDefaultDisplay().getRotation();
                int x = SensorManager.AXIS_X, y = SensorManager.AXIS_Y;
                if (rotation == Surface.ROTATION_90) { x = SensorManager.AXIS_Y; y = SensorManager.AXIS_MINUS_X; }
                else if (rotation == Surface.ROTATION_180) { x = SensorManager.AXIS_MINUS_X; y = SensorManager.AXIS_MINUS_Y; }
                else if (rotation == Surface.ROTATION_270) { x = SensorManager.AXIS_MINUS_Y; y = SensorManager.AXIS_X; }
                SensorManager.remapCoordinateSystem(matrix, x, y, adjusted);
                float[] orientation = new float[3];
                SensorManager.getOrientation(adjusted, orientation);
                float magnetic = (float)Math.toDegrees(orientation[0]);
                magnetic = (magnetic % 360f + 360f) % 360f;
                float trueHeading = trueNorthHeading(magnetic);
                if (!qiblaHeadingInitialized) {
                    qiblaSmoothedHeading = trueHeading;
                    qiblaHeadingInitialized = true;
                } else {
                    float delta = ((trueHeading - qiblaSmoothedHeading + 540f) % 360f) - 180f;
                    // Fast enough to follow a hand turn, damped enough to avoid magnetometer jitter.
                    qiblaSmoothedHeading = (qiblaSmoothedHeading + delta * 0.22f + 360f) % 360f;
                }
                emitQiblaHeading(qiblaSmoothedHeading, event.accuracy);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };
    }

    private void registerQiblaCompass() {
        qiblaCompassRequested = true;
        qiblaHeadingInitialized = false;
        if (sensorManager == null) sensorManager = (SensorManager)getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) { emitQiblaLocation(0, 0, "حساس الاتجاه غير متاح"); return; }
        if (qiblaSensor == null) qiblaSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (qiblaSensor == null) { emitQiblaLocation(0, 0, "هذا الجهاز لا يحتوي حساس اتجاه مناسب"); return; }
        ensureQiblaListener();
        sensorManager.unregisterListener(qiblaSensorListener);
        sensorManager.registerListener(qiblaSensorListener, qiblaSensor, SensorManager.SENSOR_DELAY_UI);
        startQiblaLocationUpdates();
    }

    private void unregisterQiblaCompass(boolean clearRequest) {
        if (clearRequest) qiblaCompassRequested = false;
        if (sensorManager != null && qiblaSensorListener != null) sensorManager.unregisterListener(qiblaSensorListener);
        stopQiblaLocationUpdates();
    }


    @Override public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        dispatchSystemTheme();
    }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==NOTIFICATION_REQ){
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},LOCATION_REQ);
            else acquirePrayerLocation();
            return;
        }
        if(requestCode==LOCATION_REQ){
            if(grantResults.length>0 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED) acquirePrayerLocation();
            else emitIqamaStatus(false,"لم تُمنح صلاحية الموقع. افتح إعدادات التطبيق واسمح بالموقع ثم حاول مجددًا");
            return;
        }
        if(requestCode==MIC_REQ){
            boolean granted=grantResults.length>0 && checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED;
            if(granted && voicePermissionPending){voicePermissionPending=false;startVoiceRecognitionNative();}
            else {voicePermissionPending=false;emitVoiceResult("","اسمح للميكروفون لاستخدام البحث الصوتي والتسميع");}
            return;
        }
        if(requestCode==QIBLA_LOCATION_REQ){
            boolean granted=grantResults.length>0 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
            if(granted && qiblaLocationPending){qiblaLocationPending=false;acquireQiblaLocation();}
            else {qiblaLocationPending=false;emitQiblaLocation(0,0,"اسمح بالموقع لحساب اتجاه القبلة");}
        }
    }

    public class NoorBridge {
        @JavascriptInterface public void downloadSudais(String verseIdsCsv) { downloadSudaisFiles(verseIdsCsv); }
        @JavascriptInterface public boolean downloadReciter(String reciter, String verseIdsCsv) { return downloadReciterFiles(reciter, verseIdsCsv); }
        @JavascriptInterface public boolean saveOnlineReciter(String id,String name,String baseUrl,String numbering) {
            if (!validReciterId(id) || reciterDirectory(id) != null || !validOnlineBaseUrl(baseUrl) ||
                    !("global".equals(numbering) || "verseId".equals(numbering))) return false;
            String base = baseUrl.replaceAll("/+$", "");
            if (base.equals(prefs.getString("online_reciter_"+id+"_base","")) && numbering.equals(prefs.getString("online_reciter_"+id+"_numbering",""))) return true;
            return prefs.edit().putString("online_reciter_"+id+"_base",base).putString("online_reciter_"+id+"_numbering",numbering)
                    .putString("online_reciter_"+id+"_name",name == null ? "قارئ مضاف" : name).commit();
        }
        @JavascriptInterface public void removeCustomReciter(String id) {
            if (!validReciterId(id) || reciterDirectory(id) != null) return;
            // Keep completed audio files if this reader is added again later.
            prefs.edit().remove("online_reciter_"+id+"_base").remove("online_reciter_"+id+"_numbering")
                    .remove("online_reciter_"+id+"_name").remove("custom_reciter_"+id+"_uri")
                    .remove("custom_reciter_"+id+"_name").apply();
        }

        @JavascriptInterface public void cancelSudaisDownload() { audioDownloadCancelled = true; }
        @JavascriptInterface public void exportRecitations(String reciter) { runOnUiThread(() -> startRecitationExport(reciter)); }
        @JavascriptInterface public void importRecitations() { runOnUiThread(() -> startRecitationImport()); }
        @JavascriptInterface public boolean hasSudaisAyah(String id) {
            return id != null && id.matches("[0-9]{6}") &&
                    new File(new File(getFilesDir(), "sudais"), id + ".mp3").length() > 1024;
        }
        @JavascriptInterface public boolean hasReciterAyah(String reciter, String id) {
            return reciterBaseUrl(reciter) != null && globalAyahNumber(id) > 0 &&
                    isMp3File(new File(new File(getFilesDir(), reciter), id + ".mp3"));
        }
        @JavascriptInterface public boolean startNativeRepeat(String reciter,String keysJson,int count,int gap) {
            try {org.json.JSONArray keys=new org.json.JSONArray(keysJson),items=new org.json.JSONArray();for(int n=0;n<keys.length();n++){String key=keys.getString(n);String[] bits=key.split(":");String id=String.format(java.util.Locale.US,"%03d%03d",Integer.parseInt(bits[0]),Integer.parseInt(bits[1]));File local=new File(new File(getFilesDir(),reciter),id+".mp3");String source=isMp3File(local)?Uri.fromFile(local).toString():reciterAyahUrl(reciter,id);if(source==null)return false;org.json.JSONObject item=new org.json.JSONObject();item.put("key",key);item.put("source",source);items.put(item);}runOnUiThread(()->{releaseDownloadedPlayer();Intent i=new Intent(MainActivity.this,RecitationService.class).setAction("start").putExtra("items",items.toString()).putExtra("count",count).putExtra("gap",gap);startForegroundService(i);});return true;}catch(Exception e){return false;}
        }
        @JavascriptInterface public void nativeRepeatControl(String action){if(!action.equals("stop")&&!action.equals("pause")&&!action.equals("resume"))return;runOnUiThread(()->{if(action.equals("stop"))stopService(new Intent(MainActivity.this,RecitationService.class));else startService(new Intent(MainActivity.this,RecitationService.class).setAction(action));});}
        @JavascriptInterface public String getNativeRepeatState(){return RecitationService.snapshot;}
        @JavascriptInterface public void setAudioRequest(int token) {recitationRequest=token;}
        @JavascriptInterface public void stopDownloadedAyah() {runOnUiThread(() -> releaseDownloadedPlayer());}
        @JavascriptInterface public void pauseRecitation() {runOnUiThread(() -> {recitationPaused=true;try{if(downloadedPlayer!=null&&recitationPrepared&&downloadedPlayer.isPlaying())downloadedPlayer.pause();}catch(Exception ignored){}});}
        @JavascriptInterface public void resumeRecitation() {runOnUiThread(() -> {recitationPaused=false;try{if(downloadedPlayer!=null&&recitationPrepared){downloadedPlayer.start();audioEvent(recitationRequest,recitationVerseId,"playing");}}catch(Exception ignored){}});}
        @JavascriptInterface public boolean playDownloadedAyah(String reciter, String id) {
            if (!hasReciterAyah(reciter, id)) return false;
            File file = new File(new File(getFilesDir(), reciter), id + ".mp3");
            final int token=recitationRequest;
            runOnUiThread(() -> {
                releaseDownloadedPlayer();
                try {
                    MediaPlayer player = new MediaPlayer();
                    downloadedPlayer = player;
                    player.setAudioStreamType(AudioManager.STREAM_MUSIC);
                    player.setDataSource(file.getAbsolutePath());
                    configureRecitationPlayer(player,id,token);
                    player.prepareAsync();
                } catch (Exception error) { releaseDownloadedPlayer();audioEvent(token,id,"error"); }
            });
            return true;
        }
        @JavascriptInterface public boolean playReciterAyah(String reciter, String id) {
            final String url = reciterAyahUrl(reciter,id);
            if (url == null) return false;
            final File local = new File(new File(getFilesDir(), reciter), id + ".mp3");
            final boolean offline = isMp3File(local);
            final int token=recitationRequest;
            if (!offline) cacheReciterAyahInBackground(reciter, id, url);
            runOnUiThread(() -> {
                releaseDownloadedPlayer();
                try {
                    MediaPlayer player = new MediaPlayer();
                    downloadedPlayer = player;
                    player.setAudioStreamType(AudioManager.STREAM_MUSIC);
                    player.setDataSource(offline ? local.getAbsolutePath() :
                            url);
                    configureRecitationPlayer(player,id,token);
                    player.prepareAsync();
                } catch (Exception error) {
                    releaseDownloadedPlayer();
                    audioEvent(token,id,"error");
                }
            });
            return true;
        }
@JavascriptInterface
        public void shareText(String text) {
            final String safe = text == null ? "" : text;
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND)
                            .setType("text/plain")
                            .putExtra(Intent.EXTRA_TEXT, safe);
                    startActivity(Intent.createChooser(send, "مشاركة الآية"));
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void shareImage(String base64Png, String fileName, String text) {
            aiExecutor.submit(() -> {
                try {
                    if (base64Png == null || base64Png.length() > 24_000_000) return;
                    byte[] bytes = Base64.decode(base64Png, Base64.DEFAULT);
                    File dir = new File(getCacheDir(), "shared_images");
                    if (!dir.exists() && !dir.mkdirs()) return;
                    String safeName = (fileName == null ? "Noor-ayah.png" : fileName)
                            .replaceAll("[^A-Za-z0-9._-]", "-");
                    if (!safeName.endsWith(".png")) safeName += ".png";
                    File image = new File(dir, safeName);
                    try (FileOutputStream out = new FileOutputStream(image, false)) {
                        out.write(bytes);
                    }
                    Uri uri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            image
                    );
                    final String caption = text == null ? "" : text;
                    runOnUiThread(() -> {
                        try {
                            Intent send = new Intent(Intent.ACTION_SEND)
                                    .setType("image/png")
                                    .putExtra(Intent.EXTRA_STREAM, uri)
                                    .putExtra(Intent.EXTRA_TEXT, caption)
                                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            send.setClipData(ClipData.newUri(getContentResolver(), "Noor verse", uri));
                            startActivity(Intent.createChooser(send, "مشاركة الآية كصورة"));
                        } catch (Throwable ignored) {}
                    });
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void saveReaderPage(int page) {
            prefs.edit().putInt("reader_page", page).apply();
            NoorWidgetProvider.updateAllWidgets(MainActivity.this);
        }

        @JavascriptInterface
        public void saveReaderPosition(int page,String surah,String ayah){
            SharedPreferences.Editor e=prefs.edit().putInt("reader_page",Math.max(1,page));
            if(surah!=null)e.putString("reader_surah",surah);
            if(ayah!=null)e.putString("reader_ayah",ayah);
            e.apply();NoorWidgetProvider.updateAllWidgets(MainActivity.this);
        }

        @JavascriptInterface
        public int getReaderPage() {
            return prefs.getInt("reader_page", 1);
        }

        @JavascriptInterface
        public void enableAutomaticIqama(boolean enabled, boolean dark) {
            prefs.edit().putBoolean("iqama_auto_enabled",enabled).putBoolean("iqama_dark",dark).apply();
            if(enabled) runOnUiThread(() -> requestPrayerLocation(dark));
        }

        @JavascriptInterface
        public boolean hasPrayerLocation() { return prefs.getBoolean("prayer_location_saved",false); }

        @JavascriptInterface
        public String getNextPrayerJson() {
            try {
                PrayerTimeManager.PrayerInfo info=PrayerTimeManager.getNextPrayer(MainActivity.this);
                if(info==null)return "";
                JSONObject out=new JSONObject();out.put("name",info.name);out.put("timeMillis",info.timeMillis);return out.toString();
            } catch(Throwable ignored) { return ""; }
        }

        @JavascriptInterface
        public String getDailyPrayerTimesJson() { return PrayerTimeManager.getDailyPrayerTimesJson(MainActivity.this); }

        @JavascriptInterface
        public String getNextIqamaJson() {
            try {
                PrayerTimeManager.IqamaInfo info=PrayerTimeManager.getNextIqama(MainActivity.this);
                if(info==null)return "";
                JSONObject out=new JSONObject();out.put("name",info.name);out.put("adhanAt",info.adhanAt);out.put("iqamaAt",info.iqamaAt);return out.toString();
            } catch(Throwable ignored) { return ""; }
        }

        @JavascriptInterface public boolean getIqamaSoundEnabled(){return prefs.getBoolean("iqama_sound_enabled",false);}
        @JavascriptInterface public void setIqamaSoundEnabled(boolean enabled){prefs.edit().putBoolean("iqama_sound_enabled",enabled).apply();}
        @JavascriptInterface public boolean previewIqamaSound(){return IqamaSoundPlayer.preview(MainActivity.this);}

        @JavascriptInterface
        public int getIqamaReminderMinutes() { return Math.max(1,prefs.getInt("iqama_reminder_minutes",5)); }

        @JavascriptInterface
        public void setIqamaReminderMinutes(int minutes) {
            int safe=Math.max(1,Math.min(9,minutes));
            prefs.edit().putInt("iqama_reminder_minutes",safe).apply();
            PrayerTimeManager.scheduleFromSavedLocation(MainActivity.this);
        }

        @JavascriptInterface
        public boolean canDrawIqamaOverlay() { return Settings.canDrawOverlays(MainActivity.this); }

        @JavascriptInterface
        public void requestIqamaOverlayPermission() {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))); } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void requestExactAlarmPermission() {
            if (android.os.Build.VERSION.SDK_INT >= 31) runOnUiThread(() -> {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName()))); } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void setIqamaSchedule(String json) {
            try { IqamaScheduler.saveTemplates(MainActivity.this, json); } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void previewIqamaOverlay(String prayer, boolean dark) {
            if (!Settings.canDrawOverlays(MainActivity.this)) { requestIqamaOverlayPermission(); return; }
            int reminder=Math.max(1,prefs.getInt("iqama_reminder_minutes",5));
            Intent i=new Intent(MainActivity.this,IqamaOverlayService.class).putExtra("prayer",prayer).putExtra("iqamaAt",System.currentTimeMillis()+reminder*60_000L).putExtra("dark",dark).putExtra("reminderMinutes",reminder);
            if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        }

        @JavascriptInterface
        public void startVoiceRecognition() { runOnUiThread(() -> startVoiceRecognitionNative()); }

        @JavascriptInterface
        public void stopVoiceRecognition() { if (localQuranAsr != null) localQuranAsr.finish(); }

        @JavascriptInterface
        public void cancelVoiceRecognition() { if (localQuranAsr != null) localQuranAsr.cancel(); }

        @JavascriptInterface
        public String getPrayerLocationJson() {
            if(!prefs.getBoolean("prayer_location_saved",false)) return "";
            double lat=Double.longBitsToDouble(prefs.getLong("prayer_lat",0));
            double lon=Double.longBitsToDouble(prefs.getLong("prayer_lon",0));
            long savedAt=prefs.getLong("prayer_location_saved_at",0L);
            float accuracy=prefs.getFloat("prayer_location_accuracy",-1f);
            return "{\"lat\":"+lat+",\"lon\":"+lon+",\"savedAt\":"+savedAt+",\"accuracy\":"+accuracy+"}";
        }

        @JavascriptInterface
        public void chooseReciterFolder(){ runOnUiThread(() -> {
            try{
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(intent,RECITER_FOLDER_REQ);
            }catch(Throwable ignored){evalJs("window.noorReciterFolderPicked&&window.noorReciterFolderPicked('','','تعذر فتح منتقي المجلد')");}
        });}

        @JavascriptInterface
        public void saveCustomReciterFolder(String id,String name,String treeUri){
            if(id==null||!id.matches("custom_[0-9]+")||treeUri==null||!treeUri.startsWith("content://"))return;
            prefs.edit().putString("custom_reciter_"+id+"_uri",treeUri).putString("custom_reciter_"+id+"_name",name==null?"قارئ مخصص":name).apply();
        }

        private Uri findReciterDocument(Uri tree,String fileName){
            try{
                String treeId=DocumentsContract.getTreeDocumentId(tree);
                Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,treeId);
                String[] projection={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME};
                try(Cursor cursor=getContentResolver().query(children,projection,null,null,null)){
                    if(cursor!=null)while(cursor.moveToNext()){
                        String documentId=cursor.getString(0),displayName=cursor.getString(1);
                        if(fileName.equals(displayName)&&documentId!=null)return DocumentsContract.buildDocumentUriUsingTree(tree,documentId);
                    }
                }
            }catch(Throwable ignored){}
            return null;
        }

        @JavascriptInterface
        public boolean playCustomReciterAyah(String id,String verseId){
            if(id==null||!id.matches("custom_[0-9]+")||verseId==null||!verseId.matches("[0-9]{6}"))return false;
            String raw=prefs.getString("custom_reciter_"+id+"_uri","");if(raw.isEmpty())return false;
            try{
                Uri tree=Uri.parse(raw);Uri file=findReciterDocument(tree,verseId+".mp3");
                if(file==null)return false;
                try(android.os.ParcelFileDescriptor test=getContentResolver().openFileDescriptor(file,"r")){if(test==null)return false;}
                final int token=recitationRequest;
                runOnUiThread(() -> {releaseDownloadedPlayer();try{MediaPlayer player=new MediaPlayer();downloadedPlayer=player;player.setAudioStreamType(AudioManager.STREAM_MUSIC);player.setDataSource(MainActivity.this,file);configureRecitationPlayer(player,verseId,token);player.prepareAsync();}catch(Exception e){releaseDownloadedPlayer();audioEvent(token,verseId,"error");}});
                return true;
            }catch(Throwable ignored){return false;}
        }

        @JavascriptInterface
        public void requestQiblaLocation() { runOnUiThread(() -> requestQiblaLocationNative()); }

        @JavascriptInterface
        public void startQiblaCompass() { runOnUiThread(() -> registerQiblaCompass()); }

        @JavascriptInterface
        public void stopQiblaCompass() { runOnUiThread(() -> unregisterQiblaCompass(true)); }

        @JavascriptInterface
        public boolean requestPinWidget() {
            if(android.os.Build.VERSION.SDK_INT < 26) return false;
            AppWidgetManager manager=AppWidgetManager.getInstance(MainActivity.this);
            if(!manager.isRequestPinAppWidgetSupported()) return false;
            ComponentName provider=new ComponentName(MainActivity.this,NoorWidgetProvider.class);
            return manager.requestPinAppWidget(provider,null,null);
        }

        @JavascriptInterface
        public boolean isSystemDarkMode() {
            return currentSystemDark();
        }

        @JavascriptInterface
        public void setThemeMode(String mode) {
            String safe = "light".equals(mode) || "dark".equals(mode) ? mode : "system";
            prefs.edit().putString("theme_mode", safe).apply();
            applyThemeChrome("dark".equals(safe) || ("system".equals(safe) && currentSystemDark()));
        }

        @JavascriptInterface
        public void setSystemBarsDark(boolean dark) {
            applyThemeChrome(dark);
        }
    }
}
