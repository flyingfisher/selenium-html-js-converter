A small tools to convert 'selenium-IDE' html test cases into javascript test cases with <a href='https://code.google.com/p/selenium/wiki/WebDriverJs'>Node webdriver</a> :

Install
```
$npm install selenium-html-js-converter
```

```
var converter = require("selenium-html-js-converter");

converter.convertHtmlToJs(YourHtmlFile, OutJsFile);
```

Before your run the javascript, you need install <a href='https://github.com/yortus/asyncawait'>asyncawait</a> and <a href='https://github.com/SeleniumHQ/selenium/tree/master/javascript/node/selenium-webdriver'>selenium-webdriver</a>, which are used in the test case.
```
$npm install asyncawait selenium-webdriver
```

To run the javascript :
```
var webdriver = require("selenium-webdriver");

var driver = new webdriver.Builder().
   withCapabilities(webdriver.Capabilities.chrome()).
   build();

var test1 = require("./OutJsFile")

test1(webdriver,driver).then(driver.quit);
```
Ref to <a href='http://selenium.googlecode.com/git/docs/api/javascript/class_webdriver_WebDriver.html'>selenium-webdriver api</a>
