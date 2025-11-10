# SSL Certificates

Place your SSL certificates here for HTTPS support.

## Required Files

- `cert.pem` - SSL certificate
- `key.pem` - Private key

## Development (Self-Signed)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem
```

## Production

Use certificates from your provider (Let's Encrypt, CloudFlare, etc.)

## Enable HTTPS

Uncomment the HTTPS server block in `../nginx.conf` after adding certificates.
