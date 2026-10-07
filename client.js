/**
 * dsh-page-css — client half.
 *
 * This file runs INSIDE the page, as a module loaded by DSH's client-modules
 * system (`window.__ModuleLoader__.load`). That is the whole point of having a
 * client half here.
 *
 * Why it exists at all
 * --------------------
 * There is a host-side `tapIndex` escape hatch for injecting markup into the
 * served index, and this plugin used it first: raw `<style>` + inline `<script>`
 * appended before `</head>`. The tap ran and logged success — but nothing ever
 * reached the page (no style applied, the script never executed, no CSP and no
 * nonce involved: the index has neither). A module that the client-modules
 * system loads itself has no such problem, and it can touch the DOM directly,
 * so all of the page-side work lives here now.
 *
 * What it does
 * ------------
 *  1. A few host-style corrections the wallpaper plugin cannot express.
 *  2. Keeps the wallpaper's centre on the conversation column's centre by
 *     panning `background-position` (no transform, no scaling).
 *  3. Fills whatever the image does not cover with the image's own background
 *     tone, so a pan or a letterbox can never show a hard edge.
 *  4. Reports what it measured back to the host via /dsh-page-css/probe — the
 *     host cannot inspect the page, so this is the only feedback channel.
 *
 * The wallpaper is painted by `dsh-any-background` as a CSS background on a
 * body-level fixed div:
 *
 *   wpEl.style.cssText = "position:fixed;inset:0;z-index:-1;...";
 *   document.body.prepend(wpEl);
 *   wpEl.style.backgroundImage = <the wallpaper>;
 *   wpEl.style.backgroundSize  = "cover" | "contain" | "<w>x<h>";
 *   wpEl.style.backgroundPosition = "center";
 *
 * So aligning it is an offset on `background-position` — nothing is scaled and
 * no edge is exposed while the offset stays inside the image's own overflow.
 *
 * No backticks and no `${` placeholders in the CSS below.
 */

window.__ModuleLoader__.load({
  id: 'dsh-page-css',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var name = 'page-css'
    var inject = []          // no client services needed; this is DOM work

    var STYLE_ID = 'dsh-page-css'
    var PROBE = '/dsh-page-css/probe'
    var CENTER = '[class*="_centerCol"]'
    var CHIP = '[class*="Rd79tq_"]'      // TurnUsagePanel, build-specific prefix
    var WP_BG = '#393837'                // the wallpaper's own top-edge tone
    var ASPECT = 3200 / 1440             // the served wallpaper's aspect ratio
    var BUILD = 'client-half-2'

    var CSS = `
/* 1. Canvas. The index's boot style hard-codes body{background-color:#fff}
      (with a dark fallback under prefers-color-scheme), so anywhere the shell
      does not paint shows white.

      html takes the dark canvas colour, but body must stay TRANSPARENT rather
      than being painted dark: the wallpaper is a body child with z-index:-1,
      and a non-positioned block's background paints AFTER negative-z-index
      children of the root stacking context — so an opaque body background
      covers the wallpaper and it disappears entirely. */
html { background-color: #0b0d14 !important; }
body { background-color: transparent !important; }

/* 2. Windows app-shell frame, which paints itself with
      --dsw-specific-sidebar-fill and hides the wallpaper. */
html[data-windows-titlebar] [class*="_frame"] { background-color: transparent !important; }

/* 3. Composer-dock usage strip — force it DARK.
      The host palette renders these surfaces light on this setup, and
      schemeOverride=dark only flips the font direction, not surface colours.
      Scoped to body[data-ds-dark-theme] (set by the wallpaper plugin when it
      forces the dark scheme) so a light-scheme setup is left alone. */
body[data-ds-dark-theme] [class*="Rd79tq_"] {
  background-color: rgba(11, 13, 20, 0.86) !important;
  color: #e6e8ee !important;
}

/* Hover / expanded used to paint --dsw-alias-interactive-bg-hover, a solid
   light block. Lift the fill instead of jumping to white. */
body[data-ds-dark-theme] [class*="Rd79tq_"]:hover,
body[data-ds-dark-theme] [class*="Rd79tq_"][aria-expanded="true"] {
  background-color: rgba(26, 30, 42, 0.94) !important;
}

/* 3b. Whatever the host paints BEHIND the chip: its dock row, any wrapper, and
      that row's container inside the composer seat. A chip-only rule leaves a
      bright band behind the chip, because the band is a separate element. */
body[data-ds-dark-theme] [data-composer-seat] > *:has([class*="Rd79tq_"]),
body[data-ds-dark-theme] [data-composer-seat] *:has(> [class*="Rd79tq_"]),
body[data-ds-dark-theme] *:has(> [class*="Rd79tq_"]) {
  background-color: rgba(11, 13, 20, 0.86) !important;
}

/* 3c. The usage popover. Its own rule is
       .<hash>_panel { background: var(--dsw-specific-menu) } — the same light
      host token. */
body[data-ds-dark-theme] [class*="Xt1eiG_"] {
  background-color: rgba(16, 19, 27, 0.96) !important;
}

/* Type metrics stay shared with the composer in both schemes. */
[class*="Rd79tq_"] {
  font-size: var(--dsh-content-font-size, 14px) !important;
  font-family: inherit !important;
  border-radius: var(--dsw-radius-md, 8px) !important;
}
`

    function norm(s) {
      return String(s || '').replace(/\s+/g, '')
    }

    function ensureStyle() {
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')) return null
      var el = document.createElement('style')
      el.setAttribute('data-plugin-css', STYLE_ID)
      el.textContent = CSS
      document.head.appendChild(el)
      return el
    }

    /* The wallpaper element is a body-level fixed div the background plugin
       prepends. It carries no id or class, so match its inline style —
       whitespace-insensitively, since the two sides may serialise differently. */
    function pickWallpaper() {
      var kids = document.body ? document.body.children : null
      if (!kids) return null
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i]
        if (el.tagName !== 'DIV') continue
        var s = norm(el.getAttribute('style'))
        if (s.indexOf('z-index:-1') !== -1 && s.indexOf('position:fixed') !== -1) return el
      }
      return null
    }

    function rectOf(el) {
      var r = el.getBoundingClientRect()
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
    }

    /* Walk up from the usage chip and report each ancestor's class and painted
       background, so the host can see WHICH element draws the band behind the
       chip instead of guessing at selectors. */
    function chipChain(start) {
      var el = start || document.querySelector(CHIP)
      var out = []
      var n = 0
      while (el && n < 8) {
        var cs = null
        try { cs = window.getComputedStyle(el) } catch (e) { cs = null }
        out.push({
          tag: String(el.tagName || '').toLowerCase(),
          cls: String(el.className || '').slice(0, 90),
          bg: cs ? cs.backgroundColor : null,
          box: rectOf(el),
        })
        el = el.parentElement
        n += 1
      }
      return out
    }

    function report(tag) {
      try {
        var vh = document.documentElement.clientHeight
        var col = document.querySelector(CENTER)
        var wp = pickWallpaper()
        var r = col ? col.getBoundingClientRect() : null
        var dock = findDockChip(vh)
        var seat = document.querySelector('[data-composer-seat]')
        var payload = {
          build: BUILD,
          tag: tag,
          href: String(location.href).slice(0, 80),
          hasCol: col !== null,
          hasWp: wp !== null,
          vw: document.documentElement.clientWidth,
          vh: vh,
          colLeft: r ? Math.round(r.left) : null,
          colWidth: r ? Math.round(r.width) : null,
          colCenter: r ? Math.round(r.left + r.width / 2) : null,
          bgPos: wp ? String(wp.style.backgroundPosition || '') : null,
          bgSize: wp ? String(wp.style.backgroundSize || '') : null,
          computedBgSize: wp ? String(window.getComputedStyle(wp).backgroundSize || '') : null,
          bgColor: wp ? String(wp.style.backgroundColor || '') : null,
          /* Where the wallpaper actually ended up, and what the vertical rule
             keyed off — the two numbers that explain an off-screen image. */
          wpBox: wp ? rectOf(wp) : null,
          dockChipFound: dock !== null,
          dockChipBox: dock ? rectOf(dock) : null,
          seatBox: seat ? rectOf(seat) : null,
          chipCount: document.querySelectorAll(CHIP).length,
          bodyKids: document.body ? document.body.children.length : -1,
          chipChain: chipChain(dock),
        }
        fetch(PROBE + '?r=' + encodeURIComponent(JSON.stringify(payload)), { cache: 'no-store' }).catch(function () {})
      } catch (e) { /* a probe must never break the page */ }
    }

    /* The usage chip in the composer DOCK — not the transcript's copy.
       The chip selector matches one live dock chip AND one chip per transcript
       turn. The transcript copies are the common case and can sit tens of
       thousands of pixels away (measured: top = -20324), so a bare
       querySelector picks the wrong element. Require membership of the composer
       seat and an on-screen box. */
    function findDockChip(vh) {
      var list = document.querySelectorAll(CHIP)
      for (var i = 0; i < list.length; i++) {
        var el = list[i]
        if (!el.closest || el.closest('[data-composer-seat]') === null) continue
        var r = el.getBoundingClientRect()
        if (r.width <= 0 || r.top < 0 || r.top > vh) continue
        return el
      }
      return null
    }

    function sync() {
      var wp = pickWallpaper()
      if (!wp) return

      var vw = document.documentElement.clientWidth || window.innerWidth || 0
      var vh = document.documentElement.clientHeight || window.innerHeight || 0
      if (vw <= 0 || vh <= 0) return

      /* Horizontal: the wallpaper's centre follows the conversation column's. */
      var dx = 0
      var col = document.querySelector(CENTER)
      if (col) {
        var r = col.getBoundingClientRect()
        if (r.width > 0) dx = (r.left + r.width / 2) - vw / 2
      }

      /* Vertical reference: the TOP of the usage bar in the composer dock, so
         the artwork ends where the usage bar begins. */
      var refTop = vh
      var chip = findDockChip(vh)
      if (chip) {
        var row = chip
        while (row && row.parentElement && row.parentElement.tagName !== 'BODY') {
          var pe = row.parentElement
          if (pe.getAttribute && pe.getAttribute('data-composer-seat') !== null) break
          row = pe
        }
        refTop = (row || chip).getBoundingClientRect().top
      }
      /* Keep the reference on-screen. wantY is then refTop - bgH, which always
         leaves the image's bottom edge inside the viewport — so the image can
         never be pushed out of sight (the bug that made the wallpaper vanish:
         a transcript chip at top=-20324 gave refTop=0 and wantY=-768). */
      if (!isFinite(refTop)) refTop = vh
      refTop = Math.max(0, Math.min(vh, refTop))

      /* Vertical placement depends on whether the image has vertical slack.
         Resolve the real height rather than string-matching one declaration:
         the host uses a keyword OR explicit pixels (the latter once the
         background editor's zoom is in play). */
      var cs = null
      try { cs = window.getComputedStyle(wp) } catch (e) { cs = null }
      var bgSize = cs ? String(cs.backgroundSize || '') : ''
      var containH = Math.min(vh, vw / ASPECT)
      var bgH
      if (bgSize.indexOf('cover') !== -1) {
        bgH = vh
      } else if (bgSize.indexOf('contain') !== -1) {
        bgH = containH
      } else {
        var nums = bgSize.match(/[0-9.]+/g) || []
        bgH = 0
        if (nums.length >= 2) bgH = parseFloat(nums[1])
        else if (nums.length === 1) bgH = parseFloat(nums[0])
        if (!isFinite(bgH) || bgH <= 0) bgH = containH
      }

      var wantY = bgH >= vh - 1 ? 'center' : Math.round(refTop - bgH) + 'px'

      /* Fill whatever the image does not cover with its own background tone. */
      if (wp.style.backgroundColor !== WP_BG) wp.style.backgroundColor = WP_BG

      var want = 'calc(50% + ' + dx.toFixed(1) + 'px) ' + wantY
      var cur = wp.style.backgroundPosition || ''
      if (norm(cur) === norm(want)) return

      wp.style.backgroundPosition = want
      report('applied')
    }

    function apply(ctx) {
      ensureStyle()
      sync()
      report('boot')

      var poll = window.setInterval(sync, 250)
      var beat = window.setInterval(function () { report('heartbeat') }, 5000)

      ctx.effect(function () {
        return function () {
          window.clearInterval(poll)
          window.clearInterval(beat)
        }
      }, 'dsh-page-css: wallpaper alignment poll')
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = name
    return module.exports
  },
})
