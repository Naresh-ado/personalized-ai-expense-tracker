package com.aiexpensetracker.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class HostUtilsTest {
    @Test
    fun buildsBaseUrlFromHostAndPort() {
        assertEquals("http://10.183.6.192:5000/api/", HostUtils.buildBaseUrl("10.183.6.192:5000"))
        assertEquals("http://10.183.6.192:5000/api/", HostUtils.buildBaseUrl("10.183.6.192"))
        assertEquals("http://localhost:5000/api/", HostUtils.buildBaseUrl("localhost"))
    }
}
