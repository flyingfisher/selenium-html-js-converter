/// <reference path="typings/node.d.ts" />
var Command = require("./testCase").Command;
var Comment = require("./testCase").Comment;
var jsbute = require('js-beautify').js_beautify;
var fs = require('fs');
var log = console;
log.debug = log.info;
var app = {};
var options = {};
/**
 * Format TestCase and return the source.
 *
 * @param {string} testCase  TestCase to format
 * @param {object} opts      Custom options
 *        {string} .testCaseName
 *                          The name of the test case. It will be used to embed
 *                          title into the source, and write screenshot files.
 *                          Default: 'Untitled'
 *        {number} .timeout
 *                          Default number of msecs before timing out in test
 *                          cases with timeouts, and when creating auto-retrying
 *                          test cases.
 *                          Default: 30,000
 *        {number} .retries
 *                          How many times to retry test cases when they fail.
 *                          If retries are enabled, each generated test case
 *                          will be wrapped in a retry function.
 *                          Default: 0 (disabled)
 *        {string} .extensions
 *                          User extensions javascript file:
 *                          Default: __dirname + 'extensions/user-extensions.js'
 *
 * @return {string}         The formatted test case.
 */
function format(testCase, opts) {
    if (!opts || typeof opts !== 'object')
        opts = {};
    log.info("Formatting testCase: " + opts.testCaseName);
    var result = '';
    var header = "";
    var footer = "";
    var extension, extensions = opts.extensions || __dirname + '/extensions/user-extensions.js';
    app.commandCharIndex = 0;
    app.testCaseName = opts.testCaseName || '';
    app.screenshotsCount = 0;
    options.testCaseName = opts.testCaseName || 'Untitled';
    options.timeout = typeof opts.timeout === 'number' && !isNaN(opts.timeout) ? opts.timeout : 30000;
    options.retries = typeof opts.retries === 'number' && !isNaN(opts.retries) ? opts.retries : 0;
    options.screenshotFolder = 'screenshots/' + app.testCaseName;
    options.baseUrl = opts.baseUrl || '${baseURL}';
    options.extensions = {};
    log.info('Importing user extensions from %s ...', extensions);
    extensions = require(extensions);
    for (extension in extensions) {
        if (extensions.hasOwnProperty(extension)) {
            log.info('Adding command %s', extension);
            options.extensions[extension] = extensions[extension];
        }
    }
    header = formatHeader(testCase);
    result += header;
    app.commandCharIndex = header.length;
    testCase.formatLocal(app.name).header = header;
    result += formatCommands(testCase.commands);
    footer = formatFooter(testCase);
    footer += '\n\n/* User extensions */\n\n';
    for (extension in options.extensions) {
        footer += options.extensions[extension].toString().replace(/^function/, 'function ' + extension) + '\n\n';
    }
    result += footer;
    testCase.formatLocal(app.name).footer = footer;
    return jsbute(result, opts.jsBeautifierOptions || { max_preserve_newlines: 2 });
}
exports.format = format;
function setLogger(logger) {
    log = logger;
}
exports.setLogger = setLogger;
/**
 * Generates a variable name for storing temporary values in generated scripts.
 */
function getTempVarName() {
    if (!app.tmpVarsCount)
        app.tmpVarsCount = 1;
    return "var" + app.tmpVarsCount++;
}
function retryWrap(code) {
    var wrapped = "withRetry(function () {\n";
    code.split('\n').forEach(function (line) {
        wrapped += line + '\n';
    });
    wrapped += "});";
    return wrapped;
}
function andWait(code) {
    var wrapped = "doAndWait(function () {\n";
    code.split('\n').forEach(function (line) {
        wrapped += line + '\n';
    });
    wrapped += "});";
    return wrapped;
}
function filterForRemoteControl(commands) {
    return app.postFilter ? app.postFilter(commands) : commands;
}
function formatCommands(commands) {
    commands = filterForRemoteControl(commands);
    var result = '';
    var line = null;
    var command;
    var commandName;
    var hasAndWaitSuffix;
    for (var i = 0; i < commands.length; i++) {
        command = commands[i];
        app.currentlyParsingCommand = command;
        if (command.type == 'line') {
            line = command.line;
        }
        else if (command.type == 'command') {
            commandName = command.command;
            hasAndWaitSuffix = !!commandName.match(/AndWait$/);
            if (hasAndWaitSuffix) {
                command.command = commandName.replace(/AndWait$/, '');
            }
            line = formatCommand(command);
            /* If retries are enabled, wrap the code block in a retry wrapper, unless the command is of the waiting type */
            if (options.retries && !commandName.match(/(^waitFor)|(AndWait$)/)) {
                line = retryWrap(line);
            }
            else if (hasAndWaitSuffix) {
                line = andWait(line);
            }
            /* For debugging test failures and for screenshotting, we use currentCommand to keep track of what last ran: */
            line = 'currentCommand = \'' + commandName + '(' + '"' + command.target.replace(/'/g, "\\'") + '", ' + '"' + command.value.replace(/'/g, "\\'") + '")\';\n' + line + '\n';
            command.line = line;
        }
        else if (command.type == 'comment') {
            line = formatComment(command);
            command.line = line;
        }
        command.charIndex = app.commandCharIndex;
        if (line != null) {
            line = line + "\n";
            result += line;
            app.commandCharIndex += line.length;
        }
        app.previouslyParsedCommand = command;
    }
    return result;
}
/* @override
 * This function filters the command list and strips away the commands we no longer need
 * or changes the command to another one.
 * NOTE: do not change the existing command directly or it will also change in the test case.
 */
app.postFilter = function (originalCommands) {
    var commands = [];
    var commandsToSkip = {};
    var rc;
    for (var i = 0; i < originalCommands.length; i++) {
        var c = originalCommands[i];
        if (c.type == 'command') {
            if (commandsToSkip[c.command] && commandsToSkip[c.command] == 1) {
            }
            else if (rc = SeleneseMapper.remap(c)) {
                //Remap
                commands.push.apply(commands, rc);
            }
            else {
                commands.push(c);
            }
        }
        else {
            commands.push(c);
        }
    }
    return commands;
};
/* SeleneseMapper changes one Selenese command to another that is more suitable for WebDriver export
 */
var SeleneseMapper = function () {
};
SeleneseMapper.remap = function (cmd) {
    /*
      for (var mapper in SeleneseMapper) {
        if (SeleneseMapper.hasOwnProperty(mapper) && typeof SeleneseMapper.mapper.isDefined === 'function'  && typeof SeleneseMapper.mapper.convert === 'function') {
          if (SeleneseMapper.mapper.isDefined(cmd)) {
            return SeleneseMapper.mapper.convert(cmd);
          }
        }
      }
    */
    // NOTE The above code is useful if there are more than one mappers, since there is just one, it is more efficient to call it directly
    if (SeleneseMapper.IsTextPresent.isDefined(cmd)) {
        return SeleneseMapper.IsTextPresent.convert(cmd);
    }
    return null;
};
SeleneseMapper.IsTextPresent = {
    isTextPresentRegex: /^(assert|verify|waitFor)Text(Not)?Present$/,
    isPatternRegex: /^(regexp|regexpi|regex):/,
    exactRegex: /^exact:/,
    isDefined: function (cmd) {
        return this.isTextPresentRegex.test(cmd.command);
    },
    convert: function (cmd) {
        if (this.isTextPresentRegex.test(cmd.command)) {
            var pattern = cmd.target;
            if (!this.isPatternRegex.test(pattern)) {
                if (this.exactRegex.test(pattern)) {
                    //TODO how to escape wildcards in an glob pattern?
                    pattern = pattern.replace(this.exactRegex, 'glob:*') + '*';
                }
                else {
                    //glob
                    pattern = pattern.replace(/^(glob:)?\*?/, 'glob:*');
                    if (!/\*$/.test(pattern)) {
                        pattern += '*';
                    }
                }
            }
            var remappedCmd = new Command(cmd.command.replace(this.isTextPresentRegex, "$1$2Text"), 'css=BODY', pattern);
            remappedCmd.remapped = cmd;
            return [new Comment('Warning: ' + cmd.command + ' may require manual changes'), remappedCmd];
        }
    }
};
function formatHeader(testCase) {
    var className = testCase.getTitle();
    if (!className) {
        className = "NewTest";
    }
    className = testClassName(className);
    var formatLocal = testCase.formatLocal(app.name);
    var methodName = testMethodName(className.replace(/Test$/i, "").replace(/^Test/i, "").replace(/^[A-Z]/, function (str) {
        return str.toLowerCase();
    }));
    var header = (options.getHeader()).
        replace(/\$\{className\}/g, className).
        replace(/\$\{methodName\}/g, methodName).
        replace(/\$\{baseURL\}/g, testCase.getBaseURL()).
        replace(/\$\{([a-zA-Z0-9_]+)\}/g, function (str, name) {
        return options[name];
    });
    formatLocal.header = header;
    return formatLocal.header;
}
function formatFooter(testCase) {
    var formatLocal = testCase.formatLocal(app.name);
    formatLocal.footer = options.footer;
    return formatLocal.footer;
}
function capitalize(string) {
    return string.replace(/^[a-z]/, function (str) {
        return str.toUpperCase();
    });
}
function underscore(text) {
    return text.replace(/[A-Z]/g, function (str) {
        return '_' + str.toLowerCase();
    });
}
function notOperator() {
    return "!";
}
function logicalAnd(conditions) {
    return conditions.join(" && ");
}
function equals(e1, e2) {
    return new Equals(e1, e2);
}
function Equals(e1, e2) {
    this.e1 = e1;
    this.e2 = e2;
}
Equals.prototype.invert = function () {
    return new NotEquals(this.e1, this.e2);
};
function NotEquals(e1, e2) {
    this.e1 = e1;
    this.e2 = e2;
    this.negative = true;
}
NotEquals.prototype.invert = function () {
    return new Equals(this.e1, this.e2);
};
function RegexpMatch(pattern, expression) {
    this.pattern = pattern;
    this.expression = expression;
}
RegexpMatch.prototype.invert = function () {
    return new RegexpNotMatch(this.pattern, this.expression);
};
RegexpMatch.prototype.assert = function () {
    return assertTrue(this.toString());
};
RegexpMatch.prototype.verify = function () {
    return verifyTrue(this.toString());
};
function RegexpNotMatch(pattern, expression) {
    this.pattern = pattern;
    this.expression = expression;
    this.negative = true;
}
RegexpNotMatch.prototype.invert = function () {
    return new RegexpMatch(this.pattern, this.expression);
};
RegexpNotMatch.prototype.toString = function () {
    return notOperator() + RegexpMatch.prototype.toString.call(this);
};
RegexpNotMatch.prototype.assert = function () {
    return assertFalse(this.invert());
};
RegexpNotMatch.prototype.verify = function () {
    return verifyFalse(this.invert());
};
function seleniumEquals(type, pattern, expression) {
    if (type == 'String[]') {
        return seleniumEquals('String', pattern.replace(/\\,/g, ','), joinExpression(expression));
    }
    else if (type == 'String' && pattern.match(/^regexp:/)) {
        return new RegexpMatch(pattern.substring(7), expression);
    }
    else if (type == 'String' && pattern.match(/^regex:/)) {
        return new RegexpMatch(pattern.substring(6), expression);
    }
    else if (type == 'String' && (pattern.match(/^glob:/) || pattern.match(/[\*\?]/))) {
        pattern = pattern.replace(/^glob:/, '');
        pattern = pattern.replace(/([\]\[\\\{\}\$\(\).])/g, "\\$1");
        pattern = pattern.replace(/\?/g, "[\\s\\S]");
        pattern = pattern.replace(/\*/g, "[\\s\\S]*");
        return new RegexpMatch("^" + pattern + "$", expression);
    }
    else {
        pattern = pattern.replace(/^exact:/, '');
        return new Equals(xlateValue(type, pattern), expression);
    }
}
function concatString(array) {
    return array.filter(function (e) { return e; }).join(" + ");
}
function toArgumentList(array) {
    return array.join(", ");
}
// function keyVariable(key) {
//   return variableName(key);
// }
app.sendKeysMaping = {};
function xlateKeyVariable(variable) {
    var r;
    if ((r = /^KEY_(.+)$/.exec(variable))) {
        var key = app.sendKeysMaping[r[1]];
        if (key) {
            return keyVariable(key);
        }
    }
    return null;
}
function xlateArgument(value, type) {
    value = value.replace(/^\s+/, '');
    value = value.replace(/\s+$/, '');
    var r;
    var r2;
    var parts = [];
    if ((r = /^javascript\{([\d\D]*)\}$/.exec(value))) {
        var js = r[1];
        var prefix = "";
        while ((r2 = /storedVars\[['"](.*?)['"]\]/.exec(js))) {
            parts.push(string(prefix + js.substring(0, r2.index) + "'"));
            parts.push(variableName(r2[1]));
            js = js.substring(r2.index + r2[0].length);
            prefix = "'";
        }
        parts.push(string(prefix + js));
        return new CallSelenium("getEval", [concatString(parts)]);
    }
    else if ((r = /\$\{/.exec(value))) {
        var regexp = /\$\{(.*?)\}/g;
        var lastIndex = 0;
        while (r2 = regexp.exec(value)) {
            var key = xlateKeyVariable(r2[1]);
            if (key || (app.declaredVars && app.declaredVars[r2[1]])) {
                if (r2.index - lastIndex > 0) {
                    parts.push(string(value.substring(lastIndex, r2.index)));
                }
                parts.push(key ? key : variableName(r2[1]));
                lastIndex = regexp.lastIndex;
            }
            else if (r2[1] == "nbsp") {
                if (r2.index - lastIndex > 0) {
                    parts.push(string(value.substring(lastIndex, r2.index)));
                }
                parts.push(nonBreakingSpace());
                lastIndex = regexp.lastIndex;
            }
        }
        if (lastIndex < value.length) {
            parts.push(string(value.substring(lastIndex, value.length)));
        }
        return (type && type.toLowerCase() == 'args') ? toArgumentList(parts) : concatString(parts);
    }
    else if (type && type.toLowerCase() == 'number') {
        return value;
    }
    else {
        return string(value);
    }
}
function xlateArrayElement(value) {
    return value.replace(/\\(.)/g, "$1");
}
function xlateValue(type, value) {
    if (type == 'String[]') {
        return array(parseArray(value));
    }
    else {
        return xlateArgument(value, type);
    }
}
function parseArray(value) {
    var start = 0;
    var list = [];
    for (var i = 0; i < value.length; i++) {
        if (value.charAt(i) == ',') {
            list.push(xlateArrayElement(value.substring(start, i)));
            start = i + 1;
        }
        else if (value.charAt(i) == '\\') {
            i++;
        }
    }
    list.push(xlateArrayElement(value.substring(start, value.length)));
    return list;
}
function addDeclaredVar(variable) {
    if (app.declaredVars == null) {
        app.declaredVars = {};
    }
    app.declaredVars[variable] = true;
}
function newVariable(prefix, index) {
    if (index == null)
        index = 1;
    if (app.declaredVars && app.declaredVars[prefix + index]) {
        return newVariable(prefix, index + 1);
    }
    else {
        addDeclaredVar(prefix + index);
        return prefix + index;
    }
}
function variableName(value) {
    return value;
}
function string(value) {
    if (value != null) {
        //value = value.replace(/^\s+/, '');
        //value = value.replace(/\s+$/, '');
        value = value.replace(/\\/g, '\\\\');
        value = value.replace(/\"/g, '\\"');
        value = value.replace(/\r/g, '\\r');
        value = value.replace(/\n/g, '\\n');
        return '"' + value + '"';
    }
    else {
        return '""';
    }
}
var CallSelenium = function (message, args, rawArgs) {
    this.message = message;
    if (args) {
        this.args = args;
    }
    else {
        this.args = [];
    }
    if (rawArgs) {
        this.rawArgs = rawArgs;
    }
    else {
        this.rawArgs = [];
    }
};
CallSelenium.prototype.invert = function () {
    var call = new CallSelenium(this.message);
    call.args = this.args;
    call.rawArgs = this.rawArgs;
    call.negative = !this.negative;
    return call;
};
CallSelenium.prototype.toString = function () {
    log.info('Processing ' + this.message);
    var result = '';
    var adaptor = new SeleniumWebDriverAdaptor(this.rawArgs);
    if (this.message.match(/^(getEval|runScript)/)) {
        adaptor.rawArgs = this.args;
    }
    if (adaptor[this.message]) {
        var codeBlock = adaptor[this.message].call(adaptor);
        if (adaptor.negative) {
            this.negative = !this.negative;
        }
        if (this.negative) {
            result += notOperator();
        }
        result += codeBlock;
    }
    else {
        //unsupported
        throw 'ERROR: Unsupported command [' + this.message + ' | ' + (this.rawArgs.length > 0 && this.rawArgs[0] ? this.rawArgs[0] : '') + ' | ' + (this.rawArgs.length > 1 && this.rawArgs[1] ? this.rawArgs[1] : '') + ']';
    }
    return result;
};
function formatCommand(command) {
    var line = null;
    try {
        var call;
        var i;
        var eq;
        var method;
        if (command.type == 'command') {
            /* Definitions are extracted from the iedoc-core.xml doc */
            var def = command.getDefinition();
            if (def && def.isAccessor) {
                call = new CallSelenium(def.name);
                for (i = 0; i < def.params.length; i++) {
                    call.rawArgs.push(command.getParameterAt(i));
                    call.args.push(xlateArgument(command.getParameterAt(i)));
                }
                var extraArg = command.getParameterAt(def.params.length);
                if (def.name.match(/^is/)) {
                    if (command.command.match(/^assert/) ||
                        (app.assertOrVerifyFailureOnNext && command.command.match(/^verify/))) {
                        line = (def.negative ? assertFalse : assertTrue)(call);
                    }
                    else if (command.command.match(/^verify/)) {
                        line = (def.negative ? verifyFalse : verifyTrue)(call);
                    }
                    else if (command.command.match(/^store/)) {
                        addDeclaredVar(extraArg);
                        line = statement(assignToVariable('boolean', extraArg, call));
                    }
                    else if (command.command.match(/^waitFor/)) {
                        line = waitFor(def.negative ? call.invert() : call);
                    }
                }
                else {
                    if (command.command.match(/^(verify|assert)/)) {
                        eq = seleniumEquals(def.returnType, extraArg, call);
                        if (def.negative)
                            eq = eq.invert();
                        method = (!app.assertOrVerifyFailureOnNext && command.command.match(/^verify/)) ? 'verify' : 'assert';
                        line = eq[method]();
                    }
                    else if (command.command.match(/^store/)) {
                        addDeclaredVar(extraArg);
                        line = statement(assignToVariable(def.returnType, extraArg, call));
                    }
                    else if (command.command.match(/^waitFor/)) {
                        eq = seleniumEquals(def.returnType, extraArg, call);
                        if (def.negative)
                            eq = eq.invert();
                        line = waitFor(eq);
                    }
                    else if (command.command.match(/^(getEval|runScript)/)) {
                        call = new CallSelenium(def.name, xlateArgument(command.getParameterAt(0)), command.getParameterAt(0));
                        line = statement(call, command);
                    }
                }
            }
            else if (command.command.match(/setWindowSize|dragAndDrop/)) {
                call = new CallSelenium(command.command);
                call.rawArgs.push(command.getParameterAt(0));
                call.rawArgs.push(command.getParameterAt(1));
                line = statement(call, command);
            }
            else if ('pause' == command.command) {
                line = pause(command.target);
            }
            else if (app.echo && 'echo' == command.command) {
                line = echo(command.target);
            }
            else if ('store' == command.command) {
                addDeclaredVar(command.value);
                line = statement(assignToVariable('String', command.value, xlateArgument(command.target)));
            }
            else if (command.command.match(/^(assert|verify)Selected$/)) {
                var optionLocator = command.value;
                var flavor = 'Label';
                var value = optionLocator;
                var r = /^(index|label|value|id)=(.*)$/.exec(optionLocator);
                if (r) {
                    flavor = r[1].replace(/^[a-z]/, function (str) {
                        return str.toUpperCase();
                    });
                    value = r[2];
                }
                method = (!app.assertOrVerifyFailureOnNext && command.command.match(/^verify/)) ? 'verify' : 'assert';
                call = new CallSelenium("getSelected" + flavor);
                call.rawArgs.push(command.target);
                call.args.push(xlateArgument(command.target));
                eq = seleniumEquals('String', value, call);
                line = statement(eq[method]());
            }
            else if (def) {
                if (def.name.match(/^(assert|verify)(Error|Failure)OnNext$/)) {
                    app.assertOrVerifyFailureOnNext = true;
                    app.assertFailureOnNext = def.name.match(/^assert/);
                    app.verifyFailureOnNext = def.name.match(/^verify/);
                }
                else {
                    call = new CallSelenium(def.name);
                    if ("open" == def.name && options.urlSuffix && !command.target.match(/^\w+:\/\//)) {
                        // urlSuffix is used to translate core-based test
                        call.rawArgs.push(options.urlSuffix + command.target);
                        call.args.push(xlateArgument(options.urlSuffix + command.target));
                    }
                    else {
                        for (i = 0; i < def.params.length; i++) {
                            call.rawArgs.push(command.getParameterAt(i));
                            call.args.push(xlateArgument(command.getParameterAt(i)));
                        }
                    }
                    line = statement(call, command);
                }
            }
            else if (options.extensions[command.command]) {
                var commandName = command.command;
                command.command = 'userCommand';
                call = new CallSelenium(command.command);
                call.rawArgs.push(command.getParameterAt(0));
                call.rawArgs.push(command.getParameterAt(1));
                call.rawArgs.push(commandName);
                line = statement(call, command);
            }
            else {
                log.info("Unknown command: <" + command.command + ">");
                throw 'Unknown command [' + command.command + ']';
            }
        }
    }
    catch (e) {
        log.error("Caught exception: [" + e + "]. Stack:\n" + e.stack);
        // TODO
        //    var call = new CallSelenium(command.command);
        //    if ((command.target != null && command.target.length > 0)
        //        || (command.value != null && command.value.length > 0)) {
        //      call.rawArgs.push(command.target);
        //      call.args.push(string(command.target));
        //      if (command.value != null && command.value.length > 0) {
        //        call.rawArgs.push(command.value);
        //        call.args.push(string(command.value));
        //      }
        //    }
        //    line = formatComment(new Comment(statement(call)));
        line = formatComment(new Comment('ERROR: Caught exception [' + e + ']'));
    }
    if (line && app.assertOrVerifyFailureOnNext) {
        line = assertOrVerifyFailure(line, app.assertFailureOnNext);
        app.assertOrVerifyFailureOnNext = false;
        app.assertFailureOnNext = false;
        app.verifyFailureOnNext = false;
    }
    //TODO: convert array to newline separated string -> if(array) return array.join"\n"
    if (command.type == 'command' && options.showSelenese && options.showSelenese == 'true') {
        if (command.remapped) {
            line = formatComment(new Comment(command.remapped.command + ' | ' + command.remapped.target + ' | ' + command.remapped.value)) + "\n" + line;
        }
        else {
            line = formatComment(new Comment(command.command + ' | ' + command.target + ' | ' + command.value)) + "\n" + line;
        }
    }
    return line;
}
app.remoteControl = true;
app.playable = false;
function parse_locator(locator) {
    var result = locator.match(/^([A-Za-z]+)=.+/);
    if (result) {
        var type = result[1].toLowerCase();
        var actualLocator = locator.substring(type.length + 1);
        return { type: type, string: actualLocator };
    }
    return { type: 'implicit', string: locator };
}
var SeleniumWebDriverAdaptor = function (rawArgs) {
    this.rawArgs = rawArgs;
    this.negative = false;
};
// Returns locator.type and locator.string
SeleniumWebDriverAdaptor.prototype._elementLocator = function (sel1Locator) {
    var locator = parse_locator(sel1Locator);
    if (sel1Locator.match(/^\/\//) || locator.type == 'xpath') {
        locator.type = 'xpath';
        return locator;
    }
    if (locator.type == 'css') {
        return locator;
    }
    if (locator.type == 'id') {
        return locator;
    }
    if (locator.type == 'link') {
        locator.string = locator.string.replace(/^exact:/, '');
        return locator;
    }
    if (locator.type == 'name') {
        return locator;
    }
    if (sel1Locator.match(/^document/) || locator.type == 'dom') {
        throw 'Error: Dom locators are not implemented yet!';
    }
    if (locator.type == 'ui') {
        throw 'Error: UI locators are not supported!';
    }
    if (locator.type == 'identifier') {
        throw 'Error: locator strategy [identifier] has been deprecated. To rectify specify the correct locator strategy id or name explicitly.';
    }
    if (locator.type == 'implicit') {
        throw 'Error: locator strategy either id or name must be specified explicitly.';
    }
    throw 'Error: unknown strategy [' + locator.type + '] for locator [' + sel1Locator + ']';
};
// Returns locator.elementLocator and locator.attributeName
SeleniumWebDriverAdaptor.prototype._attributeLocator = function (sel1Locator) {
    var attributePos = sel1Locator.lastIndexOf("@");
    var elementLocator = sel1Locator.slice(0, attributePos);
    var attributeName = sel1Locator.slice(attributePos + 1);
    return { elementLocator: elementLocator, attributeName: attributeName };
};
SeleniumWebDriverAdaptor.prototype._selectLocator = function (sel1Locator) {
    //Figure out which strategy to use
    var locator = { type: 'label', string: sel1Locator };
    // If there is a locator prefix, use the specified strategy
    var result = sel1Locator.match(/^([a-zA-Z]+)=(.*)/);
    if (result) {
        locator.type = result[1];
        locator.string = result[2];
    }
    //alert(locatorType + ' [' + locatorValue + ']');
    if (locator.type == 'index') {
        return locator;
    }
    if (locator.type == 'label') {
        return locator;
    }
    if (locator.type == 'value') {
        return locator;
    }
    throw 'Error: unknown or unsupported strategy [' + locator.type + '] for locator [' + sel1Locator + ']';
};
// Returns an object with a toString method
SeleniumWebDriverAdaptor.SimpleExpression = function (expressionString) {
    this.str = expressionString;
};
SeleniumWebDriverAdaptor.SimpleExpression.prototype.toString = function () {
    return this.str;
};
//helper method to simplify the ifCondition
SeleniumWebDriverAdaptor.ifCondition = function (conditionString, stmtString) {
    return ifCondition(new SeleniumWebDriverAdaptor.SimpleExpression(conditionString), function () {
        return statement(new SeleniumWebDriverAdaptor.SimpleExpression(stmtString)) + "\n";
    });
};
SeleniumWebDriverAdaptor.prototype.check = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    var webElement = driver.findElement(locator.type, locator.string);
    return SeleniumWebDriverAdaptor.ifCondition(notOperator() + webElement.isSelected(), webElement.click());
};
SeleniumWebDriverAdaptor.prototype.click = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).click();
};
SeleniumWebDriverAdaptor.prototype.close = function () {
    var driver = new WDAPI.Driver();
    return driver.close();
};
SeleniumWebDriverAdaptor.prototype.waitForPageToLoad = function () {
    var driver = new WDAPI.Driver();
    return driver.waitForPageToLoad();
};
SeleniumWebDriverAdaptor.prototype.openWindow = function () {
    var driver = new WDAPI.Driver();
    var url = this.rawArgs[0];
    var name = this.rawArgs[1];
    return driver.openWindow(url, name);
};
SeleniumWebDriverAdaptor.prototype.selectWindow = function () {
    var driver = new WDAPI.Driver();
    var name = this.rawArgs[0];
    return driver.selectWindow(name);
};
SeleniumWebDriverAdaptor.prototype.userCommand = function () {
    var driver = new WDAPI.Driver();
    var commandName = this.rawArgs[2];
    var locator;
    try {
        locator = this._elementLocator(this.rawArgs[0]);
        locator = WDAPI.Driver.searchContext(locator.type, locator.string);
    }
    catch (ignore) { }
    return driver.userCommand(commandName, this.rawArgs[0], this.rawArgs[1], locator);
};
/* wd does not support the windowFocus command. window(), called by selectWindow, both selects and focuses a window, so if the previously parsed command was selectWindow, we should be good. */
SeleniumWebDriverAdaptor.prototype.windowFocus = function () {
    if (app.previouslyParsedCommand.command !== 'selectWindow') {
        throw new Error('windowFocus is not supported by wd.');
    }
    /* Ignoring windowFocus command, as window focusing is handled implicitly in the previous wd command. */
    return "";
};
/* Custom user extension: Resize browser window directly via wd's browser object. */
SeleniumWebDriverAdaptor.prototype.setWindowSize = function () {
    var dimensions = this.rawArgs[0].split(/[^0-9]+/);
    var driver = new WDAPI.Driver();
    return driver.setWindowSize(dimensions[0], dimensions[1]);
};
SeleniumWebDriverAdaptor.prototype.deleteAllVisibleCookies = function () {
    var driver = new WDAPI.Driver();
    return driver.deleteAllCookies();
};
SeleniumWebDriverAdaptor.prototype.dragAndDrop = function (elementLocator, offset) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.dragAndDrop(locator, this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.focus = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.focus(locator);
};
SeleniumWebDriverAdaptor.prototype.keyUp = function (elementLocator, key) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.keyEvent(locator, 'keyup', this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.keyDown = function (elementLocator, key) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.keyEvent(locator, 'keydown', this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.keyPress = function (elementLocator, key) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.keyEvent(locator, 'keypress', this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.captureEntirePageScreenshot = function () {
    var driver = new WDAPI.Driver();
    var fileName = this.rawArgs[0];
    return driver.captureEntirePageScreenshot(fileName);
};
SeleniumWebDriverAdaptor.prototype.getAttribute = function (attributeLocator) {
    var attrLocator = this._attributeLocator(this.rawArgs[0]);
    var locator = this._elementLocator(attrLocator.elementLocator);
    var driver = new WDAPI.Driver();
    var webElement = driver.findElement(locator.type, locator.string);
    return webElement.getAttribute(attrLocator.attributeName);
};
SeleniumWebDriverAdaptor.prototype.getBodyText = function () {
    var driver = new WDAPI.Driver();
    return driver.findElement('tag_name', 'BODY').getText();
};
SeleniumWebDriverAdaptor.prototype.getCssCount = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElements(locator.type, locator.string).getSize();
};
SeleniumWebDriverAdaptor.prototype.getLocation = function () {
    var driver = new WDAPI.Driver();
    return driver.getCurrentUrl();
};
SeleniumWebDriverAdaptor.prototype.getText = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).getText();
};
SeleniumWebDriverAdaptor.prototype.getTitle = function () {
    var driver = new WDAPI.Driver();
    return driver.getTitle();
};
SeleniumWebDriverAdaptor.prototype.getAlert = function () {
    var driver = new WDAPI.Driver();
    return driver.getAlert();
};
SeleniumWebDriverAdaptor.prototype.isAlertPresent = function () {
    return WDAPI.Utils.isAlertPresent();
};
SeleniumWebDriverAdaptor.prototype.getConfirmation = function () {
    var driver = new WDAPI.Driver();
    return driver.getAlert();
};
SeleniumWebDriverAdaptor.prototype.isConfirmationPresent = function () {
    return WDAPI.Utils.isAlertPresent();
};
SeleniumWebDriverAdaptor.prototype.chooseOkOnNextConfirmation = function () {
    var driver = new WDAPI.Driver();
    return driver.chooseOkOnNextConfirmation();
};
SeleniumWebDriverAdaptor.prototype.chooseCancelOnNextConfirmation = function () {
    var driver = new WDAPI.Driver();
    return driver.chooseCancelOnNextConfirmation();
};
SeleniumWebDriverAdaptor.prototype.getValue = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).getAttribute('value');
};
SeleniumWebDriverAdaptor.prototype.getXpathCount = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElements(locator.type, locator.string).getSize();
};
SeleniumWebDriverAdaptor.prototype.goBack = function () {
    var driver = new WDAPI.Driver();
    return driver.back();
};
SeleniumWebDriverAdaptor.prototype.isChecked = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).isSelected();
};
SeleniumWebDriverAdaptor.prototype.isElementPresent = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    //var driver = new WDAPI.Driver();
    //TODO: enough to just find element, but since this is an accessor, we will need to make a not null comparison
    //return driver.findElement(locator.type, locator.string);
    return WDAPI.Utils.isElementPresent(locator.type, locator.string);
};
SeleniumWebDriverAdaptor.prototype.isVisible = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).isDisplayed();
};
SeleniumWebDriverAdaptor.prototype.open = function (url) {
    //TODO process the relative and absolute urls
    var absUrl = xlateArgument(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.get(absUrl);
};
SeleniumWebDriverAdaptor.prototype.refresh = function () {
    var driver = new WDAPI.Driver();
    return driver.refresh();
};
SeleniumWebDriverAdaptor.prototype.submit = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).submit();
};
SeleniumWebDriverAdaptor.prototype.type = function (elementLocator, text) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    var webElement = driver.findElement(locator.type, locator.string);
    return statement(new SeleniumWebDriverAdaptor.SimpleExpression(webElement.clear())) + "\n" + webElement.sendKeys(this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.sendKeys = function (elementLocator, text) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).sendKeys(this.rawArgs[1]);
};
SeleniumWebDriverAdaptor.prototype.uncheck = function (elementLocator) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    var webElement = driver.findElement(locator.type, locator.string);
    return SeleniumWebDriverAdaptor.ifCondition(webElement.isSelected(), webElement.click());
};
SeleniumWebDriverAdaptor.prototype.select = function (elementLocator, label) {
    var locator = this._elementLocator(this.rawArgs[0]);
    var driver = new WDAPI.Driver();
    return driver.findElement(locator.type, locator.string).select(this._selectLocator(this.rawArgs[1]));
};
SeleniumWebDriverAdaptor.prototype.getEval = SeleniumWebDriverAdaptor.prototype.runScript = function (script) {
    var driver = new WDAPI.Driver();
    return driver.eval(this.rawArgs[0]);
};
var WDAPI = function () {
};
/*
 * Formatter for Selenium 2 / WebDriver JavaScript client.
 */
function useSeparateEqualsForArray() {
    return true;
}
function testClassName(testName) {
    return testName.split(/[^0-9A-Za-z]+/).map(function (x) { return capitalize(x); }).join('');
}
function testMethodName(testName) {
    return "test" + testClassName(testName);
}
function nonBreakingSpace() {
    return "\"\\u00a0\"";
}
function array(value) {
    return JSON.stringify(value);
}
Equals.prototype.toString = function () {
    return this.e1.toString() + " === " + this.e2.toString();
};
Equals.prototype.assert = function () {
    var varA = getTempVarName();
    var varB = getTempVarName();
    return "var " + varA + " = " + this.e1.toString() + ";\n" + "var " + varB + " = " + this.e2.toString() + ";\n"
        + "assert.equal(" + varA + ", " + varB + ", 'Assertion error: Expected: ' + " + varA + " + ', got: ' + " + varB + ");";
};
Equals.prototype.verify = function () {
    return verify(this.assert());
};
NotEquals.prototype.toString = function () {
    return this.e1.toString() + " !== " + this.e2.toString();
};
NotEquals.prototype.assert = function () {
    return "assert.notEqual(" + this.e1.toString() + ", " + this.e2.toString()
        + ", 'Assertion error: Expected: " + this.e1.toString() + ", Actual: ' + "
        + this.e2.toString() + ");";
};
NotEquals.prototype.verify = function () {
    return verify(this.assert());
};
function joinExpression(expression) {
    return expression.toString() + ".join(',')";
}
function statement(expression, command) {
    var s = expression.toString();
    if (s.length === 0) {
        return null;
    }
    return s.substr(-1) !== ';' && s.substr(-2) !== '*/' ? s + ';' : s;
}
function assignToVariable(type, variable, expression) {
    return "/* @type " + type + " */\r\nvar " +
        variable + " = " + expression.toString();
}
function ifCondition(expression, callback) {
    return "if (" + expression.toString() + ") {\n" + callback() + "}";
}
function assertTrue(expression) {
    return "assert.strictEqual(!!" + expression.toString() + ", true"
        + ", 'Assertion error: Expected: true, got: ' + "
        + expression.toString() + " + \" [ Command: " + app.currentlyParsingCommand.toString().replace(/"/g, '\\"') + " ]\");";
}
function assertFalse(expression) {
    return "assert.strictEqual(!!" + expression.toString() + ", false"
        + ", 'Assertion error: Expected: false, got: ' + "
        + expression.toString() + " + \" [ Command: " + app.currentlyParsingCommand.toString().replace(/"/g, '\\"') + " ]\");";
}
function verify(statement) {
    return "try {\n" +
        statement + "\n" +
        "} catch (e) {\n" +
        "options.verificationErrors && options.verificationErrors.push(e.toString());\n" +
        "}";
}
function verifyTrue(expression) {
    return verify(assertTrue(expression));
}
function verifyFalse(expression) {
    return verify(assertFalse(expression));
}
RegexpMatch.prototype.toString = function () {
    return this.expression + ".match(" + string(this.pattern) + ")";
};
function waitFor(expression) {
    return "waitFor(function() {\n"
        + (expression.setup ? expression.setup() + "\n" : "")
        + "return " + expression.toString() + ";\n"
        + "}, '" + expression.toString().replace(/'/g, "\\'") + "');\n";
}
function assertOrVerifyFailure(line, isAssert) {
    return "assert.throws(" + line + ")";
}
function pause(milliseconds) {
    return "browser.sleep(" + parseInt(milliseconds, 10) + ");";
}
function echo(message) {
    return "console.log(" + xlateArgument(message) + ");";
}
function formatComment(comment) {
    /* Some people tend to write Selenium comments as JS block comments, so check if that's the case first, or we'll end up with a broken script: */
    if (comment.comment.match(/^\/\*.+\*\//))
        return comment.comment;
    return comment.comment.replace(/.+/mg, function (str) {
        return "/* " + str + " */";
    });
}
function keyVariable(key) {
    return "Keys." + key;
}
app.sendKeysMaping = {
    BKSP: "BACK_SPACE",
    BACKSPACE: "BACK_SPACE",
    TAB: "TAB",
    ENTER: "ENTER",
    SHIFT: "SHIFT",
    CONTROL: "CONTROL",
    CTRL: "CONTROL",
    ALT: "ALT",
    PAUSE: "PAUSE",
    ESCAPE: "ESCAPE",
    ESC: "ESCAPE",
    SPACE: "SPACE",
    PAGE_UP: "PAGE_UP",
    PGUP: "PAGE_UP",
    PAGE_DOWN: "PAGE_DOWN",
    PGDN: "PAGE_DOWN",
    END: "END",
    HOME: "HOME",
    LEFT: "LEFT",
    UP: "UP",
    RIGHT: "RIGHT",
    DOWN: "DOWN",
    INSERT: "INSERT",
    INS: "INSERT",
    DELETE: "DELETE",
    DEL: "DELETE",
    SEMICOLON: "SEMICOLON",
    EQUALS: "EQUALS",
    NUMPAD0: "NUMPAD0",
    N0: "NUMPAD0",
    NUMPAD1: "NUMPAD1",
    N1: "NUMPAD1",
    NUMPAD2: "NUMPAD2",
    N2: "NUMPAD2",
    NUMPAD3: "NUMPAD3",
    N3: "NUMPAD3",
    NUMPAD4: "NUMPAD4",
    N4: "NUMPAD4",
    NUMPAD5: "NUMPAD5",
    N5: "NUMPAD5",
    NUMPAD6: "NUMPAD6",
    N6: "NUMPAD6",
    NUMPAD7: "NUMPAD7",
    N7: "NUMPAD7",
    NUMPAD8: "NUMPAD8",
    N8: "NUMPAD8",
    NUMPAD9: "NUMPAD9",
    N9: "NUMPAD9",
    MULTIPLY: "MULTIPLY",
    MUL: "MULTIPLY",
    ADD: "ADD",
    PLUS: "ADD",
    SEPARATOR: "SEPARATOR",
    SEP: "SEPARATOR",
    SUBTRACT: "SUBTRACT",
    MINUS: "SUBTRACT",
    DECIMAL: "DECIMAL",
    PERIOD: "DECIMAL",
    DIVIDE: "DIVIDE",
    DIV: "DIVIDE",
    F1: "F1",
    F2: "F2",
    F3: "F3",
    F4: "F4",
    F5: "F5",
    F6: "F6",
    F7: "F7",
    F8: "F8",
    F9: "F9",
    F10: "F10",
    F11: "F11",
    F12: "F12",
    META: "META",
    COMMAND: "COMMAND"
};
// not implemented, edit late // fish
/**
 * Returns a string representing the suite for this formatter language.
 *
 * @param testSuite  the suite to format
 * @param filename   the file the formatted suite will be saved as
 */
/*function formatSuite(testSuite, filename) {
  var suiteClass = /^(\w+)/.exec(filename)[1];
  suiteClass = suiteClass[0].toUpperCase() + suiteClass.substring(1);

  var formattedSuite = "var " + suiteClass + " = { 'tests' : {}};\n";

  for (var i = 0; i < testSuite.tests.length; ++i) {
    var testClass = testSuite.tests[i].getTitle();
    formattedSuite += suiteClass + ".tests['" + testClass + "'] = require('./" + testClass + ".js');\n";
  }

  formattedSuite += "\n"
    + suiteClass + ".run = function " + suiteClass + "_run() {\n"
    + "var webdriver = require('selenium-webdriver');\n"
    + "\n"
    + "var driver = new webdriver.Builder().\n"
    + "withCapabilities(webdriver.Capabilities.firefox()).\n"
    + "build();\n"
    + 'var baseUrl = "";\n'
    + "var acceptNextAlert = true;\n"
    + "var verificationErrors = [];\n"
    + "\n"
    + "Object.keys(" + suiteClass + ".tests).forEach(function (v,k,a) {\n"
    + suiteClass + ".tests[v](webdriver, driver, baseUrl, acceptNextAlert, verificationErrors);\n"
    + "});\n"
    + "}\n"
    + "\n"
    + "module.exports = " + suiteClass + ";\n"
    + "//" + suiteClass + ".run();";

  return formattedSuite;
}*/
options = {
    showSelenese: 'false',
    defaultExtension: "js"
};
function defaultExtension() {
    return options.defaultExtension;
}
options.getHeader = function () {
    return '"use strict";\n'
        + "/* jslint node: true */\n\n"
        + "var assert = require('assert');\n\n"
        + "var browser, element, currentCommand = '', options = { timeout: " + options.timeout + ", retries: " + options.retries + ", screenshotFolder: '" + options.screenshotFolder + "', baseUrl: '" + options.baseUrl + "' };\n\n"
        + "module.exports = function ${methodName} (_browser, _options)  {\n\n"
        + "browser = _browser;\n"
        + "var acceptNextAlert = true;\n"
        + "getRuntimeOptions(_options);\n"
        + "try {\n";
};
var fs = require("fs");
var ideFunc = fs.readFileSync(__dirname + "/selenium-utils.js", "utf-8");
options.footer = "} catch(e) {\n"
    + "var failedScreenShot = options.screenshotFolder + '/Exception@' + currentCommand.replace(/\\(.+/, '') + '.png';\n"
    + "try {\n"
    + "createFolderPath(options.screenshotFolder);\n"
    + "browser.saveScreenshot(failedScreenShot);\n"
    + "} catch (e) {\n"
    + "e.message = 'Failure in Selenium command \"' + currentCommand + '\": ' + e.message + ' (Could not save screenshot after failure occured)';\n"
    + "throw e;\n"
    + "}\n"
    + "e.message = 'Failure in Selenium command \"' + currentCommand + '\": ' + e.message + ' (Screenshot was saved to ' + failedScreenShot + ')';\n"
    + "throw e;\n"
    + "}\n"
    + "\n};\n\n" + ideFunc;
/* no used in node, but should be used in selenium-ide, obsoleted
app.configForm =
        '<description>Header</description>' +
        '<textbox id="options_header" multiline="true" flex="1" rows="4"/>' +
        '<description>Footer</description>' +
        '<textbox id="options_footer" multiline="true" flex="1" rows="4"/>' +
        '<description>Indent</description>' +
        '<menulist id="options_indent"><menupopup>' +
        '<menuitem label="Tab" value="tab"/>' +
        '<menuitem label="1 space" value="1"/>' +
        '<menuitem label="2 spaces" value="2"/>' +
        '<menuitem label="3 spaces" value="3"/>' +
        '<menuitem label="4 spaces" value="4"/>' +
        '<menuitem label="5 spaces" value="5"/>' +
        '<menuitem label="6 spaces" value="6"/>' +
        '<menuitem label="7 spaces" value="7"/>' +
        '<menuitem label="8 spaces" value="8"/>' +
        '</menupopup></menulist>' +
        '<checkbox id="options_showSelenese" label="Show Selenese"/>';*/
app.name = "Node (wd-sync)";
app.testcaseExtension = ".js";
app.suiteExtension = ".js";
app.webdriver = true;
WDAPI.Driver = function () {
    this.ref = 'browser';
};
WDAPI.Driver.searchContext = function (locatorType, locator) {
    var locatorString = xlateArgument(locator);
    switch (locatorType) {
        case 'xpath':
            return 'browser.elementByXPath(' + locatorString + ')';
        case 'css':
            return 'browser.elementByCssSelector(' + locatorString + ')';
        case 'id':
            return 'browser.elementById(' + locatorString + ')';
        case 'link':
            return 'browser.elementByLinkText(' + locatorString + ')';
        case 'name':
            return 'browser.elementByName(' + locatorString + ')';
        case 'tag_name':
            return 'browser.elementByTagName(' + locatorString + ')';
    }
    throw 'Error: unknown strategy [' + locatorType + '] for locator [' + locator + ']';
};
WDAPI.Driver.prototype.back = function () {
    return this.ref + ".back()";
};
/**
 * Closing a window is safe as long as it's a popup. Closing the main window,
 * however, will break the browser object and prevent subsequent tests from
 * running as the Selenium server won't have a window to run them on. In the
 * IDE a test writer might add a close statement, and it'll work fine so long
 * as there are more tabs to spend. We safeguard against it here.
 */
WDAPI.Driver.prototype.close = function () {
    return "if (browser.windowHandles().length > 1) {\n"
        + this.ref + ".close();\n"
        + "refocusWindow();\n"
        + "}";
};
WDAPI.Driver.prototype.waitForPageToLoad = function () {
    return "waitForPageToLoad(" + this.ref + ");\n";
};
WDAPI.Driver.prototype.openWindow = function (url, name) {
    url = url ? "'" + url + "'" : "null";
    name = name ? "'" + name + "'" : "null";
    return this.ref + ".newWindow(addBaseUrl(" + url + "), " + name + ")";
};
WDAPI.Driver.prototype.selectWindow = function (name) {
    name = name ? "'" + name + "'" : "null";
    return this.ref + ".window(" + name + ")";
};
WDAPI.Driver.prototype.userCommand = function (command, target, value, locator) {
    target = '"' + ('' + target).replace(/"/g, '\\"') + '"';
    value = '"' + ('' + value).replace(/"/g, '\\"') + '"';
    return command + '(' + target + ', ' + value + ', ' + locator + ')\n';
};
WDAPI.Driver.prototype.setWindowSize = function (width, height) {
    return this.ref + '.setWindowSize(' + width + ', ' + height + ')';
};
WDAPI.Driver.prototype.focus = function (locator) {
    return 'element = ' + WDAPI.Driver.searchContext(locator.type, locator.string) + ';\n'
        + 'browser.execute("arguments[0].focus()", [element.rawElement]);\n';
};
WDAPI.Driver.prototype.keyEvent = function (locator, event, key) {
    var code = 0;
    /* If we have a key string, check if it's an escaped ASCII keycode: */
    if (typeof key === 'string') {
        var escapedASCII = key.match(/^\\+([0-9]+)$/);
        if (escapedASCII) {
            code = +escapedASCII[1];
        }
        else {
            /* Otherwise get the code: */
            code = key.charCodeAt(0);
        }
    }
    return 'keyEvent(' + WDAPI.Driver.searchContext(locator.type, locator.string) + ', "' + event + '", ' + code + ');';
};
WDAPI.Driver.prototype.dragAndDrop = function (locator, offset) {
    offset = offset.split(/[^0-9\-]+/);
    return 'element = ' + WDAPI.Driver.searchContext(locator.type, locator.string) + ';\n'
        + 'element.moveTo();\n'
        + this.ref + '.buttonDown();\n'
        + 'element.moveTo(' + offset[0] + ',' + offset[1] + ');\n'
        + this.ref + '.buttonUp();';
};
WDAPI.Driver.prototype.deleteAllCookies = function () {
    return this.ref + '.deleteAllCookies()';
};
WDAPI.Driver.prototype.captureEntirePageScreenshot = function (fileName) {
    var screenshotFolder = 'screenshots/' + app.testCaseName;
    if (typeof fileName === 'undefined' || fileName === '') {
        fileName = ('00000' + (++app.screenshotsCount)).slice(-5);
    }
    else {
        // Strip any folders and file extension that might be given with the file name from the test case:
        fileName = fileName.replace(/.+[/\\]([^/\\]+)$/, '$1').replace(/\.(png|jpg|jpeg|bmp|tif|tiff|gif)/i, '');
    }
    var screenshotFileVar = getTempVarName();
    return 'var ' + screenshotFileVar + ' = "' + fileName + '.png";\n'
        + 'createFolderPath(options.screenshotFolder);\n'
        + this.ref + '.saveScreenshot(options.screenshotFolder + "/" + ' + screenshotFileVar + ')';
};
WDAPI.Driver.prototype.findElement = function (locatorType, locator) {
    return new WDAPI.Element(WDAPI.Driver.searchContext(locatorType, locator));
};
WDAPI.Driver.prototype.findElements = function (locatorType, locator) {
    return new WDAPI.ElementList(WDAPI.Driver.searchContext(locatorType, locator).replace("element", "elements"));
};
WDAPI.Driver.prototype.getCurrentUrl = function () {
    return this.ref + ".url()";
};
WDAPI.Driver.prototype.get = function (url) {
    return this.ref + ".get(addBaseUrl(" + url + "))";
};
WDAPI.Driver.prototype.getTitle = function () {
    return this.ref + ".title()";
};
WDAPI.Driver.prototype.getAlert = function () {
    return "closeAlertAndGetItsText(acceptNextAlert);\n"
        + "acceptNextAlert = true";
};
WDAPI.Driver.prototype.chooseOkOnNextConfirmation = function () {
    return "acceptNextAlert = true";
};
WDAPI.Driver.prototype.chooseCancelOnNextConfirmation = function () {
    return "acceptNextAlert = false";
};
WDAPI.Driver.prototype.refresh = function () {
    return this.ref + ".refresh()";
};
WDAPI.Driver.prototype.eval = function (script) {
    return this.ref + ".safeEval(" + script + ")";
};
WDAPI.Element = function (ref) {
    this.ref = ref;
};
WDAPI.Element.prototype.clear = function () {
    return this.ref + ".clear()";
};
WDAPI.Element.prototype.click = function () {
    return this.ref + ".click()";
};
WDAPI.Element.prototype.getAttribute = function (attributeName) {
    return this.ref + ".getAttribute(" + xlateArgument(attributeName) + ")";
};
WDAPI.Element.prototype.getText = function () {
    return this.ref + ".text()";
};
WDAPI.Element.prototype.isDisplayed = function () {
    return this.ref + ".isDisplayed()";
};
WDAPI.Element.prototype.isSelected = function () {
    return this.ref + ".isSelected()";
};
WDAPI.Element.prototype.sendKeys = function (text) {
    return this.ref + ".sendKeys(" + xlateArgument(text) + ")";
};
WDAPI.Element.prototype.submit = function () {
    return this.ref + ".submit()";
};
WDAPI.Element.prototype.select = function (selectLocator) {
    if (selectLocator.type == 'index') {
        return this.ref + ".elementByXPath('option[" + ((parseInt(selectLocator.string) + 1) || 1) + "]').click()";
    }
    if (selectLocator.type == 'value') {
        return this.ref + ".elementByXPath('option[@value=" + xlateArgument(selectLocator.string) + "][1]').click()";
    }
    return this.ref + ".elementByXPath('option[text()=" + xlateArgument(selectLocator.string) + "][1]').click()";
};
WDAPI.ElementList = function (ref) {
    this.ref = ref;
};
WDAPI.ElementList.prototype.getItem = function (index) {
    return this.ref + "[" + index + "]";
};
WDAPI.ElementList.prototype.getSize = function () {
    return this.ref + ".length";
};
WDAPI.ElementList.prototype.isEmpty = function () {
    return "isEmptyArray(" + this.ref + ")";
};
WDAPI.Utils = function () {
};
WDAPI.Utils.isElementPresent = function (how, what) {
    return WDAPI.Driver.searchContext(how, what).replace("element", "hasElement");
};
WDAPI.Utils.isAlertPresent = function () {
    return "isAlertPresent()";
};
