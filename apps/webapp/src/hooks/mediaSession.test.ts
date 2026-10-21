// A Private image can fail before the media cookie exists, and an <img> never
// retries by itself. These pin when the one retry per cookie happens.
type MediaSession = typeof import('./mediaSession')

const MEDIA_SRC = 'https://api.example.com/api/plugins/hypermultimedia/doc/a.png'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function loadModule(): MediaSession {
  let mod: MediaSession | undefined
  jest.isolateModules(() => {
    mod = jest.requireActual<MediaSession>('./mediaSession')
  })
  return mod as MediaSession
}

/** A failed media image that counts how often the retry reloads it. */
function failedImage() {
  const img = document.createElement('img')
  img.setAttribute('src', MEDIA_SRC)
  document.body.append(img)
  let reloads = 0
  Object.defineProperty(img, 'src', {
    get: () => img.getAttribute('src') ?? '',
    set: (value: string) => {
      if (value) reloads += 1
      img.setAttribute('src', value)
    }
  })
  return { fail: () => img.dispatchEvent(new Event('error')), reloads: () => reloads }
}

const answer = (ok: boolean) =>
  jest.fn().mockResolvedValue({ ok, status: ok ? 204 : 500 } as Response)

let stopRetry: () => void = () => {}

beforeEach(() => {
  process.env.NEXT_PUBLIC_RESTAPI_URL = 'https://api.example.com/api'
})

afterEach(() => {
  stopRetry()
  document.body.replaceChildren()
})

describe('retryMediaAfterSession', () => {
  test('an image that fails before any cookie waits, then retries once a POST succeeds', async () => {
    const session = loadModule()
    stopRetry = session.retryMediaAfterSession()
    const image = failedImage()

    image.fail()
    expect(image.reloads()).toBe(0)

    global.fetch = answer(true)
    session.postMediaSession('token-1')
    await flush()
    expect(image.reloads()).toBe(1)
  })

  test('a failed POST spends no retry', async () => {
    const session = loadModule()
    stopRetry = session.retryMediaAfterSession()
    const image = failedImage()

    image.fail()
    global.fetch = answer(false)
    session.postMediaSession('token-1')
    await flush()
    expect(image.reloads()).toBe(0)
    // No cookie exists yet, so an image that fails now must wait too.
    const later = failedImage()
    later.fail()
    expect(later.reloads()).toBe(0)

    global.fetch = answer(true)
    session.postMediaSession('token-2')
    await flush()
    expect(image.reloads()).toBe(1)
  })

  test('an image retries at most once per cookie', async () => {
    const session = loadModule()
    stopRetry = session.retryMediaAfterSession()
    global.fetch = answer(true)
    session.postMediaSession('token-1')
    await flush()
    const image = failedImage()

    image.fail()
    image.fail()
    expect(image.reloads()).toBe(1)

    session.postMediaSession('token-2')
    await flush()
    expect(image.reloads()).toBe(2)
  })
})
