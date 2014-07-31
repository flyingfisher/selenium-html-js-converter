console.debug = console.log;
var testCaseParser = require(__dirname+"/convertHtmlToTestCase");
var fs = require("fs");
var TestCase = require(__dirname+"/testCase").TestCase;
var Command = require(__dirname+"/testCase").Command;
var xmlParser = require("xml2js");
xmlParser.parseString(fs.readFileSync(__dirname+"/iedoc-core.xml","utf-8"), function (err, result) {
    Command.apiDocuments = new Array(result);
});

exports.convertHtmlToJs=function (htmlFile, jsFile){
    if (!htmlFile || !jsFile)
        return;
    var testCaseName = jsFile.split("/").pop().split(".")[0];

    testCaseName = testCaseName.replace(/[^\w_0-9]*/g,""); // remove unsupported alpha
    if (testCaseName.toLowerCase().indexOf("test") === -1)
        testCaseName = "test_" + testCaseName;

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");
    var testCase = new TestCase(testCaseName);
    testCaseParser.parse(testCase,htmlStr);

    var formatter = require(__dirname+"/JavascriptFormatter");
    var testJS = formatter.format(testCase, testCaseName);

    fs.writeFileSync(jsFile, testJS, "utf-8");
}


