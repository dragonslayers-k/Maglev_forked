package com.maglev.engine.player

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.maglev.engine.wireguard.WireGuardController
import okhttp3.Authenticator
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Response
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.URI
import java.util.concurrent.TimeUnit

/** In-app playback baseline. Handles progressive files/URLs, HLS and DASH through Media3. */
@UnstableApi
class MaglevMediaPlayerActivity : Activity() {
    private var player: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var pipButton: TextView? = null
    private var released = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.requestFeature(Window.FEATURE_NO_TITLE)
        window.setBackgroundDrawableResource(android.R.color.black)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val view = PlayerView(this).apply {
            useController = true
            controllerShowTimeoutMs = 4500
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            setKeepScreenOn(true)
        }
        playerView = view
        root.addView(view, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        val pip = TextView(this).apply {
            text = "PiP"
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            contentDescription = "화면 속 화면"
            setPadding(dp(14), dp(8), dp(14), dp(8))
            setBackgroundColor(0x99000000.toInt())
            visibility = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) View.VISIBLE else View.GONE
            setOnClickListener { enterPip() }
        }
        pipButton = pip
        root.addView(pip, FrameLayout.LayoutParams(dp(56), dp(42), Gravity.TOP or Gravity.END).apply {
            topMargin = dp(14)
            marginEnd = dp(14)
        })
        setContentView(root)
        startPlayer(intent)
    }

    private fun startPlayer(intent: Intent) {
        released = false
        val raw = intent.getStringExtra(EXTRA_URI)?.trim().orEmpty()
        val uri = Uri.parse(raw)
        if (raw.isBlank() || (uri.scheme != "http" && uri.scheme != "https" && uri.scheme != "content" && uri.scheme != "file")) {
            Toast.makeText(this, "재생할 수 없는 미디어 주소입니다.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        val title = intent.getStringExtra(EXTRA_TITLE)?.take(200).orEmpty()
        val mime = intent.getStringExtra(EXTRA_MIME)?.trim().orEmpty().ifBlank { inferMime(raw) }
        @Suppress("DEPRECATION")
        val headers = intent.getSerializableExtra(EXTRA_HEADERS) as? HashMap<String, String> ?: hashMapOf()
        val client = buildHttpClient()
        val httpFactory = OkHttpDataSource.Factory(client).setUserAgent(DEFAULT_USER_AGENT)
            .setDefaultRequestProperties(headers)
        val dataSourceFactory = DefaultDataSource.Factory(this, httpFactory)
        val sourceFactory = DefaultMediaSourceFactory(dataSourceFactory)
        val exo = ExoPlayer.Builder(this).setMediaSourceFactory(sourceFactory).build()
        player = exo
        playerView?.player = exo
        exo.setAudioAttributes(
            AudioAttributes.Builder().setUsage(androidx.media3.common.C.USAGE_MEDIA)
                .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MOVIE).build(),
            true,
        )
        exo.addListener(object : Player.Listener {
            override fun onVideoSizeChanged(videoSize: VideoSize) {
                updatePipParams(videoSize.width, videoSize.height)
            }
            override fun onPlayerError(error: PlaybackException) {
                val msg = error.localizedMessage?.take(180).orEmpty().ifBlank { "미디어 재생에 실패했습니다." }
                Toast.makeText(this@MaglevMediaPlayerActivity, msg, Toast.LENGTH_LONG).show()
            }
        })
        val item = MediaItem.Builder().setUri(uri).apply {
            if (mime.isNotBlank()) setMimeType(mime)
            if (title.isNotBlank()) setMediaMetadata(androidx.media3.common.MediaMetadata.Builder().setTitle(title).build())
        }.build()
        exo.setMediaItem(item)
        exo.prepare()
        exo.playWhenReady = true
        updatePipParams(16, 9)
    }

    /** When app-local WireGuard is enabled, playback must use its authenticated proxy or fail closed. */
    private fun buildHttpClient(): OkHttpClient {
        val proxyUrl = WireGuardController.mediaPlaybackProxy(applicationContext)
        val builder = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
        if (!proxyUrl.isNullOrBlank()) {
            try {
                val parsed = URI(proxyUrl)
                val host = parsed.host ?: "127.0.0.1"
                val port = parsed.port.takeIf { it in 1..65535 } ?: 9
                builder.proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress(host, port)))
                val user = parsed.userInfo?.substringBefore(':')?.let { Uri.decode(it) }.orEmpty()
                val pass = parsed.userInfo?.substringAfter(':', "")?.let(Uri::decode).orEmpty()
                if (user.isNotBlank()) {
                    builder.proxyAuthenticator(Authenticator { _, response: Response ->
                        if (response.request.header("Proxy-Authorization") != null) return@Authenticator null
                        response.request.newBuilder()
                            .header("Proxy-Authorization", Credentials.basic(user, pass))
                            .build()
                    })
                }
            } catch (_: Throwable) {
                // Invalid or unavailable proxy config is not replaced with a direct client.
                builder.proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress("127.0.0.1", 9)))
            }
        }
        return builder.build()
    }

    private fun enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val exo = player ?: return
        if (!exo.isPlaying && !exo.playWhenReady) {
            Toast.makeText(this, "먼저 미디어 재생을 시작하세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val size = exo.videoSize
        updatePipParams(size.width, size.height)
        try {
            enterPictureInPictureMode(buildPipParams(size.width, size.height, Build.VERSION.SDK_INT >= Build.VERSION_CODES.S))
        } catch (_: Throwable) {
            Toast.makeText(this, "PiP 전환을 시작하지 못했습니다.", Toast.LENGTH_SHORT).show()
        }
    }

    @Suppress("DEPRECATION")
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && player?.isPlaying == true) enterPip()
    }

    private fun updatePipParams(width: Int, height: Int) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            setPictureInPictureParams(buildPipParams(width, height, Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && player?.isPlaying == true))
        } catch (_: Throwable) {}
    }

    private fun buildPipParams(width: Int, height: Int, autoEnter: Boolean): PictureInPictureParams {
        val ratio = if (width > 0 && height > 0) width.toDouble() / height.toDouble() else 16.0 / 9.0
        val safe = ratio.coerceIn(0.42, 2.39)
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational((safe * 1000).toInt(), 1000))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(autoEnter)
        return builder.build()
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        playerView?.useController = !isInPictureInPictureMode
        pipButton?.visibility = if (isInPictureInPictureMode) View.GONE else View.VISIBLE
    }

    override fun onStop() {
        super.onStop()
        if (!isInPictureInPictureMode) releasePlayer()
    }

    override fun onDestroy() {
        releasePlayer()
        super.onDestroy()
    }

    private fun releasePlayer() {
        if (released) return
        released = true
        playerView?.player = null
        player?.release()
        player = null
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun inferMime(url: String): String {
        val path = url.substringBefore('?').substringBefore('#').lowercase()
        return when {
            path.endsWith(".m3u8") -> "application/vnd.apple.mpegurl"
            path.endsWith(".mpd") -> "application/dash+xml"
            path.endsWith(".webm") -> "video/webm"
            path.endsWith(".mkv") -> "video/x-matroska"
            path.endsWith(".mov") -> "video/quicktime"
            path.endsWith(".m4v") -> "video/x-m4v"
            path.endsWith(".mp4") -> "video/mp4"
            path.endsWith(".mp3") -> "audio/mpeg"
            path.endsWith(".m4a") -> "audio/mp4"
            path.endsWith(".aac") -> "audio/aac"
            path.endsWith(".ogg") || path.endsWith(".opus") -> "audio/ogg"
            path.endsWith(".wav") -> "audio/wav"
            else -> ""
        }
    }

    companion object {
        const val EXTRA_URI = "maglev.player.uri"
        const val EXTRA_MIME = "maglev.player.mime"
        const val EXTRA_TITLE = "maglev.player.title"
        const val EXTRA_HEADERS = "maglev.player.headers"
        private const val DEFAULT_USER_AGENT = "Maglev+/Android Media3"
    }
}
