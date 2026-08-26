/**
 * data/chat-facts.js — content for the Campus Chat spotlight.
 * Facts mirror chat/crypto/ChatCrypto.kt, chat/net/* and
 * chat/service/ChatService.kt [read from source this session].
 */

export const pipeline = [
  { name: "X25519", desc: "ECDH key agreement — pure-Java fallback for Android 8–12" },
  { name: "HKDF-SHA256", desc: "Derives a 32-byte shared key from the ECDH secret" },
  { name: "AES-256-GCM", desc: "Authenticated encryption, fresh nonce per message" },
];

export const discovery = [
  {
    icon: "radio",
    title: "UDP Multicast",
    desc: "Beacons on 239.255.0.1 every 3 s, sent on every interface to survive VPN tunnels.",
  },
  {
    icon: "cast",
    title: "mDNS / NSD",
    desc: "_iiserkchat._tcp services resolved through Android's native discovery stack.",
  },
  {
    icon: "plug",
    title: "Connect by IP",
    desc: "Manual fallback for routers that block multicast — HELLO re-keys the connection.",
  },
];

export const checklist = [
  "Friend requests with accept / reject actions in system notifications",
  "Presence heartbeat + stale sweep — online dots you can trust",
  "Typing indicators and read receipts (✓ sent, ✓✓ read)",
  "Chunked file & image transfer gated behind explicit consent",
  "Persistent outbox & inbox — messages survive process death",
  "Live network graph: friends inner-ring, strangers outer-ring",
  "Thread search, JSON export and retention trimming",
];
