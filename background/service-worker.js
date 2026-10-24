/**
 * FlickWaySurfer — background
 *
 * The toolbar button and the keyboard shortcuts arrive here and go on to the
 * tab. There is no popup: the manifest binds the show/hide shortcut to
 * `_execute_action`, so it arrives as a click on the button. The shortcuts
 * are the ones that matter in full screen, where the toolbar is gone.
 */
function tell(tab, type) {
    if (!tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type }).catch(() => {
        // Not a Flick tab, so there is nothing on it to show, hide or switch.
    });
}

chrome.action.onClicked.addListener((tab) => tell(tab, 'flickwaysurfer:toggle'));

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'next-channel') tell(tab, 'flickwaysurfer:next-channel');
});
