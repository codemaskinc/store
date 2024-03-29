import { createStore, storage } from '../../../../dist'
import { sessionSync } from './sessionSync'

const { useStore, actions, reset } = createStore({
    counter: 0,
    user: storage('john'),
    todos: sessionSync<Array<string>>(['give star']),
    c: () => 1,
})

export {
    actions,
    reset,
    useStore,
}
