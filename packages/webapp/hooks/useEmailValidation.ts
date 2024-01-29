import { useState, useEffect, useCallback } from 'react'

// TODO: refactor, rename to useEmailValidation
const useEmailValidation = (initialEmail = '') => {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')

  const validateEmail = useCallback((email: string) => {
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

  return { email, setEmail, error, setError }
}

export default useEmailValidation
