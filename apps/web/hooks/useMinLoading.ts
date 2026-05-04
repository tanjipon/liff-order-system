import { useState, useEffect } from 'react'

export function useMinLoading(minMs = 1500) {
    const [minDone, setMinDone] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setMinDone(true), minMs)
        return () => clearTimeout(timer)
    }, [minMs])

    // dataLoaded: if data recieved from API
    // isLoading: end untill both conditions are fullfilled
    function combine(dataLoaded: boolean): boolean {
        return !dataLoaded || !minDone
    }

    return { combine }
}
