import { Actions, Dispatch, RemoveReadonly } from '../types'
import { equal, getActionKey, isPromise, isSynchronizer, keyInObject, optionalArray } from '../utils'

export const createStore = <TState extends object>(stateRaw: TState) => {
    type TKey = keyof TState
    const storeKeys = Object.keys(stateRaw) as Array<TKey>
    let isBatching = false
    const batchedKeys = new Set<string>()

    const actions = storeKeys.reduce((acc, key) => {
        if (Object.getOwnPropertyDescriptor(stateRaw, key)?.get !== undefined) {
            return acc
        }

        return {
            ...acc,
            [getActionKey(key)]: (value: Dispatch<TState, TKey>) => {
                if (typeof value === 'function') {
                    const fn = value as (prevState: TState[TKey]) => TState[TKey]
                    const newValue = fn(state[key])

                    if (equal(state[key], newValue)) {
                        return
                    }

                    state[key] = newValue
                    notifyUpdates(key)

                    return
                }

                if (equal(state[key], value)) {
                    return
                }

                state[key] = value
                notifyUpdates(key)
            },
        }
    }, {} as Actions<RemoveReadonly<TState>>)

    // @ts-expect-error - TS doesn't know that all keys are in actions object
    const getAction = <K extends TKey>(key: K) => actions[getActionKey(key)] as (value: unknown) => void

    const listeners = storeKeys.reduce((acc, key) => ({
        ...acc,
        [key]: [],
    }), {} as Record<string, Array<(newState: unknown) => void>>)

    const notifyUpdates = (keyToNotify: TKey) => {
        Object.entries(listeners).forEach(([compositeKey, listenersArray]) => {
            if (compositeKey.split('\0').every(key => key !== keyToNotify)) {
                return
            }

            if (isBatching) {
                return batchedKeys.add(compositeKey)
            }

            listenersArray.forEach(listener => listener(state[compositeKey as TKey]))
        })
    }

    const batchUpdates = (callback: VoidFunction) => {
        try {
            isBatching = true
            callback()
        } finally {
            batchedKeys.forEach(key => {
                listeners[key]?.forEach(listener => listener(state[key as TKey]))
            })
            isBatching = false
            batchedKeys.clear()
        }
    }

    const state = Object.entries(stateRaw).reduce((acc, [key, value]) => {
        if (Object.getOwnPropertyDescriptor(stateRaw, key)?.get !== undefined) {
            return acc
        }

        if (typeof value === 'function') {
            throw new Error('Function cannot be passed as top level state value')
        }

        if (isSynchronizer(value)) {
            try {
                const snapshotValue = value.getSnapshot(key)

                if (isPromise(snapshotValue)) {
                    snapshotValue.then(snapshotValue => {
                        if (snapshotValue !== undefined && snapshotValue !== null) {
                            getAction(key as TKey)(snapshotValue)

                            return
                        }

                        value.update(value.value, key)
                    }).catch()

                    // Return initial value
                    return {
                        ...acc,
                        [key]: value.value,
                    }
                }

                return {
                    ...acc,
                    [key]: snapshotValue,
                }
            } catch {
                // If getSnapshot throws, return initial value and set it in storage
                value.update(value.value, key)

                return {
                    ...acc,
                    [key]: value.value,
                }
            } finally {
                listeners[key]?.push(newValue => value.update(newValue, key))
                value.subscribe?.(getAction(key as TKey), key)
            }
        }

        return {
            ...acc,
            [key]: value,
        }
    }, {} as TState)

    const subscribe = (keys: Array<TKey>) => (listener: VoidFunction) => {
        const compositeKey = keys.join('\0')
        listeners[compositeKey] ??= []
        listeners[compositeKey]?.push(listener)

        return () => {
            listeners[compositeKey] = listeners[compositeKey]?.filter(l => l !== listener) ?? []
        }
    }

    storeKeys.forEach(key => {
        if (Object.getOwnPropertyDescriptor(stateRaw, key)?.get === undefined) {
            return
        }

        const dependencies = new Set<TKey>()
        const proxiedState = new Proxy(state, {
            get: (target, dependencyKey, receiver) => {
                if (!keyInObject(dependencyKey, target)) {
                    return undefined
                }

                dependencies.add(dependencyKey)

                return Reflect.get(target, dependencyKey, receiver)
            },
        })

        state[key] = Object.getOwnPropertyDescriptor(stateRaw, key)?.get?.call(proxiedState)

        subscribe(Array.from(dependencies))(() => {
            const newValue = Object.getOwnPropertyDescriptor(stateRaw, key)?.get?.call(state) as TState[TKey]

            state[key] = newValue
            notifyUpdates(key)
        })
    })

    const reset = (...keys: Array<keyof RemoveReadonly<TState>>) => {
        optionalArray(keys, storeKeys).forEach(key => {
            const valueOrSynchronizer = stateRaw[key]
            const initialValue = isSynchronizer(valueOrSynchronizer) ? valueOrSynchronizer.value : valueOrSynchronizer

            getAction(key)?.(initialValue)
        })
    }

    const effect = (run: (state: TState) => void) => {
        const keysToListen = new Set<TKey>()

        run(
            new Proxy(state, {
                get: (target, key) => {
                    if (storeKeys.includes(key as TKey)) {
                        keysToListen.add(key as TKey)
                    }

                    if (keyInObject(key, target)) {
                        return target[key]
                    }

                    return undefined
                },
            }),
        )

        return subscribe(keysToListen.size === 0 ? storeKeys : Array.from(keysToListen))(() => run(state))
    }

    return {
        /**
         * Function that returns current state of the store
         * @see {@link https://codemask-labs.github.io/stan-js/reference/createstore#getState}
         */
        getState: () => state,
        /**
         * Object that contains all functions that allows for updating the store's state
         * @see {@link https://codemask-labs.github.io/stan-js/reference/createstore/#actions}
         */
        actions,
        /**
         * Function that resets store state to the initial values
         * @param keys - keys of the store that should be reset
         * @see {@link https://codemask-labs.github.io/stan-js/reference/createstore#reset}
         */
        reset,
        /**
         * Function that allows to subscribe to store's values change and react to them by calling the listener callback
         * @param run - callback that will be called when store's values change
         * @see {@link https://codemask-labs.github.io/stan-js/reference/createstore#effect}
         */
        effect,
        /**
         * Function that returns a function that allows to listen to store's values change
         * @param keys - keys of the store that should be listened to
         * @returns Function that allows for listening to store's values change
         */
        subscribe,
        /**
         * Function that allows to batch updates to the store's state
         * @param callback - callback that will be called after all updates are batched
         * @see {@link https://codemask-labs.github.io/stan-js/reference/createstore#batchUpdates}
         */
        batchUpdates,
    }
}
