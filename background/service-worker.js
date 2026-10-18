/**
 * FlickWaySurfer — background
 *
 * The toolbar button and the keyboard shortcut arrive here as the same event:
 * there is no popup, and the manifest binds the shortcut to `_execute_action`.
 * The shortcut is the one that matters in full screen, where the toolbar is
 * gone.
 */
chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type: 'flickwaysurfer:toggle' }).catch(() => {
        // Not a Flick tab, so there is nothing on it to show or hide.
    });
});
