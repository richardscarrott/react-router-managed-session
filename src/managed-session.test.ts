import { describe, it, expect } from "vitest";
import {
  createCookie,
  createCookieSessionStorage,
  isSession,
} from "react-router";
import { createManagedSession } from "./managed-session";

describe(createManagedSession, () => {
  describe("finalizeSession", () => {
    describe("with no existing session", () => {
      [true, false].forEach((rolling) => {
        describe(`and rolling=${rolling}`, () => {
          it("commits session when data is added", async () => {
            const cookie = createCookie("__session", {
              maxAge: 60 * 10,
              secrets: ["s3cret"],
            });
            const sessionStorage = createCookieSessionStorage({ cookie });
            const { session, finalizeSession } = await createManagedSession({
              request: new Request("http://example.com"),
              cookie,
              sessionStorage,
              rolling,
            });
            expect(isSession(session)).toBe(true);
            expect(session.data).toEqual({});
            session.set("key", "value");
            expect(session.data).toEqual({ key: "value" });
            const response = new Response();
            await finalizeSession(response);
            const setCookieHeader = response.headers.getSetCookie();
            expect(setCookieHeader).toHaveLength(1);
            const data = await cookie.parse(setCookieHeader[0]);
            expect(setCookieHeader[0]).toBe(
              "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; Max-Age=600; Path=/; SameSite=Lax"
            );
            expect(data).toEqual({ key: "value" });
          });

          it("does not commit or destroy session when no data is added", async () => {
            const cookie = createCookie("__session", {
              maxAge: 60 * 10,
              secrets: ["s3cret"],
            });
            const sessionStorage = createCookieSessionStorage({ cookie });
            const { session, finalizeSession } = await createManagedSession({
              request: new Request("http://example.com"),
              cookie,
              sessionStorage,
              rolling,
            });
            expect(isSession(session)).toBe(true);
            expect(session.data).toEqual({});
            const response = new Response();
            await finalizeSession(response);
            expect(response.headers.getSetCookie()).toEqual([]);
          });
        });
      });
    });

    describe("with existing session", () => {
      describe("and rolling=false", () => {
        it("commits session when data is modified", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: false,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          session.set("newKey", "newValue");
          expect(session.data).toEqual({ key: "value", newKey: "newValue" });
          const response = new Response();
          await finalizeSession(response);
          const setCookieHeader = response.headers.getSetCookie();
          expect(setCookieHeader).toHaveLength(1);
          const data = await cookie.parse(setCookieHeader[0]);
          expect(setCookieHeader[0]).toBe(
            "__session=eyJrZXkiOiJ2YWx1ZSIsIm5ld0tleSI6Im5ld1ZhbHVlIn0%3D.qeMoljCTMmPphRzvieNwe25eVim81chxyOJuo6tNfyY; Max-Age=600; Path=/; SameSite=Lax"
          );
          expect(data).toEqual({ key: "value", newKey: "newValue" });
        });

        it("does not commit session when no data is modified", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: false,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          const response = new Response();
          await finalizeSession(response);
          expect(response.headers.getSetCookie()).toEqual([]);
        });

        it("destroys session when all data is removed", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: false,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          session.unset("key");
          expect(session.data).toEqual({});
          const response = new Response();
          await finalizeSession(response);
          const setCookieHeader = response.headers.getSetCookie();
          expect(setCookieHeader).toHaveLength(1);
          expect(setCookieHeader[0]).toBe(
            "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
          );
        });
      });

      describe("and rolling=true", () => {
        it("commits session when data is modified", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: true,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          session.set("newKey", "newValue");
          expect(session.data).toEqual({ key: "value", newKey: "newValue" });
          const response = new Response();
          await finalizeSession(response);
          const setCookieHeader = response.headers.getSetCookie();
          expect(setCookieHeader).toHaveLength(1);
          const data = await cookie.parse(setCookieHeader[0]);
          expect(setCookieHeader[0]).toBe(
            "__session=eyJrZXkiOiJ2YWx1ZSIsIm5ld0tleSI6Im5ld1ZhbHVlIn0%3D.qeMoljCTMmPphRzvieNwe25eVim81chxyOJuo6tNfyY; Max-Age=600; Path=/; SameSite=Lax"
          );
          expect(data).toEqual({ key: "value", newKey: "newValue" });
        });

        it("commits session even when no data is modified", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: true,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          const response = new Response();
          await finalizeSession(response);
          const setCookieHeader = response.headers.getSetCookie();
          expect(setCookieHeader).toHaveLength(1);
          expect(setCookieHeader[0]).toBe(
            "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; Max-Age=600; Path=/; SameSite=Lax"
          );
        });

        it("destroys session when all data is removed", async () => {
          const cookie = createCookie("__session", {
            maxAge: 60 * 10,
            secrets: ["s3cret"],
          });
          const sessionStorage = createCookieSessionStorage({ cookie });
          const { session, finalizeSession } = await createManagedSession({
            request: new Request("http://example.com", {
              headers: {
                Cookie:
                  "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
              },
            }),
            cookie,
            sessionStorage,
            rolling: true,
          });
          expect(isSession(session)).toBe(true);
          expect(session.data).toEqual({ key: "value" });
          session.unset("key");
          expect(session.data).toEqual({});
          const response = new Response();
          await finalizeSession(response);
          const setCookieHeader = response.headers.getSetCookie();
          expect(setCookieHeader).toHaveLength(1);
          expect(setCookieHeader[0]).toBe(
            "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax"
          );
        });
      });
    });
  });

  describe("session.destroy", () => {
    it("removes all session data", async () => {
      const cookie = createCookie("__session", { secrets: ["s3cret"] });
      const sessionStorage = createCookieSessionStorage({ cookie });
      const { session } = await createManagedSession({
        request: new Request("http://example.com", {
          headers: {
            Cookie:
              "__session=eyJrZXkiOiJ2YWx1ZSJ9.8ph1p%2BJgL0Hu5k0QDNaI7nI27SurTg%2BEBNC2jnN0RKA; foo=bar",
          },
        }),
        cookie,
        sessionStorage,
      });
      expect(isSession(session)).toBe(true);
      session.set("newKey", "newValue");
      expect(session.data).toEqual({ key: "value", newKey: "newValue" });
      session.destroy();
      expect(session.data).toEqual({});
    });
  });
});
