import { describe, expect, it } from 'bun:test'

import { getSpecialUrlInfo } from '../specialUrls'

/**
 * Pins the catalog in `specialUrls.ts`. The mapping powers the
 * special-scheme branch of the autolinker and the per-app classification
 * in popovers — silent regressions (renamed type, dropped scheme,
 * swapped category) cause the wrong label or icon to render in the
 * consumer's create + preview popovers.
 *
 * Data-driven so every row in the catalog is one assertion in the report.
 */

type Case = {
  url: string
  expected: { type: string; title: string; category: string }
}

const SCHEME_CASES: Case[] = [
  // Communication
  {
    url: 'mailto:user@example.com',
    expected: { type: 'email', title: 'Email', category: 'communication' }
  },
  {
    url: 'tel:+1234567890',
    expected: { type: 'phone', title: 'Phone', category: 'communication' }
  },
  {
    url: 'telprompt:+1234567890',
    expected: { type: 'phone', title: 'Phone', category: 'communication' }
  },
  {
    url: 'sms:+1234567890',
    expected: { type: 'sms', title: 'SMS', category: 'communication' }
  },
  {
    url: 'facetime:user@example.com',
    expected: { type: 'facetime', title: 'FaceTime', category: 'communication' }
  },
  {
    url: 'facetime-audio:user@example.com',
    expected: {
      type: 'facetime-audio',
      title: 'FaceTime Audio',
      category: 'communication'
    }
  },
  // Messaging apps
  {
    url: 'whatsapp://send?text=hello',
    expected: { type: 'whatsapp', title: 'WhatsApp', category: 'social' }
  },
  {
    url: 'tg://msg?to=foo',
    expected: { type: 'telegram', title: 'Telegram', category: 'social' }
  },
  {
    url: 'discord://channels/@me',
    expected: { type: 'discord', title: 'Discord', category: 'social' }
  },
  {
    url: 'skype:echo123?call',
    expected: { type: 'skype', title: 'Skype', category: 'social' }
  },
  {
    url: 'slack://open',
    expected: { type: 'slack', title: 'Slack', category: 'social' }
  },
  // Social networks
  {
    url: 'twitter://user?screen_name=foo',
    expected: { type: 'twitter', title: 'Twitter', category: 'social' }
  },
  {
    url: 'fb://profile/12345',
    expected: { type: 'facebook', title: 'Facebook', category: 'social' }
  },
  {
    url: 'instagram://user?username=foo',
    expected: { type: 'instagram', title: 'Instagram', category: 'social' }
  },
  {
    url: 'linkedin://in/foo',
    expected: { type: 'linkedin', title: 'LinkedIn', category: 'social' }
  },
  {
    url: 'snapchat://add/foo',
    expected: { type: 'snapchat', title: 'Snapchat', category: 'social' }
  },
  {
    url: 'reddit://reddit.com/r/foo',
    expected: { type: 'reddit', title: 'Reddit', category: 'social' }
  },
  {
    url: 'tiktok://user/@foo',
    expected: { type: 'tiktok', title: 'TikTok', category: 'social' }
  },
  // Video conferencing
  {
    url: 'zoommtg://zoom.us/join?confno=123',
    expected: { type: 'zoom', title: 'Zoom Meeting', category: 'communication' }
  },
  {
    url: 'zoomus://zoom.us/join?confno=123',
    expected: { type: 'zoom', title: 'Zoom', category: 'communication' }
  },
  {
    url: 'msteams://teams.microsoft.com/l/chat/0/0',
    expected: {
      type: 'teams',
      title: 'Microsoft Teams',
      category: 'communication'
    }
  },
  {
    url: 'webex://meet.example.com',
    expected: { type: 'webex', title: 'Cisco Webex', category: 'communication' }
  },
  // Apple
  {
    url: 'calshow:739771200',
    expected: { type: 'calendar', title: 'Calendar', category: 'apple' }
  },
  {
    url: 'x-apple-calevent:abc123',
    expected: { type: 'calendar', title: 'Calendar Event', category: 'apple' }
  },
  {
    url: 'contacts://show?id=42',
    expected: { type: 'contacts', title: 'Contacts', category: 'apple' }
  },
  {
    url: 'maps://?q=Cupertino',
    expected: { type: 'maps', title: 'Maps', category: 'apple' }
  },
  {
    url: 'map://?q=Cupertino',
    expected: { type: 'maps', title: 'Maps', category: 'apple' }
  },
  {
    url: 'music://album/1234',
    expected: { type: 'music', title: 'Apple Music', category: 'apple' }
  },
  {
    url: 'videos://show/1234',
    expected: { type: 'apple-tv', title: 'Apple TV', category: 'apple' }
  },
  {
    url: 'mobilenotes://showNote?identifier=foo',
    expected: { type: 'notes', title: 'Notes', category: 'apple' }
  },
  {
    url: 'x-apple-reminder://uuid',
    expected: { type: 'reminders', title: 'Reminders', category: 'apple' }
  },
  {
    url: 'photos-redirect://album/foo',
    expected: { type: 'photos', title: 'Photos', category: 'apple' }
  },
  {
    url: 'shortcuts://run-shortcut?name=foo',
    expected: { type: 'shortcuts', title: 'Shortcuts', category: 'apple' }
  },
  {
    url: 'itms-apps://itunes.apple.com/app/id1234',
    expected: { type: 'app-store', title: 'App Store', category: 'apple' }
  },
  // Dev / productivity
  {
    url: 'github://repo/owner/name',
    expected: { type: 'github', title: 'GitHub', category: 'development' }
  },
  {
    url: 'gitlab://project/foo',
    expected: { type: 'gitlab', title: 'GitLab', category: 'development' }
  },
  {
    url: 'vscode://file/Users/foo/bar.ts',
    expected: { type: 'vscode', title: 'VS Code', category: 'development' }
  },
  {
    url: 'notion://page/abc123',
    expected: { type: 'notion', title: 'Notion', category: 'productivity' }
  },
  {
    url: 'obsidian://open?vault=foo',
    expected: { type: 'obsidian', title: 'Obsidian', category: 'productivity' }
  },
  {
    url: 'figma://file/abc123',
    expected: { type: 'figma', title: 'Figma', category: 'development' }
  },
  // Entertainment
  {
    url: 'youtube://watch?v=abc',
    expected: { type: 'youtube', title: 'YouTube', category: 'entertainment' }
  },
  {
    url: 'spotify://track/abc',
    expected: { type: 'spotify', title: 'Spotify', category: 'entertainment' }
  },
  {
    url: 'netflix://title/12345',
    expected: { type: 'netflix', title: 'Netflix', category: 'entertainment' }
  },
  {
    url: 'twitch://stream/foo',
    expected: { type: 'twitch', title: 'Twitch', category: 'entertainment' }
  },
  // Shopping / other
  {
    url: 'amazon://product/B0XXXXXXXX',
    expected: { type: 'amazon', title: 'Amazon', category: 'shopping' }
  },
  {
    url: 'uber://ride',
    expected: { type: 'uber', title: 'Uber', category: 'other' }
  },
  {
    url: 'lyft://ride',
    expected: { type: 'lyft', title: 'Lyft', category: 'other' }
  }
]

const DOMAIN_CASES: Case[] = [
  {
    url: 'https://wa.me/15551234567',
    expected: { type: 'whatsapp', title: 'WhatsApp', category: 'social' }
  },
  {
    url: 'https://t.me/durov',
    expected: { type: 'telegram', title: 'Telegram', category: 'social' }
  },
  {
    url: 'https://discord.gg/abc123',
    expected: { type: 'discord', title: 'Discord Invite', category: 'social' }
  },
  {
    url: 'https://zoom.us/j/123',
    expected: { type: 'zoom', title: 'Zoom Meeting', category: 'communication' }
  },
  {
    url: 'https://meet.google.com/abc-defg-hij',
    expected: { type: 'meet', title: 'Google Meet', category: 'communication' }
  },
  {
    url: 'https://teams.microsoft.com/l/chat',
    expected: { type: 'teams', title: 'Microsoft Teams', category: 'communication' }
  },
  {
    url: 'https://github.com/docs-plus/docs.plus',
    expected: { type: 'github', title: 'GitHub', category: 'development' }
  },
  {
    url: 'https://gitlab.com/gitlab-org/gitlab',
    expected: { type: 'gitlab', title: 'GitLab', category: 'development' }
  },
  {
    url: 'https://figma.com/file/abc',
    expected: { type: 'figma', title: 'Figma', category: 'development' }
  },
  {
    url: 'https://notion.so/abc',
    expected: { type: 'notion', title: 'Notion', category: 'productivity' }
  },
  {
    url: 'https://twitter.com/elonmusk',
    expected: { type: 'twitter', title: 'Twitter', category: 'social' }
  },
  {
    url: 'https://x.com/elonmusk',
    expected: { type: 'twitter', title: 'X (Twitter)', category: 'social' }
  },
  {
    url: 'https://instagram.com/cristiano',
    expected: { type: 'instagram', title: 'Instagram', category: 'social' }
  },
  {
    url: 'https://linkedin.com/in/foo',
    expected: { type: 'linkedin', title: 'LinkedIn', category: 'social' }
  },
  {
    url: 'https://youtube.com/watch?v=abc',
    expected: { type: 'youtube', title: 'YouTube', category: 'entertainment' }
  },
  {
    url: 'https://spotify.com/track/abc',
    expected: { type: 'spotify', title: 'Spotify', category: 'entertainment' }
  }
]

describe('getSpecialUrlInfo', () => {
  describe('scheme catalog', () => {
    for (const { url, expected } of SCHEME_CASES) {
      it(`recognizes ${url}`, () => {
        expect(getSpecialUrlInfo(url)).toEqual(expected)
      })
    }
  })

  describe('domain catalog', () => {
    for (const { url, expected } of DOMAIN_CASES) {
      it(`recognizes ${url}`, () => {
        expect(getSpecialUrlInfo(url)).toEqual(expected)
      })
    }
  })

  describe('matching is case-insensitive on the scheme', () => {
    // Scheme detection lowercases the input before comparison so users
    // who type `MAILTO:` or `WhatsApp://` still get the right entry.
    it('accepts uppercase mailto', () => {
      expect(getSpecialUrlInfo('MAILTO:foo@example.com')?.type).toBe('email')
    })

    it('accepts mixed-case whatsapp scheme', () => {
      expect(getSpecialUrlInfo('WhatsApp://send?text=hi')?.type).toBe('whatsapp')
    })
  })

  describe('domain matching strips www and matches subdomains', () => {
    it('strips leading www.', () => {
      expect(getSpecialUrlInfo('https://www.github.com/foo')?.type).toBe('github')
    })

    it('matches subdomains (api.github.com → github.com)', () => {
      expect(getSpecialUrlInfo('https://api.github.com/users/octocat')?.type).toBe('github')
    })

    it('lowercases the hostname before lookup', () => {
      expect(getSpecialUrlInfo('https://GitHub.com/docs-plus')?.type).toBe('github')
    })
  })

  describe('returns null for non-special inputs', () => {
    it('plain web URL', () => {
      expect(getSpecialUrlInfo('https://example.com')).toBeNull()
    })

    it('unrecognized scheme', () => {
      expect(getSpecialUrlInfo('xyz://foo/bar')).toBeNull()
    })

    it('garbage input does not throw', () => {
      // The internal `new URL()` throws for non-URL strings — the helper
      // must swallow that and fall through to a `null` return.
      expect(getSpecialUrlInfo('not a url at all')).toBeNull()
    })
  })
})
