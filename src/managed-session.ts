import type { Cookie, Session, SessionStorage } from "react-router";

export interface ManagedSession<Data, FlashData = Data>
  extends Session<Data, FlashData> {
  readonly destroy: () => void;
}

export type FinalizeSessionFn = (response: Response) => Promise<void>;

export type ManagedSessionResult<Data, FlashData = Data> = {
  readonly session: ManagedSession<Data, FlashData>;
  readonly finalizeSession: FinalizeSessionFn;
};

export interface CreateManagedSessionOptions<Data, FlashData> {
  readonly request: Request;
  readonly sessionStorage: SessionStorage<Data, FlashData>;
  readonly cookie: Cookie; // Unfortunately `SessionStorage` doesn't expose the underlying `Cookie`
  readonly rolling?: boolean;
}

// A "managed" session removes the need to manually commit or destroy the sessions in your
// loaders and actions. It automatically commits the session if it has been modified, or destroys
// it if it has been emptied. It additionally supports optionally rolling the session, preventing
// the session from expiring while the user is active.
// TODO: Can we make this lazy, e.g. `{ getSession, finalizeSession }`
export const createManagedSession = async <Data, FlashData>({
  request,
  cookie,
  sessionStorage,
  rolling = false,
}: CreateManagedSessionOptions<Data, FlashData>): Promise<
  ManagedSessionResult<Data, FlashData>
> => {
  const cookieHeader = request.headers.get("Cookie");
  const isExistingSession = !!(await cookie.parse(cookieHeader));
  const session = await sessionStorage.getSession(cookieHeader);
  const beforeHash = hashSessionData(session.data);
  const finalizeSession = async (response: Response) => {
    const afterHash = hashSessionData(session.data);
    // If the session hasn't changed and we're not rolling an existing session, then it's a noop.
    if (beforeHash === afterHash && !(rolling && isExistingSession)) {
      return;
    }
    // Otherwise we update the session appropriately (i.e. if empty, destroy otherwise commit)
    if (Object.keys(session.data).length === 0) {
      response.headers.append(
        "Set-Cookie",
        await sessionStorage.destroySession(session)
      );
    } else {
      response.headers.append(
        "Set-Cookie",
        await sessionStorage.commitSession(session)
      );
    }
  };
  return {
    finalizeSession,
    session: {
      get id() {
        return session.id;
      },
      get data() {
        return session.data;
      },
      has: session.has.bind(session),
      get: session.get.bind(session),
      set: session.set.bind(session),
      flash: session.flash.bind(session),
      unset: session.unset.bind(session),
      destroy: () => {
        Object.keys(session.data).forEach((key) => {
          session.unset(key as keyof typeof session.data & string);
        });
      },
    },
  };
};

const hashSessionData = (data: any) => JSON.stringify(data);
