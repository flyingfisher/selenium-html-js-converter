"use strict";

/**
 * UNSUPPORTED EXPERIMENTAL FEATURE: WD user extensions. MAY CHANGE AT ANY TIME!
 * CURRENTLY USES FUNCTIONALITY NOT YET MERGED INTO NODE-WD-SYNC.
 *
 * This file can be imported as user extensions in the Selenium IDE, and as
 * converter extensions in selenium-html-js-converter.
 *
 * Add your Selenium commands for the IDE, and their equivalent WD functions to
 * the Node.js module.exports hash. The converter looks for the Selenese command
 * name when parsing, so don't use Selenese 'doSomething' style, use 'something'
 * instead (see examples below).
 *
 * In this early experimental version, methods exposed via module.exports will
 * be called with the original two Selenese string arguments target and value,
 * plus a wd browser element if target is a locator and the element was found on
 * the page.
 *
 * WD functions are included with the generated js cases.
 *
 * FYI: Example functions here do not attempt support for IE8 and lower.
 *
 * Inspiration:
 *   https://raw.githubusercontent.com/refactoror/SelBlocks/master/user-extensions.js
 *
 */

/* We should be loadable in Node.js as well as the Selenium IDE, so don't assume that neither [module] nor [Selenium] is defined: */
if (typeof module === 'undefined') {
  var module = { exports: {} };
}
if (typeof Selenium === 'undefined') {
  var Selenium = function () {};
}



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



/**
 * Funky hack to do sendKeys-ish typing on a Redactor editor (possibly other
 * contenteditable-based RTEs as well ).
 *
 * @throws   on element not found
 *
 * @version  2016-03-07
 * @since    2016-02-25
 *
 * @note     introduces a 100 msec delay (needed to allow Redactor to react on
 *           and process events)
 *
 * @param    {string}    locator  Element locator
 * @param    {string}    text     The text to put in
 * @return   {function}           doWaitForCondition instance
 */
Selenium.prototype.doTypeRedactor = function (locator, text) {
  var element = this.page().findElement(locator);
  var self = this;
  selenium._typedRedactor = false;

  self.doKeyDown(locator, '\\0');
  self.doKeyUp(locator, '\\0');
  element.innerHTML = 'redactor';
  setTimeout(function () {
    self.doKeyDown(locator, '\\0');
    self.doKeyUp(locator, '\\0');
    element.innerHTML = text;
    setTimeout(function () {
      self.doKeyDown(locator, '\\0');
      self.doKeyUp(locator, '\\0');
      selenium._typedRedactor = true;
    }, 50);
  }, 50);

  return this.doWaitForCondition("selenium._typedRedactor", this.defaultTimeout);
};
/**
 * wd-sync version of the above which will be included with generated tests.
 *
 * @throws   on error bubbles
 *
 * @version  2016-03-04
 * @since    2016-03-04
 *
 * @todo     Figure out why executeAsync doesn't return and get rid of className
 *           hack.
 * @note     Requires wd-sync-raw or pull request
 *           https://github.com/sebv/node-wd-sync/pull/30 to be merged to
 *           vanilla wd-sync.
 * @note     There's something odd going on with .executeAsync in node-wd-sync.
 *           We should be able to use it in a synchronous fashion to pick up
 *           callback return values directly, à la
 *             var a = browser.executeAsync('runAndCallBack()', [args], null);
 *           — we do get a callback function passed, but calling it doesn't
 *           make .executeAsync complete. We simply time out. I may just be
 *           retarded here, but in either case, for now, we hack it like this.
 *
 * @param    {string}    target   Selenese <target> attribute value
 * @param    {string}    value    Selenese <value> attribute value
 * @param    {wd-sync}   element  <target> as wd-sync browser element if
 *                                <target> is a locator and the element exists,
 *                                otherwise null.
 * @return   {void}
 */
module.exports.typeRedactor = function (target, value, element) {
  /* .execute takes just a function body as a string to be eval'ed: */
  var className = browser.execute(functionBody(function () {
    var element = arguments[0];
    var text = arguments[1];
    var callback = arguments[2];
    /* Once done, we tag redactor with a class, so we know when we finished: */
    var className = "seleniumDoTypeRedactor-" + (new Date()).getTime();
    var keyEvent = function (element, event, keyCode) {
        var ev = window.document.createEvent('KeyboardEvent');
        if (ev.initKeyEvent)
            ev.initKeyEvent(event, true, true, window, 0, 0, 0, 0, 0, keyCode);
        else
            ev.initKeyboardEvent(event, true, true, window, 0, 0, 0, 0, 0, keyCode);
        return element.dispatchEvent(ev);
    };
    keyEvent(element, 'keydown', 0);
    keyEvent(element, 'keyup', 0);
    element.textContent = 'redactor';
    setTimeout(function () {
      keyEvent(element, 'keydown', 0);
      keyEvent(element, 'keyup', 0);
      element.textContent = text;
      setTimeout(function () {
        keyEvent(element, 'keydown', 0);
        keyEvent(element, 'keyup', 0);
        element.className += ' ' + className;
      }, 50);
    }, 50);
    return className;
  }), [element.rawElement /* Important! element is mangled by wd-sync; we need the raw wd element */, value]);
  waitFor(function () {
    return browser.hasElementByCssSelector('.' + className);
  }, 'browser.hasElementByCssSelector(".' + className + '") [to mark completion of typeRedactor execution]');
};
