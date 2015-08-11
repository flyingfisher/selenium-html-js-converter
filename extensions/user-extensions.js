/**
 * Attempts to resize the currently focused window using window.resizeTo().
 *
 * Pass width and height dimensions via the "target" argument. Any non-numerical
 * value is used as separator, so "800 600", "800, 600", or "800 bingo 600" are
 * all valid arguments.
 *
 * NOTE: This won't work on the majority of browsers unless you've previously
 * opened, selected, and focused a popup window (or enabled very lax security
 * settings). This extension was created to translate into webdriver-lingo later
 * on.
 *
 * @param  {string} target Dimensions, as described above.
 * @param  {void}   value  [not used]
 * @return {void}
 */
Selenium.prototype.doSetWindowSize = function (target, value) {
  var dimensions = target.split(/[^0-9]+/);

  this.browserbot.getCurrentWindow().resizeTo(dimensions[0], dimensions[1]);
};