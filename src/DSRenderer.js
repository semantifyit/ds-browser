class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = this.browser.util;
    }

    render() {
        const html = '' +
            '<h1 property="schema:name">' + this.browser.ds['@graph'][0]['schema:name'] + '</h1>' +
            '<div property="schema:description">' + this.browser.ds['@graph'][0]['schema:description'] + '</div>';
        this.browser.elem.innerHTML = html;
    }
}

module.exports = DSRenderer;
