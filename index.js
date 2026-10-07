/**
 * dsh-page-css — host half.
 *
 * All of the page-side work (the style corrections, the wallpaper alignment,
 * the DOM measurement) lives in `client.js`, which the client-modules system
 * loads directly into the page.
 *
 * Why the host half is now this small
 * -----------------------------------
 * It used to inject the CSS and a bridge <script> into the served index through
 * `webServer.tapIndex`. The tap ran and logged success on every index render —
 * but nothing ever arrived in the page: no style applied, the script never
 * executed, and there was no CSP and no nonce involved to blame (the served
 * index has neither; its boot style is a plain inline <style>). The injected
 * block simply never reached the browser.
 *
 * `tapIndex` is documented as the escape hatch for markup no IndexInjection row
 * expresses, and `renderIndex` does apply it — so the mechanism is real, it just
 * did not work here. Rather than keep guessing at it, the page-side work moved
 * to the mechanism DSH provides for exactly this: a client half. That path has
 * no injection step to fail.
 *
 * What remains here is the feedback channel. The host cannot inspect the page,
 * so `client.js` reports what it measured to the route below, which also records
 * it to a log file. Without that, every diagnosis is a guess — which is what
 * this plugin spent a long time doing.
 *
 * How to remove it
 * ----------------
 * `plugin_manager remove_bundle dsh-page-css`, or delete the `page-css` row from
 * the profile's `cordis.patch.yml`.
 */

import { appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'page-css'

/** The web server carrier is the only thing this patch needs. */
export const inject = ['webServer']

const PROBE_PATH = '/dsh-page-css/probe'

/**
 * Diagnostics. Temporary — remove once the appearance work is settled.
 *
 * `client.js` reports on boot, whenever it applies an alignment, and on a 5s
 * heartbeat, so this log shows whether the client half is alive at all.
 */
const LOG_PATH = join(homedir(), '.dsh-page-css.log')
function log(message) {
  try {
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`)
  } catch (e) { /* logging must never break the plugin */ }
}

export function apply(ctx) {
  let lastReport = null
  const probeHits = []

  log('host half apply(): webServer=' + typeof ctx.webServer
    + ' register=' + typeof ctx.webServer?.register)

  ctx.effect(() => {
    try {
      const dispose = ctx.webServer.register({
        kind: 'exact',
        path: PROBE_PATH,
        handler: (req, res) => {
          try {
            const url = new URL(req.url, 'http://127.0.0.1')
            const r = url.searchParams.get('r')
            /* Record WHO asked. A hit carrying ?r= with a browser UA is the
               client half reporting; a UA-less one is our own curl. Without this
               "no report arrived" cannot be told apart from "nothing ever
               reached the route". */
            probeHits.push({
              at: new Date().toISOString(),
              ua: String((req.headers && req.headers['user-agent']) || '(none)').slice(0, 70),
              hasReport: r !== null && r !== '',
            })
            if (probeHits.length > 20) probeHits.shift()
            if (r !== null && r !== '') {
              lastReport = { at: new Date().toISOString(), report: r }
              log('client report received (' + r.length + ' chars)')
            }
          } catch (e) { /* ignore a malformed probe */ }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify({ lastReport, probeHits }))
        },
      })
      log('probe route registered: ' + PROBE_PATH + ' (disposer=' + typeof dispose + ')')
      return dispose
    } catch (e) {
      log('probe route FAILED: ' + (e && e.message ? e.message : String(e)))
      return () => {}
    }
  }, 'dsh-page-css: probe route')
}
