/**
 * FlickWaySurfer
 * ──────────────
 * Subway Surfers gameplay in a floating window beside a Flick lecture. Drag it
 * by its top bar, resize it from any edge or corner, hide it to a small tab on
 * the side of the screen — and it stays on screen when the lecture goes full
 * screen. The gear on the bar swaps the gameplay for any YouTube video, and
 * back again.
 *
 * ── Why a popover ──
 *
 * The overlay is a manual popover, which puts it in the browser's top layer:
 * above every z-index on the page, Ionic's modals included, and untouched by
 * the transform Ionic puts on <body> (which would otherwise pin a
 * position:fixed overlay to the body instead of the screen).
 *
 * ── Staying usable in full screen ──
 *
 * Flick fullscreens the video.js player element, which then goes into the top
 * layer above the popover. Showing the popover again puts it back on top, but
 * that alone is not enough: while an element is full screen, Chrome ignores
 * the mouse over everything outside it. The window would be drawn over the
 * lecture yet could not be dragged, resized or hidden. So for as long as the
 * lecture is full screen, the overlay moves inside the player element.
 *
 * The move uses moveBefore(), which keeps the YouTube frame playing. An
 * ordinary append reloads an iframe, so the gameplay would restart every time
 * the lecture entered or left full screen. Inside the player, the overlay also
 * keeps its clicks and keys to itself, so the player's own shortcuts (Space,
 * double-click for full screen) never see them.
 *
 * ── Why one frame, made once ──
 *
 * The YouTube frame is created the first time it is needed and is never
 * rebuilt; choosing another video only points it somewhere else. Hiding pauses
 * it and showing resumes it. Commands use the IFrame
 * API's postMessage protocol, the same one Flickémon's music player uses, since
 * MV3 cannot load YouTube's API script.
 */
(function () {
    'use strict';

    const DEFAULT_VIDEO = 'lGlFs6lEcoU';    // "Subway Surfers Gameplay for ADHD Focus"
    const DEFAULT_TITLE = 'Subway Surfers';
    const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
    const PLAYER_ID = 'flickwaysurfer';
    const STORE_KEY = 'flickwaysurfer_v1';
    const HOST_ID = 'flickwaysurfer-host';
    const TOGGLE = 'flickwaysurfer:toggle';

    const RATIO = 16 / 9;
    const EDGE = 12;            // gap kept between the window and the screen edge
    // The title bar sits above the video rather than over it: YouTube draws its
    // own title over the top of the video, and Chrome reports no hover while
    // the mouse is over the frame, so a bar that only appeared on hover would
    // never appear at all.
    const BAR_H = 26;
    const MIN_W = 160;
    const MIN_H = BAR_H + 90;   // sizes are of the whole window, bar included
    // YouTube's smallest player. A window smaller than this shows the frame
    // scaled down rather than laid out small.
    const MIN_FRAME_H = 200;
    const PILL_H = 44;
    const VOLUME = 40;          // when unmuted: under the lecture, not over it

    // fx/fy place the window within the space the viewport has left over: 0 is
    // the left/top edge, 1 the right/bottom. Fractions rather than pixels so a
    // window parked in a corner stays in that corner when the viewport changes
    // size, which it does every time the lecture goes in or out of full screen.
    // Full screen keeps its own size and spot, since what suits a page rarely
    // suits a whole screen.
    const DEFAULTS = {
        visible: true,
        fill: true,
        videoId: null,          // null plays DEFAULT_VIDEO; anything else was chosen in settings
        syncSpeed: false,       // play at the lecture's speed (settings)
        layouts: {
            page: { w: 320, h: 180 + BAR_H, fx: 1, fy: 1 },
            // Null until the window is moved in full screen: until then it is
            // docked to the lecture itself — see dockedLayout().
            fullscreen: null,
        },
    };
    const YT_ENDED = 0;         // player states in the IFrame API's vocabulary
    const YT_PLAYING = 1;
    // The embedded player's speed range. A lecture at 2.5x or 3x gets the
    // fastest the gameplay can go.
    const MIN_RATE = 0.25;
    const MAX_RATE = 2;
    // The IFrame API's onError codes, in words.
    const YT_ERRORS = {
        100: 'This video is private or has been removed.',
        101: "This video can't be played outside YouTube.",
        150: "This video can't be played outside YouTube.",
    };

    const ICON = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    const ICONS = {
        soundOff: ICON('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>'),
        soundOn: ICON('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/>'),
        fill: ICON('<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>'),
        fit: ICON('<path d="M9 4v5H4m11-5v5h5m0 6h-5v5m-6 0v-5H4"/>'),
        hide: ICON('<path d="M5 12h14"/>'),
        settings: ICON('<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="6.4"/>'
            + '<path d="M12 2.8v2.8m0 12.8v2.8M2.8 12h2.8m12.8 0h2.8M5.5 5.5l2 2m9 9 2 2m0-13-2 2m-9 9-2 2"/>'),
        show: ICON('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
    };

    const CSS = `
        :host {
            position: fixed !important;
            inset: 0 !important;
            width: auto !important;
            height: auto !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            background: none !important;
            overflow: visible !important;
            pointer-events: none !important;
            cursor: auto;   /* video.js hides the cursor over an idle player, and the overlay can be inside it */
            color: #fff;
            font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }

        .win {
            position: absolute;
            pointer-events: auto;
            border-radius: 12px;
            background: #000;
            box-shadow: 0 10px 30px rgba(0, 0, 0, .45), 0 0 0 1px rgba(255, 255, 255, .12);
        }
        .bar {
            position: absolute; top: 0; left: 0; right: 0; height: ${BAR_H}px;
            display: flex; align-items: center; gap: 1px; padding: 0 3px 0 10px;
            border-radius: 12px 12px 0 0;
            background: #1c1d24;
            cursor: grab; touch-action: none; user-select: none;
        }
        .win.busy, .win.busy .bar { cursor: grabbing; }
        .title {
            flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
            color: rgba(255, 255, 255, .72);
        }
        .stage {
            position: absolute; top: ${BAR_H}px; left: 0; right: 0; bottom: 0;
            overflow: hidden; border-radius: 0 0 12px 12px;
        }
        iframe { position: absolute; border: 0; transform-origin: 0 0; }

        button {
            appearance: none; border: 0; margin: 0; padding: 0; font: inherit; color: rgba(255, 255, 255, .8);
            flex: none; width: 22px; height: 22px; display: grid; place-items: center;
            border-radius: 6px; background: transparent; cursor: pointer;
        }
        button:hover { background: rgba(255, 255, 255, .14); color: #fff; }
        button:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
        svg {
            width: 15px; height: 15px; fill: none; stroke: currentColor;
            stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
        }

        /* Keeps the pointer away from the iframe mid-drag, which would swallow it. */
        .shield { position: absolute; inset: 0; display: none; }
        .win.busy .shield { display: block; }

        .rz { position: absolute; }
        .rz.n, .rz.s { left: 12px; right: 12px; height: 8px; cursor: ns-resize; }
        .rz.e, .rz.w { top: 12px; bottom: 12px; width: 8px; cursor: ew-resize; }
        .rz.n { top: -4px; }
        .rz.s { bottom: -4px; }
        .rz.e { right: -4px; }
        .rz.w { left: -4px; }
        .rz.ne, .rz.nw, .rz.se, .rz.sw { width: 16px; height: 16px; }
        .rz.ne { top: -4px; right: -4px; cursor: nesw-resize; }
        .rz.sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
        .rz.nw { top: -4px; left: -4px; cursor: nwse-resize; }
        .rz.se { bottom: -4px; right: -4px; cursor: nwse-resize; }

        .pill {
            position: absolute; right: 0; width: 30px; height: ${PILL_H}px;
            pointer-events: auto;
            border-radius: 10px 0 0 10px;
            background: linear-gradient(135deg, #ffc21a, #ff5a1f);
            box-shadow: 0 4px 14px rgba(0, 0, 0, .35);
            color: #fff;
            opacity: .6; transition: opacity .15s ease;
        }
        .pill.left { right: auto; left: 0; border-radius: 0 10px 10px 0; }
        /* Restates the gradient so the generic button:hover tint doesn't replace it. */
        .pill:hover, .pill:focus-visible { opacity: 1; background: linear-gradient(135deg, #ffc21a, #ff5a1f); }
        .pill svg { width: 18px; height: 18px; }

        /* Settings, and the notice for a video that won't play: both cover the video, under the bar. */
        .panel, .notice {
            position: absolute; top: ${BAR_H}px; left: 0; right: 0; bottom: 0; overflow: auto;
            display: flex; flex-direction: column; gap: 7px; padding: 10px 12px;
            border-radius: 0 0 12px 12px; background: rgba(22, 23, 30, .97);
            font-weight: 500; line-height: 1.35;
            /* Chrome won't let a label's click flip its switch while text is selected, and
               the link box opens with its text selected. Nothing else here needs selecting. */
            user-select: none;
        }
        .notice { justify-content: center; align-items: center; text-align: center; }
        .panel input {
            appearance: none; width: 100%; height: 30px; flex: none; padding: 0 9px;
            border: 1px solid rgba(255, 255, 255, .2); border-radius: 7px; outline: none;
            background: rgba(255, 255, 255, .08); color: #fff; font: inherit; user-select: text;
        }
        .panel input::placeholder { color: rgba(255, 255, 255, .45); }
        .panel input:focus { border-color: #ffb21a; }
        .row { display: flex; flex-wrap: wrap; gap: 6px; }
        button.act {
            width: auto; height: 28px; padding: 0 10px; display: inline-flex; align-items: center;
            border-radius: 7px; background: rgba(255, 255, 255, .12); color: #fff; font-weight: 600;
        }
        button.act:hover { background: rgba(255, 255, 255, .22); }
        button.act.primary { background: linear-gradient(135deg, #ffc21a, #ff5a1f); color: #2a1300; }
        .msg { color: rgba(255, 255, 255, .62); font-size: 11.5px; }
        .msg.err { color: #ff9f8f; }
        .panel hr { width: 100%; height: 1px; margin: 2px 0; border: 0; background: rgba(255, 255, 255, .12); flex: none; }
        .switch { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
        .switch input { position: absolute; opacity: 0; pointer-events: none; }
        .switch i {
            position: relative; flex: none; width: 30px; height: 18px; border-radius: 9px;
            background: rgba(255, 255, 255, .22); transition: background .15s ease;
        }
        .switch i::after {
            content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
            border-radius: 50%; background: #fff; transition: transform .15s ease;
        }
        .switch input:checked + i { background: #ff8a1f; }
        .switch input:checked + i::after { transform: translateX(12px); }
        .switch input:focus-visible + i { outline: 2px solid #fff; outline-offset: 2px; }
    `;

    const HTML = `
        <div class="win" hidden>
            <div class="bar">
                <span class="title"></span>
                <button class="sound" type="button"></button>
                <button class="fit" type="button"></button>
                <button class="gear" type="button" title="Choose the video" aria-label="Choose the video">${ICONS.settings}</button>
                <button class="hide" type="button" title="Hide" aria-label="Hide">${ICONS.hide}</button>
            </div>
            <div class="stage"></div>
            <div class="notice" hidden>
                <span class="notice-text"></span>
                <button class="act revert" type="button">Back to Subway Surfers</button>
            </div>
            <form class="panel" hidden>
                <input id="fws-url" type="text" placeholder="Paste a YouTube link" aria-label="YouTube link" spellcheck="false" autocomplete="off">
                <div class="row">
                    <button class="act primary" type="submit">Play this video</button>
                    <button class="act revert" type="button">Back to Subway Surfers</button>
                </div>
                <span class="msg"></span>
                <hr>
                <label class="switch" title="At 2× in Flick, the video plays at 2× too. YouTube's player stops at 2×.">
                    <input class="sync" type="checkbox"><i></i>Match the lecture's speed (up to 2×)
                </label>
            </form>
            <div class="shield"></div>
            ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => `<div class="rz ${d}" data-dir="${d}"></div>`).join('')}
        </div>
        <button class="pill" type="button" title="Show the video" aria-label="Show the video" hidden>${ICONS.show}</button>
    `;

    let state;                   // set from storage in start()
    let host, win, stage, bar, pill, soundBtn, fitBtn, titleEl, panel, urlInput, panelMsg, notice, syncBox;
    let frame = null;
    let videoTitle = null;       // the chosen video's title, once YouTube says what it is
    let videoError = null;       // YouTube's onError code for the current video
    let rateSent = null;         // the speed the frame was last told, or not yet
    let playerState = null;      // the player's last reported state
    let ready = false;
    let handshake = null;
    let playing = null;          // what the frame was last told: true, false, or not yet
    let muted = true;
    let lectureOnScreen = false;
    let gesture = null;
    let poll = null;

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

    const defaultLayout = (name) => DEFAULTS.layouts[name] && { ...DEFAULTS.layouts[name] };

    function normalize(saved) {
        const s = saved && typeof saved === 'object' ? saved : {};
        const layout = (name) => {
            const l = s.layouts && s.layouts[name];
            if (!l || !['w', 'h', 'fx', 'fy'].every((k) => Number.isFinite(l[k]))) return defaultLayout(name);
            return {
                w: Math.max(MIN_W, l.w),
                h: Math.max(MIN_H, l.h),
                fx: clamp(l.fx, 0, 1),
                fy: clamp(l.fy, 0, 1),
            };
        };
        return {
            visible: typeof s.visible === 'boolean' ? s.visible : DEFAULTS.visible,
            fill: typeof s.fill === 'boolean' ? s.fill : DEFAULTS.fill,
            videoId: isVideoId(s.videoId) ? s.videoId : DEFAULTS.videoId,
            syncSpeed: typeof s.syncSpeed === 'boolean' ? s.syncSpeed : DEFAULTS.syncSpeed,
            layouts: { page: layout('page'), fullscreen: layout('fullscreen') },
        };
    }

    const isVideoId = (v) => typeof v === 'string' && /^[\w-]{11}$/.test(v);
    const videoId = () => state.videoId || DEFAULT_VIDEO;

    /**
     * The video ID in anything a student is likely to paste: a watch link,
     * youtu.be, Shorts, live, embed, mobile and music links, or a bare ID.
     */
    function parseVideoId(text) {
        const s = text.trim();
        if (isVideoId(s)) return s;
        let url;
        try {
            url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
        } catch {
            return null;
        }
        const site = url.hostname.replace(/^(www|m|music)\./, '');
        let id = null;
        if (site === 'youtu.be') {
            id = url.pathname.split('/')[1];
        } else if (site === 'youtube.com' || site === 'youtube-nocookie.com') {
            id = url.searchParams.get('v');
            if (!id) {
                const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
                id = m && m[1];
            }
        }
        return isVideoId(id) ? id : null;
    }

    function save() {
        try {
            chrome.storage.local.set({ [STORE_KEY]: state }).catch(() => {});
        } catch {
            // The extension was reloaded under this page; teardown follows on the next poll.
        }
    }

    // ─────────────────────── The overlay ───────────────────────

    function build() {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.popover = 'manual';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>${CSS}</style>${HTML}`;

        win = root.querySelector('.win');
        stage = root.querySelector('.stage');
        bar = root.querySelector('.bar');
        pill = root.querySelector('.pill');
        soundBtn = root.querySelector('.sound');
        fitBtn = root.querySelector('.fit');
        titleEl = root.querySelector('.title');
        panel = root.querySelector('.panel');
        urlInput = root.querySelector('.panel input');
        panelMsg = root.querySelector('.panel .msg');
        notice = root.querySelector('.notice');

        // Clicking the overlay must not take focus from the player, or the
        // next Space or arrow key would go to one of these buttons instead of
        // the lecture. The link box is the exception: it has to take typing.
        win.addEventListener('mousedown', (e) => {
            if (e.target !== urlInput) e.preventDefault();
        });
        pill.addEventListener('mousedown', (e) => e.preventDefault());
        // And nothing done in the overlay reaches the page. In full screen it
        // sits inside the video.js player, which would take a double-click on
        // the bar as "leave full screen".
        for (const type of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mousemove',
            'click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'touchstart', 'touchmove', 'touchend']) {
            root.addEventListener(type, (e) => e.stopPropagation());
        }

        bar.addEventListener('pointerdown', (e) => {
            if (!e.target.closest('button')) startGesture(e, 'move');
        });
        bar.addEventListener('dblclick', (e) => {
            if (!e.target.closest('button')) resetLayout();
        });
        for (const handle of root.querySelectorAll('.rz')) {
            handle.addEventListener('pointerdown', (e) => startGesture(e, handle.dataset.dir));
        }
        win.addEventListener('pointermove', moveGesture);
        win.addEventListener('pointerup', endGesture);
        win.addEventListener('pointercancel', endGesture);

        root.querySelector('.hide').addEventListener('click', () => setVisible(false));
        pill.addEventListener('click', () => setVisible(true));
        soundBtn.addEventListener('click', () => {
            muted = !muted;
            if (muted) command('mute');
            else {
                command('setVolume', [VOLUME]);
                command('unMute');
            }
            drawButtons();
        });
        fitBtn.addEventListener('click', () => {
            state.fill = !state.fill;
            save();
            place();
            drawButtons();
        });

        root.querySelector('.gear').addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
        panel.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = parseVideoId(urlInput.value);
            if (!id) {
                panelMsg.textContent = "That doesn't look like a YouTube video link.";
                panelMsg.classList.add('err');
                return;
            }
            setVideo(id === DEFAULT_VIDEO ? null : id);
            closePanel();
        });
        syncBox = root.querySelector('.sync');
        syncBox.addEventListener('change', () => {
            state.syncSpeed = syncBox.checked;
            save();
            syncRate();
        });
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePanel();
        });
        for (const btn of root.querySelectorAll('.revert')) {
            btn.addEventListener('click', () => {
                setVideo(null);
                closePanel();
            });
        }

        drawButtons();
        drawVideo();
        document.body.append(host);
    }

    // ─────────────────────── Choosing the video ───────────────────────

    function openPanel() {
        urlInput.value = state.videoId ? `https://youtu.be/${state.videoId}` : '';
        panelMsg.classList.remove('err');
        panelMsg.textContent = state.videoId ? 'Playing your video, until you change it.' : 'Playing Subway Surfers, the default.';
        panel.querySelector('.revert').hidden = !state.videoId;
        syncBox.checked = state.syncSpeed;
        panel.hidden = false;
        urlInput.focus();
        urlInput.select();
    }

    function closePanel() {
        panel.hidden = true;
        urlInput.blur();
    }

    /** Plays `id` (null for the default) here, saves it, and every other Flick tab follows. */
    function setVideo(id) {
        if (id === state.videoId) return;
        state.videoId = id;
        save();
        loadVideo();
    }

    /** Points the frame at the current video. */
    function loadVideo() {
        videoTitle = null;
        videoError = null;
        drawVideo();
        if (!frame) return;     // made with the right video when it's first needed
        ready = false;          // a new player, which the frame's load event introduces itself to
        frame.src = embedUrl(videoId());
    }

    /** The bar's title, and the notice over a video YouTube won't play here. */
    function drawVideo() {
        titleEl.textContent = (state.videoId ? (videoTitle || 'YouTube video') : DEFAULT_TITLE)
            + (rateSent && rateSent !== 1 ? ` · ${rateSent}×` : '');
        titleEl.title = titleEl.textContent;
        notice.hidden = videoError === null;
        if (videoError !== null) {
            notice.querySelector('.notice-text').textContent = YT_ERRORS[videoError] || "YouTube couldn't play this video.";
            notice.querySelector('.revert').hidden = !state.videoId;
        }
    }

    function drawButtons() {
        const set = (btn, icon, label) => {
            btn.innerHTML = icon;
            btn.title = label;
            btn.setAttribute('aria-label', label);
        };
        set(soundBtn, muted ? ICONS.soundOff : ICONS.soundOn, muted ? 'Sound on' : 'Mute');
        set(fitBtn, state.fill ? ICONS.fit : ICONS.fill, state.fill ? 'Show the whole video' : 'Fill the window');
    }

    /** Shows what the current state calls for, or nothing when no lecture is on screen. */
    function render() {
        if (!lectureOnScreen) {
            if (host.matches(':popover-open')) host.hidePopover();
        } else {
            win.hidden = !state.visible;
            pill.hidden = state.visible;
            if (state.visible) ensureFrame();
            place();
            if (!host.matches(':popover-open')) host.showPopover();
        }
        syncPlayback();
    }

    function setVisible(visible) {
        if (!visible) closePanel();
        state.visible = visible;
        save();
        render();
    }

    /**
     * Moves the overlay into the fullscreen element and back out to <body>
     * afterwards, then shows it again so it sits above whatever just went into
     * the top layer. See "Staying usable in full screen" at the top.
     */
    function onFullscreenChange() {
        check();
        if (!host.isConnected) return;  // torn down: the extension is gone
        const open = host.matches(':popover-open');
        if (open) host.hidePopover();

        const fs = document.fullscreenElement;
        // A <video> or <iframe> can't display children, so if one of those is
        // what went full screen, the overlay can only stay where it is.
        const parent = fs && !/^(video|audio|iframe|img|canvas|embed|object)$/.test(fs.localName)
            ? fs : document.body;
        if (host.parentNode !== parent) {
            try {
                parent.moveBefore(host, null);
            } catch {
                parent.append(host);    // no moveBefore: works, but restarts the gameplay
            }
        }

        if (lectureOnScreen) {
            host.showPopover();
            place();
        }
    }

    // ─────────────────────── Placement ───────────────────────

    const mode = () => (document.fullscreenElement ? 'fullscreen' : 'page');

    function viewport() {
        const el = document.documentElement;
        return { vw: el.clientWidth || window.innerWidth, vh: el.clientHeight || window.innerHeight };
    }

    /** A window rectangle, in the fractions a layout is stored as. */
    function toLayout(left, top, w, h, vw, vh, prev) {
        const freeX = vw - 2 * EDGE - w;
        const freeY = vh - 2 * EDGE - h;
        return {
            w,
            h,
            // With no room to move along an axis, keep the side it was on.
            fx: freeX > 0 ? clamp((left - EDGE) / freeX, 0, 1) : (prev ? prev.fx : 0),
            fy: freeY > 0 ? clamp((top - EDGE) / freeY, 0, 1) : (prev ? prev.fy : 0),
        };
    }

    /**
     * Where the lecture video's picture actually is on screen: the <video>
     * element fills the screen in full screen, and the picture is letterboxed
     * inside it.
     */
    function lectureRect() {
        const fs = document.fullscreenElement;
        const video = fs && (fs.localName === 'video' ? fs : fs.querySelector('video'));
        if (!video || !video.videoWidth || !video.videoHeight) return null;
        const box = video.getBoundingClientRect();
        const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;
        return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
    }

    /**
     * Full screen's spot until the window is moved there: over the bottom half
     * of the lecture's left third. Flick's recordings put the lecturer's camera
     * at the top of that third and the slides in the other two, so this covers
     * neither the lecturer's face nor the slides, on any screen size.
     */
    function dockedLayout(vw, vh) {
        const r = lectureRect() || { left: 0, top: 0, width: vw, height: vh };
        const w = r.width / 3;
        const h = r.height / 2 - EDGE;
        const bottom = Math.min(r.top + r.height, vh) - EDGE;
        return toLayout(r.left + EDGE, bottom - h, w, h, vw, vh);
    }

    function currentLayout(vw, vh) {
        return state.layouts[mode()] || dockedLayout(vw, vh);
    }

    function place() {
        const { vw, vh } = viewport();
        const L = currentLayout(vw, vh);
        const w = clamp(L.w, MIN_W, vw - 2 * EDGE);
        const h = clamp(L.h, MIN_H, vh - 2 * EDGE);
        const left = EDGE + L.fx * Math.max(0, vw - 2 * EDGE - w);
        const top = EDGE + L.fy * Math.max(0, vh - 2 * EDGE - h);
        win.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
        fitFrame(w, h - BAR_H);

        // Hidden, the window folds into a tab on whichever side it was nearer,
        // at the same height.
        pill.classList.toggle('left', L.fx < 0.5);
        pill.style.top = `${EDGE + L.fy * Math.max(0, vh - 2 * EDGE - PILL_H)}px`;
    }

    /**
     * Sizes the frame to exactly 16:9, so YouTube never letterboxes inside it,
     * then crops it to the space under the title bar (Fill) or fits it inside
     * (Fit) here instead. Below YouTube's minimum size the frame keeps that
     * size and is scaled.
     */
    function fitFrame(w, h) {
        if (!frame) return;
        const byWidth = (w / h > RATIO) === state.fill;
        const dw = byWidth ? w : h * RATIO;
        const dh = dw / RATIO;
        const lh = Math.max(dh, MIN_FRAME_H);
        frame.style.cssText = `left:${(w - dw) / 2}px;top:${(h - dh) / 2}px;`
            + `width:${lh * RATIO}px;height:${lh}px;transform:scale(${dh / lh})`;
    }

    // ─────────────────────── Drag and resize ───────────────────────

    function startGesture(e, kind) {
        if (e.button !== 0) return;
        e.preventDefault();
        const r = win.getBoundingClientRect();
        gesture = { kind, id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height };
        e.currentTarget.setPointerCapture(e.pointerId);
        win.classList.add('busy');
    }

    function moveGesture(e) {
        const g = gesture;
        if (!g || e.pointerId !== g.id) return;
        const { vw, vh } = viewport();
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        let { left, top, w, h } = g;

        if (g.kind === 'move') {
            left = clamp(g.left + dx, EDGE, vw - EDGE - g.w);
            top = clamp(g.top + dy, EDGE, vh - EDGE - g.h);
        } else {
            // Each edge stops at the screen edge and at the minimum size; the
            // opposite edge stays where it is.
            if (g.kind.includes('e')) w = clamp(g.w + dx, MIN_W, vw - EDGE - g.left);
            if (g.kind.includes('w')) {
                w = clamp(g.w - dx, MIN_W, g.left + g.w - EDGE);
                left = g.left + g.w - w;
            }
            if (g.kind.includes('s')) h = clamp(g.h + dy, MIN_H, vh - EDGE - g.top);
            if (g.kind.includes('n')) {
                h = clamp(g.h - dy, MIN_H, g.top + g.h - EDGE);
                top = g.top + g.h - h;
            }
        }

        // Moving it in full screen is what replaces the docked default.
        state.layouts[mode()] = toLayout(left, top, w, h, vw, vh, currentLayout(vw, vh));
        place();
    }

    /** Double-clicking the title bar puts the window back where it started, in this mode. */
    function resetLayout() {
        state.layouts[mode()] = defaultLayout(mode());
        save();
        place();
    }

    function endGesture(e) {
        if (!gesture || e.pointerId !== gesture.id) return;
        gesture = null;
        win.classList.remove('busy');
        save();
    }

    // ─────────────────────── The YouTube frame ───────────────────────

    function embedUrl(id) {
        const params = new URLSearchParams({
            autoplay: '1',
            // Muted so it can start on its own, and so the lecture keeps the sound.
            mute: '1',
            loop: '1',
            // A single video only loops as a one-item playlist of itself.
            playlist: id,
            controls: '0',
            disablekb: '1',
            fs: '0',
            rel: '0',
            iv_load_policy: '3',
            playsinline: '1',
            enablejsapi: '1',
            origin: location.origin,
        });
        return `${EMBED_ORIGIN}/embed/${id}?${params}`;
    }

    function ensureFrame() {
        if (frame) return;
        frame = document.createElement('iframe');
        frame.src = embedUrl(videoId());
        frame.title = 'Video player';
        frame.allow = 'autoplay; encrypted-media';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        // Each load is a new player — another video was chosen, or (without
        // moveBefore) the frame was moved — which has to be introduced to all
        // over again.
        frame.addEventListener('load', () => {
            ready = false;
            playerState = null;
            startHandshake();
        });
        stage.prepend(frame);
    }

    /**
     * The embed says nothing to its parent until the parent posts `listening`
     * on the widget channel, and `load` can fire before the player is
     * listening itself, so knock a few times until it answers.
     */
    function startHandshake() {
        stopHandshake();
        let tries = 0;
        const knock = () => {
            if (ready || !frame || tries++ >= 20) return stopHandshake();
            frame.contentWindow.postMessage(JSON.stringify({
                event: 'listening', id: PLAYER_ID, channel: 'widget',
            }), EMBED_ORIGIN);
        };
        knock();
        handshake = setInterval(knock, 500);
    }

    function stopHandshake() {
        clearInterval(handshake);
        handshake = null;
    }

    function command(func, args = []) {
        if (!ready || !frame || !frame.contentWindow) return;
        frame.contentWindow.postMessage(JSON.stringify({
            event: 'command', func, args, id: PLAYER_ID, channel: 'widget',
        }), EMBED_ORIGIN);
    }

    function onFrameMessage(e) {
        if (!frame || e.source !== frame.contentWindow || e.origin !== EMBED_ORIGIN) return;
        let data;
        try {
            data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        } catch {
            return;
        }
        if (!data) return;

        if (!ready && (data.event === 'onReady' || data.event === 'initialDelivery' || data.event === 'infoDelivery')) {
            ready = true;
            stopHandshake();
            command('addEventListener', ['onStateChange']);
            command('addEventListener', ['onError']);
            // Anything asked of the player before now was dropped; catch it up.
            playing = null;
            syncPlayback();
            rateSent = null;
            syncRate();
            if (!muted) {
                command('setVolume', [VOLUME]);
                command('unMute');
            }
        }

        if (data.event === 'onError') {
            videoError = data.info;
            drawVideo();
        }
        // The chosen video's title, for the bar, once the player knows it.
        const about = data.info && data.info.videoData;
        if (about && about.title && about.video_id === videoId() && about.title !== videoTitle) {
            videoTitle = about.title;
            drawVideo();
        }

        // `loop` restarts the video at the end, but not every embed honours it.
        // If this one stops instead, start it over from here.
        const reported = data.event === 'onStateChange' ? data.info
            : (data.info && typeof data.info.playerState === 'number' ? data.info.playerState : null);
        if (reported === null || reported === playerState) return;
        playerState = reported;
        if (playerState === YT_PLAYING && state.syncSpeed) {
            rateSent = null;    // a restarted or looped video can come back at 1x
            syncRate();
        }
        if (playerState === YT_ENDED && playing) {
            command('seekTo', [0, true]);
            command('playVideo');
        }
    }

    /** Plays while the window is on screen, pauses otherwise. */
    function syncPlayback() {
        const want = lectureOnScreen && state.visible && !document.hidden;
        if (!ready || want === playing) return;
        playing = want;
        command(want ? 'playVideo' : 'pauseVideo');
    }

    /**
     * Plays the video at the lecture's speed when that's switched on in
     * settings, and at 1x when it isn't.
     */
    function syncRate() {
        if (!ready) return;     // sent once the player says hello
        let rate = 1;
        if (state.syncSpeed) {
            const lecture = findLecture();
            const media = lecture && lecture.querySelector('video');
            if (media && media.playbackRate > 0) rate = clamp(media.playbackRate, MIN_RATE, MAX_RATE);
        }
        if (rate === rateSent) return;
        rateSent = rate;
        command('setPlaybackRate', [rate]);
        drawVideo();
    }

    // ─────────────────────── Watching the page ───────────────────────

    /** A lecture is on screen when a video.js player is actually rendered. */
    function findLecture() {
        for (const el of document.querySelectorAll('.video-js')) {
            if (el.getClientRects().length) return el;
        }
        return null;
    }

    function check() {
        // The extension was reloaded or removed: this copy can no longer save
        // or hear the toolbar button, so take the overlay away with it.
        if (!chrome.runtime || !chrome.runtime.id) return teardown();
        syncRate();
        const on = Boolean(findLecture());
        if (on === lectureOnScreen) return;
        lectureOnScreen = on;
        render();
    }

    function teardown() {
        clearInterval(poll);
        stopHandshake();
        lectureOnScreen = false;    // and every listener left behind now does nothing
        host.remove();
    }

    function start(saved) {
        state = normalize(saved);
        build();
        window.addEventListener('message', onFrameMessage);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('resize', () => {
            if (lectureOnScreen) place();
        });
        document.addEventListener('visibilitychange', syncPlayback);
        // Media events don't bubble, but a capturing listener on the document
        // still hears the lecture change speed, the moment it does.
        document.addEventListener('ratechange', syncRate, true);

        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && msg.type === TOGGLE && lectureOnScreen) setVisible(!state.visible);
        });
        // Another Flick tab hid, showed or moved the window, or chose another video.
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[STORE_KEY] || gesture) return;
            const before = videoId();
            state = normalize(changes[STORE_KEY].newValue);
            drawButtons();
            if (videoId() !== before) loadVideo();
            syncBox.checked = state.syncSpeed;
            syncRate();
            if (lectureOnScreen) render();
        });

        check();
        poll = setInterval(check, 1000);
    }

    chrome.storage.local.get(STORE_KEY)
        .then((saved) => start(saved[STORE_KEY]))
        .catch(() => start(null));
})();
