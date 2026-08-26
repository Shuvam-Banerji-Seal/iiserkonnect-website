/**
 * data/tech-stack.js — stack chips + security bullets.
 * Every claim mirrors the app's build.gradle.kts and source.
 */

export const techStack = [
  "Kotlin", "Jetpack Compose", "Material 3", "Hilt DI", "Room",
  "Coroutines & Flow", "WorkManager", "OkHttp", "Jsoup",
  "DataStore", "Coil", "kotlinx.serialization", "NSD / mDNS",
  "PdfRenderer", "EncryptedSharedPreferences", "ZXing",
];

export const security = [
  "Credentials live only in keystore-backed EncryptedSharedPreferences — with automatic corruption self-heal.",
  "Chat private keys never leave the device; ciphertext exists only on the wire.",
  "Zero cloud servers: the app talks directly to campus services over your network.",
  "No analytics, no trackers, no third-party SDKs collecting usage.",
  "In-app WebViews enforce a strict host allow-list with mixed content blocked.",
  "Files are shared exclusively through scoped FileProvider URIs.",
];
