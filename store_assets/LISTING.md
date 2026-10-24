# Chrome Web Store listing

Everything the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) asks for, in the order it asks. Copy the text from the blocks below.

## 0. Before you start

- **Developer account:** a one-time US$5 registration fee, paid in the dashboard.
- **2-Step Verification:** must be on for the Google account that publishes.
- **Trader declaration (EU):** a free fan project that earns no money is normally **non-trader**.

## 1. Package

Run `./build.sh` in the repository root, then upload `flickwaysurfer-1.3.0.zip` (**Items → New item**).

For every update, raise `version` in `manifest.json` first. The store rejects a version it has already seen.

## 2. Store listing tab

**Item name** comes from the manifest: `FlickWaySurfer`

**Summary** also comes from the manifest. It's 128 characters, and the limit is 132:

```
Subway Surfers gameplay in a floating window beside your Flick lectures. Resize it, hide it, keep it in full screen. Unofficial.
```

**Description**

```
FlickWaySurfer puts Subway Surfers gameplay in a small floating window beside your Flick lecture: the split-screen trick for keeping your eyes on the lecture.

• Floats over the lecture page, and stays on top when the lecture goes full screen
• In full screen it sits over the lower part of the lecturer's camera, clear of the slides
• Drag the title bar to move it, or drag any edge or corner to resize it
• Hide it with one click, the toolbar button or Alt+Shift+S (⌥⇧S on a Mac). It folds into a small tab at the side of the screen, ready to come back
• Starts muted and loops forever. It pauses whenever it's hidden or you leave the lecture
• Fill or Fit: crop the gameplay to fill the window, or show all of it
• Change the channel like a TV: Subway Surfers, ASMR wax cracking or Minecraft. One click on the TV button (or Alt+Shift+D) flips to the next, and the channel you pick is the one that plays first next time
• Rather watch something else? Paste any YouTube link in the settings and it becomes a channel of its own
• Match the lecture's speed: switch it on in the settings and the gameplay speeds up with your lecture. Watching at 2×? So is Subway Surfers (up to 2×, YouTube's limit)
• Remembers its size and spot, separately for the page and for full screen. Double-click the title bar to put it back where it started

How to use
1. Open a lecture on Flick (flick.docchula.com).
2. The gameplay appears in the corner. Move it, resize it or hide it.
3. Go full screen as usual, and the gameplay comes with you.

Privacy
No account, no analytics, no servers. FlickWaySurfer only stores the window's size, position and visibility, the channel you're on and the video you pasted, on your own computer. Every channel plays in YouTube's embedded player (youtube-nocookie.com).

FlickWaySurfer is an unofficial fan project. It is not affiliated with, endorsed by or connected to Docchula or Flick, to SYBO, the maker of Subway Surfers, or to Mojang or Microsoft, the makers of Minecraft. Subway Surfers is a trademark of SYBO, and Minecraft of Mojang Synergies AB. The gameplay is YouTube videos, played in YouTube's own embedded player.
```

**Category:** Education. Just for Fun also fits, but Education is where students look.

**Language:** English

**Graphic assets** (all in this folder):

| Field | File | Size |
|---|---|---|
| Store icon | `store_icon_128x128.png` | 128×128, 96px artwork with 16px padding |
| Screenshot 1 | `screenshot_1_1280x800.jpg` | The lecture page, with the window in its corner |
| Screenshot 2 | `screenshot_2_1280x800.jpg` | Full screen, with the window over the camera third |
| Screenshot 3 | `screenshot_3_1280x800.jpg` | Split screen, with the window under the lecture |
| Screenshot 4 | `screenshot_4_1280x800.jpg` | Settings: the channels, any YouTube video, and matching the lecture's speed |
| Small promo tile | `small_promo_440x280.jpg` | 440×280 |
| Marquee promo tile | `marquee_promo_1400x560.jpg` | 1400×560 (optional; used if the store features it) |

The lecture in the screenshots is made up ("Physiology I", drawn for the purpose), because Flick's lectures may not be republished.

**Additional fields**

- Official URL: leave as none
- Homepage URL: `https://github.com/Punnawit9285/FlickWaySurfer`
- Support URL: `https://github.com/Punnawit9285/FlickWaySurfer/issues`
- Mature content: **No**

## 3. Privacy practices tab

**Single purpose description**

```
Shows a muted, looping video (Subway Surfers gameplay by default; ASMR wax cracking or Minecraft gameplay, or any YouTube video, if the user switches channel) in a movable, resizable floating window on Flick lecture pages (flick.docchula.com), including while the lecture is in full screen.
```

**Permission justification: storage**

```
Remembers the floating window's size, position, visibility, Fill/Fit choice, the channel the user is on, the YouTube video the user pasted and the speed-matching switch, between visits. Stored locally with chrome.storage.local; nothing is sent anywhere.
```

**Host permission justification** (the content script on `https://flick.docchula.com/*`)

```
The floating window is drawn on Flick lecture pages, so the content script runs on flick.docchula.com and nowhere else. On the page it only checks whether a lecture video player is on screen, where the lecture's picture is and (when the user turns speed matching on) its playback speed, to show, place and pace the window. It reads no lecture content or account data.
```

**Are you using remote code?** No, I am not using remote code.

If asked to explain the YouTube player:

```
The gameplay plays in a standard YouTube embed iframe (youtube-nocookie.com). It runs in its own frame as a web page; no external JavaScript or WebAssembly is loaded into or executed by the extension.
```

**Data usage:** tick **none** of the data types. Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

```
https://github.com/Punnawit9285/FlickWaySurfer/blob/main/PRIVACY.md
```

## 4. Distribution tab

- **Visibility:** Public lists it in search. Unlisted works only for people who have the link, which suits a class-only release.
- **Regions:** All regions.
- **Pricing:** Free.

## 5. Test instructions (for the reviewer)

Flick needs a university login that a reviewer won't have, so explain that up front. Otherwise "can't test it" is a common reason for a rejection.

```
FlickWaySurfer only runs on flick.docchula.com, the recorded-lecture site for Chulalongkorn University medical students. The site needs a university account, so we can't provide test credentials.

What it does there: when a lecture video is on screen, a floating window with a muted, looping YouTube gameplay video appears in the corner. It can be dragged by its title bar, resized from any edge, hidden with the "–" button or Alt+Shift+S, switched to another channel with the TV button or Alt+Shift+D, and it stays on screen when the lecture goes full screen. The screenshots show each of these.
```

A 20-second screen recording of the extension working on Flick (Cmd+Shift+5 on a Mac), shared as an unlisted link, makes this much easier for the reviewer. You can add the link at the end of the instructions above.

## 6. Things a reviewer may question

- **Trademarks:** "Subway Surfers" (SYBO), "Minecraft" (Mojang) and "Flick" (Docchula) appear in the name and description. They are used only to say what the extension shows and where it works, and the description says plainly that it's unofficial. If a reviewer objects, the usual fix is to reword the summary and description, for example to "endless-runner gameplay", without changing the extension.
- **Gameplay in the screenshots:** the screenshots show frames of the YouTube gameplay video. The promo tiles use only drawn artwork.
