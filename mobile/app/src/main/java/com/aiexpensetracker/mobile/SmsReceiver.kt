package com.aiexpensetracker.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        val body = messages.joinToString(separator = " ") { it.messageBody.orEmpty() }.trim()
        if (body.isBlank()) return

        Log.d("SmsReceiver", "Received SMS: $body")

        val prefs = context.getSharedPreferences("ai_expense_prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("connected", false)) {
            Log.d("SmsReceiver", "SMS sync skipped because app is not connected yet")
            return
        }

        val timestamp = messages.map { it.timestampMillis }.filter { it > 0L }.minOrNull() ?: System.currentTimeMillis()
        val request = OneTimeWorkRequestBuilder<SmsSyncWorker>()
            .setInputData(
                Data.Builder()
                    .putString("sms_body", body)
                    .putLong("sms_timestamp", timestamp)
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}
