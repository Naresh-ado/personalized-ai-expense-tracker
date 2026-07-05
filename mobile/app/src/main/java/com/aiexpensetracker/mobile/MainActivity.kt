package com.aiexpensetracker.mobile

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.aiexpensetracker.mobile.databinding.ActivityMainBinding
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient

private const val PREFS_NAME = "ai_expense_prefs"
private const val PREF_SERVER_HOST = "server_host"
private const val PREF_USER_EMAIL = "user_email"
private const val PREF_USER_NAME = "user_name"
private const val PREF_CONNECTED = "connected"
private const val EMULATOR_HOST = "10.0.2.2"
private const val GENYMOTION_HOST = "10.0.3.2"
private const val PC_HOST = "10.183.6.192"
private const val DEFAULT_EMAIL = "nrshsenthil@gmail.com"
private const val DEFAULT_NAME = "NAresh"

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: SharedPreferences

    private fun getServerHost(): String {
        return prefs.getString(PREF_SERVER_HOST, getDefaultServerHost()) ?: getDefaultServerHost()
    }

    private fun getDefaultServerHost(): String {
        return if (isEmulator()) EMULATOR_HOST else PC_HOST
    }

    private fun getHostCandidates(inputHost: String?): List<String> {
        val hosts = mutableListOf<String>()
        if (!inputHost.isNullOrBlank()) {
            hosts.add(inputHost)
        }
        hosts.add(PC_HOST)
        hosts.add(EMULATOR_HOST)
        hosts.add(GENYMOTION_HOST)
        return hosts.distinct()
    }

    private fun createApiService(host: String): ApiService? {
        return try {
            val client = OkHttpClient.Builder()
                .connectTimeout(4, TimeUnit.SECONDS)
                .readTimeout(4, TimeUnit.SECONDS)
                .writeTimeout(4, TimeUnit.SECONDS)
                .build()

            Retrofit.Builder()
                .baseUrl(HostUtils.buildBaseUrl(host))
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        } catch (_: Exception) {
            null
        }
    }

    private fun isEmulator(): Boolean {
        return (android.os.Build.FINGERPRINT.startsWith("generic")
            || android.os.Build.FINGERPRINT.lowercase().contains("vbox")
            || android.os.Build.FINGERPRINT.lowercase().contains("test-keys")
            || android.os.Build.MODEL.contains("Emulator")
            || android.os.Build.MODEL.contains("Android SDK built for x86"))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        binding.serverHostInput.setText(getServerHost())
        prefs.edit()
            .putString(PREF_USER_EMAIL, prefs.getString(PREF_USER_EMAIL, DEFAULT_EMAIL) ?: DEFAULT_EMAIL)
            .putString(PREF_USER_NAME, prefs.getString(PREF_USER_NAME, DEFAULT_NAME) ?: DEFAULT_NAME)
            .apply()

        binding.btnLogin.setOnClickListener {
            connectToWebsite()
        }

        binding.btnRequestPermission.setOnClickListener {
            requestSmsPermission()
        }

        binding.btnSync.setOnClickListener {
            syncInboxNow()
        }

        updateStatusText()
    }

    private fun updateStatusText() {
        val connected = prefs.getBoolean(PREF_CONNECTED, false)
        binding.statusText.text = if (connected) {
            getString(R.string.status_connected)
        } else {
            getString(R.string.status_default)
        }
    }

    private fun connectToWebsite() {
        val inputHost = binding.serverHostInput.text.toString().trim().ifEmpty { null }
        val hostCandidates = getHostCandidates(inputHost)

        binding.statusText.text = getString(R.string.status_connecting)
        attemptConnection(hostCandidates, 0)
    }

    private fun attemptConnection(hosts: List<String>, index: Int) {
        if (index >= hosts.size) {
            prefs.edit().putBoolean(PREF_CONNECTED, false).apply()
            binding.statusText.text = getString(R.string.status_connect_failed)
            Toast.makeText(this@MainActivity, "Cannot reach website backend on port 5000.", Toast.LENGTH_LONG).show()
            return
        }

        val host = hosts[index]
        val healthUrl = HostUtils.buildBaseUrl(host) + "health"
        binding.statusText.text = "Connecting to $healthUrl"
        val apiService = createApiService(host)
        if (apiService == null) {
            binding.statusText.text = getString(R.string.status_connect_failed)
            Toast.makeText(this@MainActivity, "Invalid server address. Use host or host:port.", Toast.LENGTH_LONG).show()
            return
        }

        apiService.health().enqueue(object : Callback<Map<String, Any>> {
            override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                if (response.isSuccessful) {
                    prefs.edit()
                        .putString(PREF_SERVER_HOST, host)
                        .putBoolean(PREF_CONNECTED, true)
                        .apply()
                    binding.serverHostInput.setText(host)
                    Toast.makeText(this@MainActivity, "Connected to website", Toast.LENGTH_SHORT).show()
                    updateStatusText()
                    syncInboxNow()
                } else {
                    binding.statusText.text = "No response from $healthUrl (${response.code()})"
                    attemptConnection(hosts, index + 1)
                }
            }

            override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                binding.statusText.text = "Failed $healthUrl: ${t.message ?: "network error"}"
                attemptConnection(hosts, index + 1)
            }
        })
    }

    private fun requestSmsPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS), 1001)
        } else {
            Toast.makeText(this, getString(R.string.status_permission_granted), Toast.LENGTH_SHORT).show()
            syncInboxNow()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001 && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            Toast.makeText(this, getString(R.string.status_permission_granted), Toast.LENGTH_SHORT).show()
            syncInboxNow()
        }
    }

    private fun syncInboxNow() {
        if (!prefs.getBoolean(PREF_CONNECTED, false)) {
            binding.statusText.text = getString(R.string.status_default)
            Toast.makeText(this, "Tap Connect first.", Toast.LENGTH_SHORT).show()
            return
        }

        WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<SmsSyncWorker>().build())
        binding.statusText.text = getString(R.string.status_sync_started)
    }
}

interface ApiService {
    @GET("health")
    fun health(): Call<Map<String, Any>>

    @POST("auth/login")
    fun login(@Body request: LoginRequest): Call<LoginResponse>

    @POST("transactions/direct")
    fun sendDirectTransaction(@Body payload: DirectTransactionPayload): Call<Map<String, Any>>
}

data class LoginRequest(
    val email: String,
    val name: String,
    val googleId: String
)

data class LoginResponse(
    val token: String,
    val user: Map<String, Any>
)

data class TransactionPayload(
    val sms: String,
    val amount: String,
    val merchant: String,
    val date: String,
    val type: String
)

data class DirectTransactionPayload(
    val sms: String,
    val amount: String,
    val merchant: String,
    val date: String,
    val type: String,
    val email: String,
    val name: String
)
