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

/**
 * Same as mkdir -p <path>
 *
 * @throws on collisions with files and missing permissions.
 *
 * @param  {string} path  The path to create. Windows and *NIX paths accepted, as well as absolute and relative ones.
 * @return {void}
 */
function mkdirP(path) {
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

exports.setLogger = function (logger) {
    var formatter = require(__dirname+"/JavascriptFormatter");
    var _ = require("lodash");
    logger = _.defaults(logger, {
        log   : function () {},
        debug : function () {},
        info  : function () {},
        warn  : console.warn,
        error : console.error
    });
    formatter.setLogger(logger);
    testCaseParser.setLogger(logger);
};

exports.convertHtmlStrToJsStr = function (htmlStr, options) {
    if (!htmlStr)
        return;

    if (!options)
        options = {};
    else if
        (typeof options === 'string')
        options = { testCaseName: options };

    if (!options.testCaseName)
        options.testCaseName = "UntitledTest";

    var testCase = new TestCase(options.testCaseName);
    testCaseParser.parse(testCase, htmlStr);

    var formatter = require(__dirname+"/JavascriptFormatter");
    return formatter.format(testCase, options);
};

exports.convertHtmlFileToJsStr = function (htmlFile, options) {
    if (!htmlFile)
        return;

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");

    return exports.convertHtmlStrToJsStr(htmlStr, options);
};

exports.convertHtmlFileToJsFile = function (htmlFile, jsFile, options) {
    if (!htmlFile || !jsFile)
        return;

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");

    exports.convertHtmlStrToJsFile(htmlStr, jsFile, options);
};

exports.convertHtmlToJs = exports.convertHtmlFileToJsFile; //compatible

exports.convertHtmlStrToJsFile = function (htmlStr, jsFile, options) {
    if (!htmlStr || !jsFile)
        return;

    if (!options)
        options = {};
    else if
        (typeof options === 'string')
        options = { testCaseName: options };

    if (!options.testCaseName) {
        options.testCaseName = jsFile.split("/").pop().split(".")[0];

        options.testCaseName = options.testCaseName.replace(/[^\w_0-9]+/g,"_"); // remove unsupported alpha

        if (options.testCaseName.toLowerCase().indexOf("test") === -1)
            options.testCaseName = "test_" + options.testCaseName;
    }

    var JsStr = exports.convertHtmlStrToJsStr(htmlStr, options);

    fs.writeFileSync(jsFile, JsStr, "utf-8");
};

exports.convertHtmlSuiteFileToJsFiles = function (htmlFile, options) {
    if (!htmlFile)
        return;

    if (!options)
        options = {};
    else if
        (typeof options === 'string')
        options = { outputDir: options };

    var htmlStr = fs.readFileSync(htmlFile,"utf-8");

    var suiteLocation = '.';

    if (htmlFile.match(/[/\\]/))
        suiteLocation = htmlFile.replace(/(.+)[/\\][^/\\]+$/, '$1');

    if (!options.outputDir)
        options.outputDir = suiteLocation;

    htmlStr.match(/<a href="([^"]+)"/g).forEach(function (element) {
        var fileName = element.replace(/<a href="([^"]+)"/, '$1');
        var baseName = fileName.replace(/.+[/\\]([^/\\]+)/, '$1').replace(/\.[^.]+$/i, '');
        var targetDir = options.outputDir + '/' + fileName.replace(/(.+)[/\\][^/\\]+/, '$1');
        var targetFile = targetDir + '/' + baseName+'.js';

        mkdirP(targetDir);

        exports.convertHtmlFileToJsFile(suiteLocation + '/' + fileName, targetFile, { testCaseName: baseName });
    });
};
