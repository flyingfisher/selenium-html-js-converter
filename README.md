A small tools to convert 'selenium-IDE' html test cases into javascript test cases with <a href='https://github.com/sebv/node-wd-sync'>Node wd-sync</a> :

Install
```
$npm install selenium-html-js-converter
```
Usage

```
var converter = require("selenium-html-js-converter");

converter.convertHtmlToJs(YourHtmlFile, OutJsFile);
```

Before your run the javascript, you need install <a href='https://github.com/sebv/node-wd-sync'>Node wd-sync</a>, which are used in the test case.
```
$npm install wd-sync
```

To run the javascript :
```
var wdSync = require('wd-sync');

var client = wdSync.remote("127.0.0.1",8910) //phatomjs default wd port
    , browser = client.browser
    , sync = client.sync;

var test1 = require("./OutJsFile");

sync(function(){
  test1(browser);
  browser.quit();
  });
```
Ref to <a href='https://github.com/sebv/node-wd-sync/blob/master/doc/jsonwire-full-mapping.md'>wd-sync api</a>

If your want to run the previous javascript success, you should start a <a href='http://phantomjs.org'>phantomjs</a> webdriver server in another process.
```
phantomjs --wd
```
