package com.aiexpensetracker.mobile

object HostUtils {
    private const val DEFAULT_BACKEND_PORT = 5000

    fun buildBaseUrl(rawHost: String): String {
        val normalized = rawHost.trim().removePrefix("http://").removePrefix("https://")
        val hostPart = normalized.substringBefore('/')
        val hostWithoutPort = hostPart.substringBefore(':')
        val port = hostPart.substringAfter(':', "").takeIf { it.isNotEmpty() }?.toIntOrNull() ?: DEFAULT_BACKEND_PORT

        return "http://${hostWithoutPort}:$port/api/"
    }
}
