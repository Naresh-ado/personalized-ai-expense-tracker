package com.aiexpensetracker.mobile

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SmsParser {
    fun parse(body: String, timestamp: Long = System.currentTimeMillis()): ParsedSmsTransaction? {
        if (!isTransactionSms(body)) return null

        val amount = parseAmount(body) ?: return null
        val type = parseType(body)
        val merchant = parseMerchant(body)
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(timestamp))

        return ParsedSmsTransaction(
            sms = body,
            amount = amount,
            merchant = merchant,
            date = date,
            type = type
        )
    }

    private fun isTransactionSms(body: String): Boolean {
        val lowered = body.lowercase(Locale.US)
        return lowered.contains("debit") ||
            lowered.contains("debited") ||
            lowered.contains("spent") ||
            lowered.contains("paid") ||
            lowered.contains("credited") ||
            lowered.contains("credit")
    }

    private fun parseAmount(body: String): String? {
        val patterns = listOf(
            Regex("""(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE),
            Regex("""([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹)""", RegexOption.IGNORE_CASE)
        )

        return patterns
            .asSequence()
            .mapNotNull { it.find(body)?.groups?.get(1)?.value }
            .firstOrNull()
            ?.replace(",", "")
    }

    private fun parseType(body: String): String {
        return if (body.contains("credit", ignoreCase = true) || body.contains("credited", ignoreCase = true)) {
            "credit"
        } else {
            "debit"
        }
    }

    private fun parseMerchant(body: String): String {
        val knownMerchants = listOf(
            "Swiggy", "Zomato", "Amazon", "Flipkart", "Uber", "Ola",
            "Paytm", "PhonePe", "Google Pay", "GPay", "Blinkit", "Zepto"
        )
        knownMerchants.firstOrNull { body.contains(it, ignoreCase = true) }?.let { return it }

        val patterns = listOf(
            Regex("""(?:to|at|for|towards|paid to)\s+([A-Za-z0-9 .&_-]{3,40})""", RegexOption.IGNORE_CASE),
            Regex("""(?:UPI|VPA)\s+([A-Za-z0-9 .&@_-]{3,40})""", RegexOption.IGNORE_CASE)
        )

        val extracted = patterns
            .asSequence()
            .mapNotNull { it.find(body)?.groups?.get(1)?.value }
            .firstOrNull()
            ?.replace(Regex("""\s+(?:on|via|ref|txn|transaction).*$""", RegexOption.IGNORE_CASE), "")
            ?.trim(' ', '.', ',', '-')

        return extracted?.takeIf { it.isNotBlank() } ?: "Unknown"
    }
}

data class ParsedSmsTransaction(
    val sms: String,
    val amount: String,
    val merchant: String,
    val date: String,
    val type: String
)
