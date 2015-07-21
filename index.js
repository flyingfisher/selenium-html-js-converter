/* jslint node: true */
"use strict";
console.debug = console.log;
var testCaseParser = require(__dirname+"/convertHtmlToTestCase");
var fs = require("fs");
var TestCase = require(__dirname+"/testCase").TestCase;
var Command = require(__dirname+"/testCase").Command;
var xmlParser = require("xml2js");
xmlParser.parseString(fs.readFileSync(__dirname+"/iedoc-core.xml","utf-8"), function (err, result) {
    Command.apiDocuments = new Array(result);
});

exports.convertHtmlStrToJsStr=function (htmlStr, testCaseName){
    if (!htmlStr)
        return;

    if (!testCaseName)
        testCaseName="UntitledTest";

    var testCase = new TestCase(testCaseName);
    testCaseParser.parse(testCase,htmlStr);

    var formatter = require(__dirname+"/JavascriptFormatter");
    return formatter.format(testCase, testCaseName);
};

exports.convertHtmlFileToJsStr=function (htmlFile, testCaseName){
    if (!htmlFile)
        return;

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");

    return exports.convertHtmlStrToJsStr(htmlStr, testCaseName);
};

exports.convertHtmlFileToJsFile=function (htmlFile, jsFile, testCaseName){
    if (!htmlFile || !jsFile)
        return;

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");

    exports.convertHtmlStrToJsFile(htmlStr, jsFile, testCaseName);
};

exports.convertHtmlToJs=exports.convertHtmlFileToJsFile; //compatible

exports.convertHtmlStrToJsFile=function (htmlStr, jsFile, testCaseName){
    if (!htmlStr || !jsFile)
        return;

    if (!testCaseName) {
        testCaseName = jsFile.split("/").pop().split(".")[0];

        testCaseName = testCaseName.replace(/[^\w_0-9]+/g,"_"); // remove unsupported alpha

        if (testCaseName.toLowerCase().indexOf("test") === -1)
            testCaseName = "test_" + testCaseName;
    }

    var JsStr = exports.convertHtmlStrToJsStr(htmlStr, testCaseName);

    fs.writeFileSync(jsFile, JsStr, "utf-8");
};
