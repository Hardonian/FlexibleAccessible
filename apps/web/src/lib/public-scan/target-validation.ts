import { ApiError } from "@aros/shared";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254",
]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export function isPrivateOrLoopbackAddress(address: string): boolean {
  return address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address);
}

export async function validatePublicScanTarget(hostname: string): Promise<void> {
  const normalizedHostname = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(normalizedHostname) || normalizedHostname.endsWith(".local")) {
    throw new ApiError(
      "Private, loopback, and local network hosts are not allowed for public scans.",
      "PUBLIC_SCAN_HOST_BLOCKED",
      400,
    );
  }

  let resolvedAddress: string;
  try {
    const { address } = await lookup(normalizedHostname);
    resolvedAddress = address;
  } catch {
    throw ApiError.badRequest("Domain could not be resolved. Please enter a public hostname.");
  }

  if (isPrivateOrLoopbackAddress(resolvedAddress)) {
    throw new ApiError(
      "Resolved host points to a private or loopback address and cannot be scanned publicly.",
      "PUBLIC_SCAN_HOST_BLOCKED",
      400,
      { hostname: normalizedHostname },
    );
  }
}
