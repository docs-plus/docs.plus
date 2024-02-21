import { useState, useEffect, useCallback } from 'react'

const useEmailValidation = (initialEmail: string = '') => {
  const [email, setEmail] = useState<string>(initialEmail)
  const [error, setError] = useState<string>('')

  const validateEmail = useCallback((email: string) => {
    if (email === '') {
      setError('Email is required')
      return
    }
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!re.test(String(email).toLowerCase())) {
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
