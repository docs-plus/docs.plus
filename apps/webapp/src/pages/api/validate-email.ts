import dns from 'dns'
import { NextApiRequest, NextApiResponse } from 'next'

const isValidEmail = (email: string): boolean => {
  const regex = /^[\w-]+(\.[\w-]+)*@([a-z\d-]+(\.[a-z\d-]+)*\.[a-z]{2,7})$/i
  return regex.test(email)
}

const getDomainFromEmail = (email: string): string => {
  return email.split('@')[1]
}

const resolveMxDns = (domain: string): Promise<dns.MxRecord[]> => {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses) {
        reject(err)
      } else {
        resolve(addresses)
      }
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const email: string = req.body.email
    if (!isValidEmail(email)) {
      res.status(400).json({ isValid: false })
      return
    }

    const domain: string = getDomainFromEmail(email)

    try {
      const addresses = await resolveMxDns(domain)
      res.status(200).json({ isValid: true, addresses })
    } catch (err) {
      res.status(400).json({ isValid: false, err })
    }
  } catch (err) {
    if (err instanceof Error) {
      res.status(500).send(err.message)
    } else {
      res.status(500).send('An unknown error occurred')
    }
  }
}
