"use client";

export function getSessionId(): string {
  const key = "driftroom:sessionId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
