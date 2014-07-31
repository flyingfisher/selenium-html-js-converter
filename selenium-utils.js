function isElementPresent(driver, by) {
    try {
        driver.findElement(by);
        return true;
    } catch (e) {
        return false;
    }
}

function isAlertPresent(driver) {
    try {
        driver.switchTo().alert();
        return true;
    } catch (e) {
        return false;
    }
}

function closeAlertAndGetItsText(driver, acceptNextAlert) {
    try {
        var alert = driver.switchTo().alert();
        var alertText = alert.getText();
        if (acceptNextAlert) {
            alert.accept();
        } else {
            alert.dismiss();
        }
        return alertText;
    } catch (ignore) {}
}
//
//module.exports.isElementPresent = isElementPresent;
//module.exports.isAlertPresent = isAlertPresent;
//module.exports.closeAlertAndGetItsText = closeAlertAndGetItsText;
