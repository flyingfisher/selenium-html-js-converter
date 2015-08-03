# selenium-html-js-converter

A small tools to convert 'selenium-IDE' HTML test cases into javascript test cases with [wd-sync](https://github.com/sebv/node-wd-sync).

## Install

```sh
$ npm install selenium-html-js-converter
```

## Usage

```js
var converter = require("selenium-html-js-converter");

converter.convertHtmlFileToJsFile(YourHtmlFile, OutJsFile[, options]);
```

Before you run the javascript, you need to install [wd-sync](https://github.com/sebv/node-wd-sync), which is used in the test case.

```sh
    $ npm install wd-sync
```

### To run the javascript

```js
var wdSync = require('wd-sync');

var client  = wdSync.remote('127.0.0.1', 8910); // phantomjs default wd port
var browser = client.browser;
var sync    = client.sync;

var test1 = require('./OutJsFile');

sync(function(){
    browser.init({ browserName: 'phantomjs' });
    test1(browser);
    browser.quit();
});
```

Refer to [wd-sync API](https://github.com/sebv/node-wd-sync/blob/master/doc/jsonwire-full-mapping.md).

If you want to run the javascript example above successfully, you should start a [phantomjs](http://phantomjs.org) webdriver server in another process.

```sh
$ phantomjs --wd
```

## API Usage

```js
convertHtmlFileToJsFile(filePath, filePath[, options]) => void;
convertHtmlStrToJsFile(htmlStr, filePath[, options])   => void;
convertHtmlFileToJsStr(filePath[, options])            => string;
convertHtmlStrToJsStr(htmlStr[, options])              => string;
convertHtmlSuiteFileToJsFiles(htmlFile[, options])     => void;
```

### Options

The options argument is optional, and for backwards compatibility, it may be a string. When it is a string, it sets `options.outputFolder` for `convertHtmlSuiteFileToJsFiles()` and `options.testCaseName` for all other methods.

The argument is an object hash and may contain the following properties:

#### General options

##### timeout

Sets the default timeout for waits and retries, in msecs. The default is 30,000 msecs.

##### retries

Sets the number of retries that should be attempted when a test fails. This may help prevent false negatives.

When set, the wait between retries is calculated to fit within the `timeout` period, while increasing the wait period between retries after each failed attempt. The calculation is simple: Before the last allowed retry, there will be a wait period of `timeout/2` msecs. Before the second-to-last allowed retry, there's a wait of half of that. This halving of continues up until the first retry. The wait after the very first try is the same as the wait after the first retry. In other words, given a timeout of 1,000 msecs and a maximum of five retries, you will get pauses of `[ 32, 32, 63, 125, 250, 500 ]` msecs after each failed attempt, after which the test ultimately fails.

Note that the way retrying is implemented is to wrap each test in an outer function, so it will result in slightly uglier code, e.g. this test without retrying:

```js
assert.strictEqual(!!browser.hasElementByCssSelector("[name=some-name]"), true, 'Assertion error: Expected: true, got: ' + browser.hasElementByCssSelector("[name=some-name]") + " [ Command: assertElementPresent | css=[name=some-name] ]");
```

becomes, when enabling retries:

```js
retry(browser, function () {
    assert.strictEqual(!!browser.hasElementByCssSelector("[name=some-name]"), true, 'Assertion error: Expected: true, got: ' + browser.hasElementByCssSelector("[name=some-name]") + " [ Command: assertElementPresent | css=[name=some-name] ]");
}, options.retries, options.timeout);
```

#### convertHtml(File|Str)ToJs(File|Str) options

##### testCaseName

If omitted, the test case name defaults to "UntitledTest" when converting string-to-string. When converting to files, the default is to construct the name based on the target file name.

If provided, the test case name is used to place any screenshots that may be taken during a test case. Screenshots are saved as `./screenshots/<testCaseName>/<fileName as specified in the HTML test case or an incrementing number>.png`.

Paths from the screenshot file name in the HTML test case itself are stripped, but you can include paths in the testCaseName if you want your screenshots ordered in folders, e.g.

```js
convertHtmlFileToJsFile('test.html', 'test.js', 'backend/user management/adding and deleting');
```

This example will put screenshots in `./screenshots/backend/user management/adding and deleting/`. Any folders missing in the path will be automatically created when you run your test (see [Run-time options](#screenshotfolder) on how to override this when running the tests).

Note that kwArgs aren't supported by wd in screenshots (see [Selenium reference docs](http://release.seleniumhq.org/selenium-core/1.0.1/reference.html)) so they will be ignored.

#### convertHtmlSuiteFileToJsFiles options

##### outputFolder

Suite file conversion puts each converted file in the specified output folder. Any missing folders in the output path will be created. For test cases that exist in subfolders relative to the suite file, the subfolders are appended to the corresponding js file's target path. If you do not specify an output folder, js files will be created next to each of the source html test case files.

### Run-time options

You may redefine some defaults and override some test settings at run-time by defining them via properties in the second, and optional, options argument hash when executing a test case.

#### screenshotFolder

The screenshot folder can be changed at runtime by passing it to the test function, e.g. using the example from before:

```js
sync(function(){
    browser.init({ browserName: 'phantomjs' });
    test1(browser, {
        screenshotFolder: 'screenshots/firefox/backend/user management/adding and deleting'
    });
    browser.quit();
});
```

#### timeout

The default timeout for wait operations, e.g. waitForElementPresent, is 30 seconds. You may change this by passing the desired timeout in miliseconds as an integer, e.g.

```js
sync(function(){
    browser.init({ browserName: 'phantomjs' });
    test1(browser, {
        screenshotFolder: 'screenshots/firefox/backend/user management/adding and deleting',
        timeout: 5000
    });
    browser.quit();
});
```

## Logging

selenium-html-js-converter is by default quite verbose. You may redirect logging to your own logger object by calling `.setLogger()` once imported, e.g.:

```js
var converter = require("selenium-html-js-converter");

converter.setLogger({
    log   : function () {},
    debug : function () {},
    info  : function () {},
    warn  : console.warn,
    error : console.error
});
```
