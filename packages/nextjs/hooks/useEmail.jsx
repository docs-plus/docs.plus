import { useState, useEffect, useCallback } from 'react'

const useEmail = (initialEmail = '') => {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')

  const validateEmail = useCallback((email) => {
    if (email === '') return
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!email) {
      setError('Email is required')
    } else if (!re.test(String(email).toLowerCase())) {
      setError('Email is invalid')
    } else {
      setError('')
    }
  }, [])

  useEffect(() => {
    validateEmail(email)
  }, [email, validateEmail])

  return { email, setEmail, error }
}

export default useEmail