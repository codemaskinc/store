import { createStore } from '@codemaskinc/store'

export const { useStore, reset, getState, actions } = createStore({
    counter: 0,
    message: 'Hello, World!',
    currentTime: new Date(),
    users: [] as Array<string>,
})

export const useCapsMessage = () => {
    const { state } = useStore('message')

    return state.message.toUpperCase()
}

export const fetchUsers = async () => {
    try {
        const res = await fetch('https://randommer.io/Name', {
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: 'type=firstname&number=20',
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
        })
        const data = await res.json()

        return data as Array<string>
    } catch {
        return []
    }
}
