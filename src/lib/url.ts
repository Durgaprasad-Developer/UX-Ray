import { URL } from "url";

/**
 * Validates a website URL to prevent SSRF and access to private networks
 * as mandated by the project security rules.
 */
export function validateUrl(urlString: string): { isValid: boolean; error?: string; cleanUrl?: string } {
  if (!urlString) {
    return { isValid: false, error: "URL is required." };
  }

  // Ensure protocol is present, default to https if missing
  let target = urlString.trim();
  if (!/^https?:\/\//i.test(target)) {
    target = "https://" + target;
  }

  try {
    const parsed = new URL(target);

    // Block non-HTTP protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isValid: false, error: "Only http:// and https:// protocols are supported." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost, local network names
    if (
      hostname === "localhost" ||
      hostname === "loopback" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid") ||
      hostname.endsWith(".example") ||
      hostname === "0.0.0.0"
    ) {
      return { isValid: false, error: "Accessing local or private domains is strictly prohibited." };
    }

    // IP Address validation
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);

    if (ipv4Match) {
      const [, octet1, octet2, octet3, octet4] = ipv4Match.map(Number);
      
      if (
        octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255
      ) {
        return { isValid: false, error: "Invalid IP address format." };
      }

      // Block Private IPv4 Ranges:
      // - 127.0.0.0/8 (Loopback)
      // - 10.0.0.0/8 (Private Network)
      // - 172.16.0.0/12 (Private Network)
      // - 192.168.0.0/16 (Private Network)
      // - 169.254.0.0/16 (Link-Local)
      if (
        octet1 === 127 ||
        octet1 === 10 ||
        (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
        (octet1 === 192 && octet2 === 168) ||
        (octet1 === 169 && octet2 === 254)
      ) {
        return { isValid: false, error: "Accessing local or private IP ranges is strictly prohibited." };
      }
    }

    // Block IPv6 Loopback/Private Ranges:
    // - ::1 (Loopback)
    // - fc00::/7 (Unique Local Address)
    // - fe80::/10 (Link-Local Address)
    if (
      hostname === "::1" ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc00:") ||
      hostname.startsWith("fd00:")
    ) {
      return { isValid: false, error: "Accessing local or private IPv6 ranges is strictly prohibited." };
    }

    return { isValid: true, cleanUrl: parsed.toString() };
  } catch (err) {
    return { isValid: false, error: "Malformed URL. Please provide a valid web address." };
  }
}
