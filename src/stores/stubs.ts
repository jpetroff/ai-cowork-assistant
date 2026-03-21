/** Stub store hooks — replaced when real Zustand stores are implemented. */

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

function makeStubHook<S extends object>(state: S) {
  return function useStub<R>(selector: (s: S) => R): R {
    return selector(state)
  }
}

/** @property status - always 'loading' until real store is wired */
export const useProjectStore = makeStubHook({ status: 'loading' as StoreStatus })

/** @property status - always 'loading' until real store is wired */
export const useConversationStore = makeStubHook({ status: 'loading' as StoreStatus })

/** @property status - always 'loading' until real store is wired */
export const useMessageStore = makeStubHook({ status: 'loading' as StoreStatus })

/** @property status - always 'loading' until real store is wired */
export const useArtifactStore = makeStubHook({ status: 'loading' as StoreStatus })

/** @property status - always 'loading' until real store is wired */
export const useAppStore = makeStubHook({ status: 'loading' as StoreStatus })
