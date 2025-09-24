# React Router Managed Session

A session utility for React Router framework mode (formerly Remix) that simplifies session handling in middleware/loaders/actions.

[![npm version](https://img.shields.io/npm/v/react-router-managed-session?style=flat-square)](https://www.npmjs.com/package/react-router-managed-session)
[![license](https://img.shields.io/npm/l/react-router-managed-session?style=flat-square)](https://github.com/richardscarrott/react-router-managed-session/blob/main/LICENSE)

## Features

- 🔄 Automatic session management (no manual commit or destroy in each handler)
- 🤝 Singleton session instance shared across all middleware/loaders/actions
- 🎯 Smart session handling (commits only when data changes, destroys if empty)
- ⏰ Optional rolling sessions to keep users signed in while active
- 🔒 Type-safe (full TypeScript support)
- 🪶 Lightweight (no extra runtime deps)

## Installation

```bash
npm add react-router-managed-session
```

## Usage

### Middleware

[React Router Middleware](https://reactrouter.com/how-to/middleware) is the preferred way to use managed sessions. It's an ideal place to set up the session once and use the same instance everywhere.

#### 1) Enable middleware

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
  },
} satisfies Config;
```

#### 2) Create a context key

```ts
// app/context.ts
import { createContext } from "react-router";
import type { ManagedSession } from "react-router-managed-session";

type SessionData = {
  userId?: string;
};

export const sessionContext = createContext<ManagedSession<SessionData>>();
```

#### 3) Create session middleware

```ts
// app/middleware/session.ts
import { createManagedSession } from "react-router-managed-session";
import {
  createCookie,
  createCookieSessionStorage,
  type MiddlewareFunction,
} from "react-router";
import { sessionContext } from "~/context";

export const sessionMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next
) => {
  // Create session storage (any session storage works)
  const cookie = createCookie("__session", {
    maxAge: 60 * 60 * 24, // 24 hours
    secrets: ["your-secret-key"],
  });
  const sessionStorage = createCookieSessionStorage({ cookie });

  // Create a singleton session for this request
  const { session, finalizeSession } = await createManagedSession({
    request,
    cookie,
    sessionStorage,
    rolling: true, // keep sessions alive for active users (optional)
  });

  // Provide the session to downstream middleware/loaders/actions
  context.set(sessionContext, session);

  // Run downstream and capture the Response
  const response = await next();

  // Automatically commit/destroy the session as needed
  await finalizeSession(response);

  return response;
};
```

Register the middleware on routes (typically near the root so it applies broadly):

```ts
// app/root.tsx (or any route module)
import { sessionMiddleware } from "~/middleware/session";

export const middleware: Route.MiddlewareFunction[] = [sessionMiddleware];
```

#### 4) Use it in loaders/actions (no boilerplate!)

```ts
// app/routes/dashboard.tsx
import { sessionContext } from "~/context";
import { redirect } from "react-router";

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext);
  const userId = session.get("userId");

  if (!userId) {
    throw redirect("/login");
  }

  // If session changed anywhere, middleware will commit it automatically
  return { userId };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = context.get(sessionContext);
  const formData = await request.formData();

  if (formData.get("intent") === "logout") {
    // Clears the session; middleware will destroy it
    session.destroy();
    throw redirect("/login");
  }

  // If session changed anywhere, middleware will commit it automatically
  return { ok: true };
}
```

### Custom App Server

If you prefer not to use middleware, you can still use managed sessions in a custom app server. Below is an example of how you might set it up in Hono.

#### 1) Create a Hono server

```ts
// server.ts
import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { reactRouter } from "remix-hono/handler";
import { createManagedSession } from "react-router-managed-session";
import { createCookie, createCookieSessionStorage } from "react-router";
import build from "./build/server";

const app = new Hono();

// Add the React Router middleware to your Hono server
app.all("*", (c) => {
  // Create session storage (any session storage works)
  const cookie = createCookie("__session", {
    maxAge: 60 * 60 * 24, // 24 hours
    secrets: ["your-secret-key"],
  });
  const sessionStorage = createCookieSessionStorage({ cookie });

  // Create a singleton session for this request
  const { session, finalizeSession } = await createManagedSession({
    request: c.req.raw,
    cookie,
    sessionStorage,
    rolling: true, // keep sessions alive for active users (optional)
  });

  const response = await reactRouter({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext() {
      // Provide the session to downstream loaders/actions
      return { session };
    },
  })(c);

  // Automatically commit/destroy the session as needed
  await finalizeSession(response);

  return response;
});

export const onRequest = handle(server);
```

#### 2) Use it in loaders/actions (no boilerplate!)

```ts
// app/routes/dashboard.tsx
import { sessionContext } from "~/context";
import { redirect } from "react-router";

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.session;
  const userId = session.get("userId");

  if (!userId) {
    throw redirect("/login");
  }

  // If session changed anywhere, middleware will commit it automatically
  return { userId };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = context.session;
  const formData = await request.formData();

  if (formData.get("intent") === "logout") {
    // Clears the session; middleware will destroy it
    session.destroy();
    throw redirect("/login");
  }

  return { ok: true };
}
```

## API

### createManagedSession(options)

Creates a managed session that automatically commits when changed and destroys when empty.

Options:

- request: Request
- sessionStorage: SessionStorage<Data, FlashData>
- cookie: Cookie
- rolling?: boolean (default false) — if true, will refresh the cookie on each request even if data did not change

Returns:

- session: ManagedSession<Data, FlashData>
- finalizeSession: (response: Response) => Promise<void>

### ManagedSession

Extends the React Router `Session` with:

- destroy(): void — clears all keys in the session so it will be destroyed on finalize

## License

MIT

## Contributing

Issues and PRs welcome!
