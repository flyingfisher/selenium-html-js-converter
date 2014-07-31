A small tools to convert 'selenium-IDE' html test cases into javascript test cases with <a href='https://code.google.com/p/selenium/wiki/WebDriverJs'>Node webdriver</a> :

```
var converter = require("selenium-html-js-converter");

converter.convertHtmlToJs(YourHtmlFile, OutJsFile);
```

To run the javascript :
```
var webdriver = require("selenium-webdriver");

var driver = new webdriver.Builder().
   withCapabilities(webdriver.Capabilities.chrome()).
   build();

var test1 = require("./OutJsFile")

test1(webdriver,driver);

driver.quit();
```
Ref to <a href='https://code.google.com/p/selenium/wiki/WebDriverJs'>selenium-webdriver</a>
