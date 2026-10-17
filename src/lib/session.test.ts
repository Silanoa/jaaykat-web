import { describe, expect, it } from "vitest";
import { clearStoredSession, createMemoryStorage, readStoredSession, writeStoredSession } from "./session";

describe("jk.session", () => {
  it("relit un jeton non expiré", () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "abc", expiresAt: "2099-01-01T00:00:00.000Z" });
    expect(readStoredSession(storage, Date.parse("2026-10-17T00:00:00.000Z"))).toEqual({
      token: "abc",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
  });

  it("efface un jeton expiré ou illisible", () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "abc", expiresAt: "2020-01-01T00:00:00.000Z" });
    expect(readStoredSession(storage, Date.parse("2026-10-17T00:00:00.000Z"))).toBeNull();
    expect(storage.getItem("jk.session")).toBeNull();

    storage.setItem("jk.session", "{");
    expect(readStoredSession(storage, Date.now())).toBeNull();
    expect(storage.getItem("jk.session")).toBeNull();
  });

  it("supprime la session", () => {
    const storage = createMemoryStorage();
    writeStoredSession(storage, { token: "abc", expiresAt: "2099-01-01T00:00:00.000Z" });
    clearStoredSession(storage);
    expect(storage.getItem("jk.session")).toBeNull();
  });
});
