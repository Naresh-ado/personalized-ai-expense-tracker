package com.aiexpensetracker.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class SmsSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("ai_expense_prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("connected", false)) {
            return Result.success()
        }

        val serverHost = prefs.getString("server_host", "10.183.6.192") ?: "10.183.6.192"
        val lastProcessedTime = prefs.getLong("last_sms_sync_time", 0L)
        val inputBody = inputData.getString("sms_body")
        val inputTimestamp = inputData.getLong("sms_timestamp", System.currentTimeMillis())

        if (inputBody.isNullOrBlank() && ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            return Result.success()
        }

        val messages = mutableListOf<Pair<String, Long>>()
        if (!inputBody.isNullOrBlank()) {
            messages.add(Pair(inputBody, inputTimestamp))
        } else {
            val uri = Uri.parse("content://sms/inbox")
            val projection = arrayOf(Telephony.Sms.BODY, Telephony.Sms.DATE)
            val cursor = applicationContext.contentResolver.query(
                uri,
                projection,
                "date > ?",
                arrayOf(lastProcessedTime.toString()),
                "date ASC"
            )
            cursor?.use {
                val bodyColumn = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateColumn = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
                while (it.moveToNext()) {
                    val body = it.getString(bodyColumn).orEmpty()
                    val date = it.getLong(dateColumn)
                    if (body.isNotBlank()) messages.add(Pair(body, date))
                }
            }
        }

        if (messages.isEmpty()) return Result.success()

        val service = Retrofit.Builder()
            .baseUrl(HostUtils.buildBaseUrl(serverHost))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)

        var latestTimestamp = lastProcessedTime
        var hadNetworkFailure = false

        for ((body, timestamp) in messages) {
            val parsed = SmsParser.parse(body, timestamp) ?: continue
            val payload = DirectTransactionPayload(
                sms = parsed.sms,
                amount = parsed.amount,
                merchant = parsed.merchant,
                date = parsed.date,
                type = parsed.type,
                email = prefs.getString("user_email", "nrshsenthil@gmail.com") ?: "nrshsenthil@gmail.com",
                name = prefs.getString("user_name", "NAresh") ?: "NAresh"
            )

            try {
                val response = service.sendDirectTransaction(payload).execute()
                if (response.isSuccessful) {
                    latestTimestamp = maxOf(latestTimestamp, timestamp)
                } else {
                    hadNetworkFailure = true
                }
            } catch (_: Exception) {
                hadNetworkFailure = true
            }
        }

        if (latestTimestamp != lastProcessedTime) {
            prefs.edit().putLong("last_sms_sync_time", latestTimestamp).apply()
        }

        return if (hadNetworkFailure) Result.retry() else Result.success()
    }
}
