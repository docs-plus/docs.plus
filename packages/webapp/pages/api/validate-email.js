import dns from 'dns'

export default async function handler(req, res) {
  try {
    // Ensure this handler is only being used for POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed') // Send HTTP 405 if method is not POST
      return
    }

    const email = req.body.email
    const regex = /^[\w-]+(\.[\w-]+)*@([a-z\d-]+(\.[a-z\d-]+)*\.[a-z]{2,7})$/i

    if (!regex.test(email)) {
      res.status(400).json({ isValid: false }) // Return HTTP 400 Bad Request if email format is invalid
      return
    }

    const domain = email.split('@')[1]

    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses) {
        res.status(400).json({ isValid: false, err }) // Return HTTP 400 Bad Request if domain could not be resolved
      } else {
        res.status(200).json({ isValid: true }) // Return HTTP 200 OK if validation passed
      }
    })
  } catch (err) {
    res.status(500).send(err.message) // Send HTTP 500 if there's a server error
  }
}
