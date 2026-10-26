/**
 * data/tcp.data.js — campus gateway device list (TCP count and MAC
 * registration screens).
 *
 * The gateway asks for a CAPTCHA sign-in, which a browser on another site
 * cannot complete, so these are always sample devices (data/samples/tcp.json).
 */

import { load } from "../services/source.js";
import { MONTH_NAMES } from "../ui/dom.js";

export const GATEWAY_URL = "https://gw.iiserkol.ac.in/macreg/";

const fmt = (d) => `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
const dayOffset = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

export async function loadGateway() {
  const r = await load("tcp");
  const s = r.data;
  return {
    ...r,
    data: {
      user: s.user,
      tcpCount: s.tcpCount,
      totalDevices: s.totalDevices,
      maxAllowed: s.maxAllowed,
      devices: s.devices.map((d) => ({
        slNo: d.slNo,
        macAddress: d.macAddress,
        deviceType: d.deviceType,
        location: d.location,
        validFrom: fmt(dayOffset(-d.validFromDaysAgo)),
        validTill: fmt(dayOffset(d.validTillInDays)),
      })),
    },
  };
}

/** Icon for a device type, as DeviceCard picks it. */
export function deviceIcon(type = "") {
  const t = type.toLowerCase();
  if (t.includes("laptop") || t.includes("computer") || t.includes("desktop")) return "computer";
  if (t.includes("phone") || t.includes("mobile")) return "wifi";
  return "devices_other";
}
