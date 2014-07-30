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

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");
    var testCase = new TestCase();
    testCaseParser.parse(testCase,htmlStr);

    var formatter = require(__dirname+"/JavascriptFormatter");
    var testCaseName = jsFile.split("/").pop().split(".")[0];
    var testJS = formatter.format(testCase, testCaseName);

    fs.writeFileSync(jsFile, testJS, "utf-8");
}


