class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = this.browser.util;
    }

    render() {
        this.browser.elem.innerHTML = "Test";
    }
}

module.exports = DSRenderer;
