function isAlertPresent (browser) {
    try {
        browser.alertText();
        return true;
    } catch (e) {
        return false;
    }
}

function closeAlertAndGetItsText (browser, acceptNextAlert) {
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

function isEmptyArray (arr) {
    return !(arr && arr.length);
}

function addUrl (baseUrl, url) {
    if (endsWith(baseUrl, url))
        return baseUrl;

    if (endsWith(baseUrl,"/") && startsWith(url,"/"))
        return baseUrl.slice(0,-1) + url;

    return baseUrl + url;
}

function endsWith (str,endStr) {
    if (!endStr) return false;

    var lastIndex = str && str.lastIndexOf(endStr);
    if (typeof lastIndex === "undefined") return false;

    return str.length === (lastIndex + endStr.length);
}

function startsWith (str,startStr) {
    var firstIndex = str && str.indexOf(startStr);
    if (typeof firstIndex === "undefined")
        return false;
    return firstIndex === 0;
}

function waitFor (browser, checkFunc, expression, timeout, pollFreq) {
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
        }
        browser.sleep(pollFreq);
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
 * @param  {WdSyncClient.browser} browser Browser instance
 * @param  {function}             code    The code to execute
 * @param  {number}               retries The max number of retries
 * @param  {number}               timeout The max number of msecs to keep trying
 * @return {mixed}                Whatever the code block returns
 */
function withRetry (browser, code, retries, timeout) {
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
      console.warn('A test failed. Will retry (#%d) in %d msecs ...', i+1, durations[i]);
      browser.sleep(durations[i]);
    }
  }

  throw(err);
}
