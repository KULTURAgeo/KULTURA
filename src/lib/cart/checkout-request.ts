const KEY = "kultura.checkout.request.v2";
const activeKeys = new Map<string, string>();

// Persist only a one-way payload fingerprint and random request ID, never address
// or contact data. A shared lock coordinates tabs where Web Locks is supported.
export async function checkoutRequestId(customer: string, payload: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([customer, payload])));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const storageKey = `${KEY}.${fingerprint}`;
  const getOrCreate = () => {
    const raw = localStorage.getItem(storageKey);
    let saved: { fingerprint?: string; id?: string } | null = null;
    try { saved = raw ? JSON.parse(raw) : null; } catch { /* Replace corrupt local data. */ }
    if (saved?.fingerprint === fingerprint && typeof saved.id === "string" && /^[0-9a-f-]{36}$/.test(saved.id)) {
      activeKeys.set(saved.id, storageKey);
      return saved.id;
    }
    const id = crypto.randomUUID();
    // Fail before submission if persistence is blocked: retries must retain a key.
    localStorage.setItem(storageKey, JSON.stringify({ fingerprint, id }));
    activeKeys.set(id, storageKey);
    return id;
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(storageKey, getOrCreate)
    : getOrCreate();
}

export function finishCheckoutRequest(id: string) {
  try {
    const storageKey = activeKeys.get(id);
    if (!storageKey) return;
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    // Keep the completed key for stale tabs and delayed responses. A deliberate
    // new add-to-cart starts a new purchase instead of replaying the old order.
    if (saved?.id === id) localStorage.setItem(storageKey, JSON.stringify({ ...saved, completed: true }));
    activeKeys.delete(id);
  } catch { /* An already-persisted order remains valid. */ }
}

export function beginNewCheckoutIntent() {
  try {
    const completed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${KEY}.`)) continue;
      try {
        if (JSON.parse(localStorage.getItem(key) ?? "null")?.completed === true) completed.push(key);
      } catch { /* Unrelated corrupt records cannot block adding an item. */ }
    }
    completed.forEach(key => localStorage.removeItem(key));
  } catch { /* Checkout itself requires durable storage before submission. */ }
}
