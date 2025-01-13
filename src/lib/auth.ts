// Mock user for development
const MOCK_USER = {
  user: {
    address: "0x1234567890123456789012345678901234567890",
  },
};

export async function auth() {
  return MOCK_USER;
}

export function getAddressFromHeader(req: Request): string | null {
  const address = req.headers.get("x-address")
  if (!address) return null
  return address.toLowerCase()
} 