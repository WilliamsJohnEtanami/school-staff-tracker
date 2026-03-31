export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const deviceType = detectDeviceType(ua);
  return { browser, operating_system: os, device_type: deviceType };
}

export function parseDeviceInfo(ua: string) {
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const deviceType = detectDeviceType(ua);
  return { browser, operating_system: os, device_type: deviceType };
}

function detectBrowser(ua: string): string {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (ua.includes("Windows NT 10")) return "Windows 10/11";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("CrOS")) return "Chrome OS";
  return "Unknown";
}

function detectDeviceType(ua: string): string {
  if (/iPad|tablet/i.test(ua)) return "Tablet";
  if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}
