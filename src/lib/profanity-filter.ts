// Basic blocklist for name validation
const BLOCKED_WORDS = [
  "fuck", "shit", "ass", "bitch", "damn", "crap", "dick", "cock", "pussy",
  "bastard", "slut", "whore", "nigger", "nigga", "faggot", "fag", "retard",
  "cunt", "twat", "wanker", "prick", "bollocks", "arse", "douche",
  "motherfucker", "bullshit", "asshole", "dumbass", "jackass",
  "kike", "chink", "spic", "wetback", "cracker", "honky", "gook",
  "tranny", "dyke", "homo",
];

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z]/g, " ");
  const words = lower.split(/\s+/);
  return words.some((word) => BLOCKED_WORDS.includes(word));
}

export function isValidName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, error: "Name must be at least 2 characters" };
  if (trimmed.length > 50) return { valid: false, error: "Name must be under 50 characters" };
  if (containsProfanity(trimmed)) return { valid: false, error: "Please use an appropriate name" };
  if (!/[a-zA-Z]/.test(trimmed)) return { valid: false, error: "Name must contain at least one letter" };
  return { valid: true };
}
