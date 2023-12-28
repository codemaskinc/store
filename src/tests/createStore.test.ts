import { renderHook } from '@testing-library/react'
import { createStore, storage } from '..'

describe('create', () => {
    it('should create store', () => {
        const store = createStore({
            count: 0,
            text: 'test',
        })

        expect(store).toBeDefined()
    })
})

describe('state', () => {
    it('should return store state', () => {
        const { getState } = createStore({
            a: 0,
            b: 'test',
        })

        expect(getState()).toEqual({
            a: 0,
            b: 'test',
        })
    })
})

describe('actions', () => {
    it('should update value in store', () => {
        const { getState, actions } = createStore({
            a: 0,
            b: 'test',
            c: () => 1,
        })

        actions.setA(3)
        actions.setB('hmm')
        actions.setC(jest.fn)
        // todo uncomment when typo fixed
        // actions.setC(() => 2)

        expect(getState().a).toEqual(3)
        expect(getState().b).toEqual('hmm')
    })
})

describe('reset', () => {
    it('should reset whole store', () => {
        const initialState = {
            a: 0,
            b: 'test',
        }
        const { getState, actions, reset } = createStore(initialState)

        actions.setA(3)
        actions.setB('hmm')

        expect(getState()).toEqual({
            a: 3,
            b: 'hmm',
        })

        reset()

        expect(getState()).toEqual(initialState)
    })

    it('should reset part of store', () => {
        const { getState, actions, reset } = createStore({
            a: 0,
            b: 'test',
        })

        actions.setA(3)
        actions.setB('hmm')

        expect(getState()).toEqual({
            a: 3,
            b: 'hmm',
        })

        reset('a')

        expect(getState()).toEqual({
            a: 0,
            b: 'hmm',
        })
    })
})

describe('useStore', () => {
    it('should return state and actions', () => {
        const { useStore } = createStore({
            a: 0,
            b: 'test',
        })

        const { result: { current: { actions, state } } } = renderHook(() => useStore())

        expect(state).toBeDefined()
        expect(state.a).toEqual(0)
        expect(state.b).toEqual('test')
        expect(actions).toBeDefined()
        expect(actions).toHaveProperty('setA')
        expect(actions).toHaveProperty('setB')
    })

    it('should return state and actions from storage', async () => {
        const { actions, getState } = createStore({
            a: storage(0),
            b: storage('test'),
            c: new Promise(resolve => resolve(5)),
        })
        const state = getState()

        expect(state).toBeDefined()
        expect(state.a).toEqual(0)
        expect(state.b).toEqual('test')
        expect(await state.c).toEqual(5)
        expect(actions).toBeDefined()
        expect(actions).toHaveProperty('setA')
        expect(actions).toHaveProperty('setB')
    })
})
