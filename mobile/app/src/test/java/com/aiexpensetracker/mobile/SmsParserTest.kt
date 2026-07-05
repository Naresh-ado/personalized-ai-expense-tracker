package com.aiexpensetracker.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SmsParserTest {
    @Test
    fun parsesDebitAmountAndMerchantFromBankSms() {
        val parsed = SmsParser.parse("Rs.20 debited from A/C XXXX1234 to JOHN via UPI Ref 12345", 1783252800000L)

        assertNotNull(parsed)
        assertEquals("20", parsed!!.amount)
        assertEquals("JOHN", parsed.merchant)
        assertEquals("debit", parsed.type)
        assertEquals("2026-07-05", parsed.date)
    }

    @Test
    fun parsesCreditSms() {
        val parsed = SmsParser.parse("INR 500.50 credited to your account from ACME", 1783252800000L)

        assertNotNull(parsed)
        assertEquals("500.50", parsed!!.amount)
        assertEquals("credit", parsed.type)
    }
}
