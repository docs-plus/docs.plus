import { describe, expect, test } from 'bun:test'

import { isSafeUrl } from '../../domain/ssrf'

describe('isSafeUrl', () => {
  test('allows public https URLs', () => {
    expect(isSafeUrl('https://example.com/x')).toBe(true)
    expect(isSafeUrl('https://docs.plus')).toBe(true)
  })

  test('allows public http URLs', () => {
    expect(isSafeUrl('http://example.com/x')).toBe(true)
  })

  test('blocks non-http(s) protocols', () => {
    expect(isSafeUrl('ftp://example.com/x')).toBe(false)
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<h1>x</h1>')).toBe(false)
  })

  test('blocks localhost and loopback', () => {
    expect(isSafeUrl('http://localhost')).toBe(false)
    expect(isSafeUrl('http://127.0.0.1')).toBe(false)
    expect(isSafeUrl('http://127.0.0.5')).toBe(false)
    expect(isSafeUrl('http://[::1]')).toBe(false)
  })

  test('blocks RFC 1918 private ranges', () => {
    expect(isSafeUrl('http://10.0.0.1')).toBe(false)
    expect(isSafeUrl('http://192.168.1.1')).toBe(false)
    expect(isSafeUrl('http://172.16.0.1')).toBe(false)
    expect(isSafeUrl('http://172.31.255.255')).toBe(false)
  })

  test('allows 172.x outside the 16–31 private range', () => {
    expect(isSafeUrl('http://172.32.0.1')).toBe(true)
    expect(isSafeUrl('http://172.15.0.1')).toBe(true)
  })

  test('blocks link-local and 0.x', () => {
    expect(isSafeUrl('http://169.254.169.254')).toBe(false) // AWS metadata
    expect(isSafeUrl('http://0.0.0.0')).toBe(false)
  })

  test('blocks .local and .internal TLDs', () => {
    expect(isSafeUrl('http://server.local')).toBe(false)
    expect(isSafeUrl('http://api.internal')).toBe(false)
  })

  test('returns false for unparseable input', () => {
    expect(isSafeUrl('not a url')).toBe(false)
    expect(isSafeUrl('')).toBe(false)
  })

  test('blocks IPv4-mapped IPv6 forms of loopback and metadata', () => {
    expect(isSafeUrl('http://[::ffff:127.0.0.1]')).toBe(false)
    expect(isSafeUrl('http://[::ffff:169.254.169.254]')).toBe(false)
    expect(isSafeUrl('http://[::ffff:10.0.0.1]')).toBe(false)
    expect(isSafeUrl('http://[::ffff:192.168.1.1]')).toBe(false)
  })

  test('blocks IPv6 link-local fe80::/10 and unique-local fc00::/7', () => {
    expect(isSafeUrl('http://[fe80::1]')).toBe(false)
    expect(isSafeUrl('http://[fd00::1]')).toBe(false)
    expect(isSafeUrl('http://[fc00::1]')).toBe(false)
  })

  test('blocks trailing-dot FQDN variants', () => {
    expect(isSafeUrl('http://localhost.')).toBe(false)
    expect(isSafeUrl('http://server.local.')).toBe(false)
    expect(isSafeUrl('http://api.internal.')).toBe(false)
  })

  test('blocks RFC 6598 CGNAT 100.64.0.0/10', () => {
    expect(isSafeUrl('http://100.64.0.1')).toBe(false)
    expect(isSafeUrl('http://100.127.255.255')).toBe(false)
    expect(isSafeUrl('http://100.63.0.1')).toBe(true) // outside the range
    expect(isSafeUrl('http://100.128.0.1')).toBe(true) // outside the range
  })

  test('blocks RFC 2544 benchmarking 198.18.0.0/15', () => {
    expect(isSafeUrl('http://198.18.0.1')).toBe(false)
    expect(isSafeUrl('http://198.19.255.255')).toBe(false)
    expect(isSafeUrl('http://198.17.0.1')).toBe(true) // outside
    expect(isSafeUrl('http://198.20.0.1')).toBe(true) // outside
  })

  test('blocks multicast 224.0.0.0/4 and limited broadcast', () => {
    expect(isSafeUrl('http://224.0.0.1')).toBe(false)
    expect(isSafeUrl('http://239.255.255.255')).toBe(false)
    expect(isSafeUrl('http://255.255.255.255')).toBe(false)
    expect(isSafeUrl('http://223.255.255.255')).toBe(true) // just below multicast
    expect(isSafeUrl('http://240.0.0.1')).toBe(true) // reserved 240/4 — not blocked here
  })

  test('blocks IPv6 multicast ff00::/8 and the unspecified address ::', () => {
    expect(isSafeUrl('http://[ff02::1]')).toBe(false) // all-nodes link-local multicast
    expect(isSafeUrl('http://[ff05::1:3]')).toBe(false) // site-local DHCP servers
    expect(isSafeUrl('http://[ff0e::1]')).toBe(false) // global-scope multicast
    expect(isSafeUrl('http://[::]')).toBe(false) // unspecified address — binds all interfaces
  })
})
