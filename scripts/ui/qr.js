/**
 * ui/qr.js — QR codes as inline SVG (vendor/qrcode-generator.js, MIT).
 * qrSvg("upi://pay?...", { ecc: "M", margin: 2, label: "UPI QR" })
 */

import qrcode from "../vendor/qrcode-generator.js";

export function qrSvg(text, { ecc = "M", margin = 2, label = "QR code", dark = "#000", light = "#fff" } = {}) {
  const q = qrcode(0, ecc);
  q.addData(String(text), "Byte");
  q.make();
  const n = q.getModuleCount();
  const size = n + margin * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  }
  const t = label.replace(/[<>&"]/g, "");
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${t}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
