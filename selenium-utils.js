function getRuntimeOptions (opts) {
    if (typeof opts.lbParam === 'object') {
        options.lbParam = opts.lbParam;
    }

    if (opts.baseUrl && typeof opts.baseUrl === 'string') {
        options.baseUrl = opts.baseUrl;
        if (opts.forceBaseUrl && typeof opts.forceBaseUrl === 'boolean') {
          options.forceBaseUrl = opts.forceBaseUrl;
        }
    }

    if (opts.screenshotFolder && typeof opts.screenshotFolder === 'string') {
        options.screenshotFolder = opts.screenshotFolder;
    }

    if (opts.timeout && isNumber(opts.timeout)) {
        options.timeout = opts.timeout;
    }

    if (opts.retries && isNumber(opts.retries)) {
        options.retries = opts.retries;
    }
}

function isNumber (val) {
    return typeof val === 'number' && !isNaN(val);
}

function isAlertPresent (wdBrowser) {
    if (typeof wdBrowser !== 'object') {
        wdBrowser = browser;
    }

    try {
        wdBrowser.alertText();
        return true;
    } catch (e) {
        return false;
    }
}

function closeAlertAndGetItsText (acceptNextAlert, wdBrowser) {
    if (typeof wdBrowser !== 'object') {
        wdBrowser = browser;
    }

    try {
        var alertText = wdBrowser.alertText() ;
        if (acceptNextAlert) {
            wdBrowser.acceptAlert();
        } else {
            wdBrowser.dismissAlert();
        }
        return alertText;
    } catch (ignore) {}
}

function isEmptyArray (arr) {
    return arr instanceof Array && arr.length === 0;
}

function waitFor (checkFunc, expression, timeout, pollFreq, wdBrowser) {

    if (typeof wdBrowser !== 'object') {
        wdBrowser = browser;
    }
    if (!isNumber(timeout)) {
        timeout = options.timeout;
    }
    if (!isNumber(pollFreq)) {
        pollFreq = 200;
    }

    var val;
    var timeLeft = timeout;

    while (!val) {
        val = checkFunc();

        if (val)
            break;

        if (timeLeft < 0) {
            throw new Error('Timed out after ' + timeout + ' msecs waiting for expression: ' + expression);
        }

        wdBrowser.sleep(pollFreq);
        timeLeft -= pollFreq;
    }

    return val;
}

function createFolderPath (path) {
    var fs = require('fs');
    var folders = path.split(/[/\\]+/);
    path = '';

    while (folders.length) {
        /* This works for both absolute and relative paths, as split on an absolute path will have resulted in an array with the first bit empty. Safe for absolute Windows paths as well: */
        path += folders.shift() + '/';

        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        } else if (!fs.statSync(path).isDirectory()) {
            throw new Error("Cannot create directory '" + path + "'. File of same name already exists.");
        }
    }
}

/**
 * Prefix a (relative) path with a base url.
 *
 * If the path itself is an absolute one including a domain, it'll be returned as-is, unless force is set to true, in
 * which case the existing domain is replaced with the base.
 *
 * When optional arguments are when omitted, values from glocal options object are used.
 *
 * @param  {string} path  The path to prefix with the base url
 * @param  {string} base  (optional) The base url
 * @param  {bool}   force (optional) If true, force prefixing even if path is an absolute url
 * @return {string}       The prefixed url
 */
function addBaseUrl (path, base, force) {
    if (typeof base !== 'string') {
        base = options.baseUrl;
    }

    if (typeof force !== 'boolean') {
        force = options.forceBaseUrl;
    }

    if (path.match(/^http/)) {
        if (force) {
            return path.replace(/^http(s?):\/\/[^/]+/, base).replace(/([^:])\/\/+/g, '$1/');
        }
        return path;
    }
    return (base + '/' + path).replace(/([^:])\/\/+/g, '$1/');
}

/**
 * Focuses the topmost window on the stack of handles in the browser.
 *
 * After a WdSyncClient.browser.close() wd does not automatically restore focus
 * to the previous window on the stack, so you may execute this function to
 * ensure that subsequent tests won't be targeting a defunct window handle.
 *
 * @param  {WdSyncClient.browser} wdBrowser (optional) Browser instance.
 * @return {void}
 */
function refocusWindow (wdBrowser) {
    if (typeof wdBrowser !== 'object') {
        wdBrowser = browser;
    }
    var handles = wdBrowser.windowHandles();
    if (handles.length) {
        try {
            wdBrowser.window(handles[handles.length-1]);
        } catch (e) {
            console.warn('Failed to automatically restore focus to topmost window on browser stack. Error:', e);
        }
    }
}

/**
 * Tries to execute an Error throwing function, and if an error is thrown, one
 * or more retries are attempted until <timeout> msecs have passed.
 *
 * Pauses between retries are increasing in length. The pause before the final
 * retry will be half the total timeout. The pause before the second-to-last
 * will be half of the last one's, and so forth. The first attempt will have the
 * same pause as that of the first retry.
 *
 * Optional arguments use glocal values when omitted
 *
 * @param  {function}             code      The code to execute
 * @param  {WdSyncClient.browser} wdBrowser (optional) Browser instance
 * @param  {number}               retries   (optional) The max number of retries
 * @param  {number}               timeout   (optional) The max number of msecs to keep trying
 * @return {mixed}                Whatever the code block returns
 */
function withRetry (code, wdBrowser, retries, timeout) {
    if (typeof wdBrowser !== 'object') {
        wdBrowser = browser;
    }

    if (!isNumber(retries)) {
        retries = options.retries;
    }

    if (!isNumber(timeout)) {
        timeout = options.timeout;
    }

    var durations = [timeout];
    var err;

    while (retries) {
        durations[0] = Math.ceil(durations[0]/2);
        durations.unshift(durations[0]);
        --retries;
    }

    for (var i = 0; i < durations.length; ++i) {
        try {
            return code();
        } catch (e) {
            err = e;
            wdBrowser.sleep(durations[i]);
        }
    }

    throw(err);
}
