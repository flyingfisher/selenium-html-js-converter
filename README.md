## selenium-html-js-converter

A small tools to convert 'selenium-IDE' HTML test cases into javascript test cases with [wd-sync](https://github.com/sebv/node-wd-sync).

Attention: Only supports test case HTML at the moment, test suite HTML is not supported yet.

## Install

```sh
$ npm install selenium-html-js-converter
```

## Usage

```js
var converter = require("selenium-html-js-converter");

converter.convertHtmlFileToJsFile(YourHtmlFile, OutJsFile[, testCaseName]);
```

Before you run the javascript, you need to install [wd-sync](https://github.com/sebv/node-wd-sync), which is used in the test case.

```sh
    $ npm install wd-sync
```

## To run the javascript

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
convertHtmlFileToJsFile(filePath, filePath[, testCaseName]) => void;
convertHtmlStrToJsFile(htmlStr, filePath[, testCaseName])   => void;
convertHtmlFileToJsStr(filePath[, testCaseName])            => string;
convertHtmlStrToJsStr(htmlStr[, testCaseName])              => string;
```

The test case name parameter is optional, but, if given, it is used to place any screenshots that may be taken during a test case. Screenshots are saved as `./screenshots/<testCaseName>/<fileName specified in the HTML test case or an incrementing number>.png`.

Paths from the screenshot file name in the HTML test case itself are stripped, but you can include paths in the testCaseName if you want your screenshots ordered in folders, e.g.

```js
convertHtmlFileToJsFile('test.html', 'test.js', 'backend/user management/adding and deleting');
```

This example will put screenshots in `./screenshots/backend/user management/adding and deleting/`. Any folders missing in the path will be automatically created when you run your test.

The screenshot folder can be changed at runtime by passing it to the test function, e.g. using the example from before:

```js
sync(function(){
    browser.init({ browserName: 'phantomjs' });
    test1(browser, null, null, { screenshotFolder: 'screenshots/firefox/backend/user management/adding and deleting' });
    browser.quit();
});
```

Note that kwArgs aren't supported by wd in screenshots (see [Selenium reference docs](http://release.seleniumhq.org/selenium-core/1.0.1/reference.html)) so they will be ignored.