function isAlertPresent(browser) {
    try {
        browser.alertText();
        return true;
    } catch (e) {
        return false;
    }
}

function closeAlertAndGetItsText(browser, acceptNextAlert) {
    try {
        var alertText = browser.alertText() ;
        if (acceptNextAlert) {
            browser.acceptAlert();
        } else {
            browser.dismissAlert();
        }
        return alertText;
    } catch (ignore) {}
}

function isEmptyArray(arr){
    return !(arr && arr.length);
}

function addUrl(baseUrl, url){
    if (endsWith(baseUrl, url))
        return baseUrl;

    if (endsWith(baseUrl,"/") && startsWith(url,"/"))
        return baseUrl.slice(0,-1) + url;

    return baseUrl + url;
}

function endsWith(str,endStr){
    if (!endStr) return false;

    var lastIndex = str && str.lastIndexOf(endStr);
    if (typeof lastIndex === "undefined") return false;

    return str.length === (lastIndex + endStr.length);
}

function startsWith(str,startStr){
    var firstIndex = str && str.indexOf(startStr);
    if (typeof firstIndex === "undefined")
        return false;
    return firstIndex === 0;
}

function waitFor(browser, checkFunc, expression, timeout, pollFreq){
    var val;

    var timeLeft = timeout;

    if (!pollFreq) {
        pollFreq = 200;
    }

    while (!val) {
        val = checkFunc(browser);
        if (val)
            break;
        if (timeLeft < 0) {
            throw new Error('Timed out after ' + timeout + ' msecs waiting for expression: ' + expression);
            break;
        }
        browser.sleep(pollFreq);
        timeLeft -= pollFreq;
    }

    return val;
}

function createFolderPath(path) {
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
 * Focuses the topmost window on the stack of handles in the browser.
 *
 * After a WdSyncClient.browser.close() wd does not automatically restore focus
 * to the previous window on the stack, so you may execute this function to
 * ensure that subsequent tests won't be targeting a defunct window handle.
 *
 * @param  {WdSyncClient.browser} browser Browser instance.
 * @return {void}
 */
function refocusWindow (browser) {
    var handles = browser.windowHandles();
    if (handles.length) {
        try {
            browser.window(handles[handles.length-1]);
        } catch (e) {
            console.warn('Failed to automatically restore focus to most recent window after closing. Error:', e);
        }
    }
}
