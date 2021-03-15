class SHACLRenderer {
    constructor(browser) {
        this.browser = browser;
    }

    renderSHACL() {
        this.browser.targetElement.innerHTML = this.createHtmlShacl(
            JSON.stringify(this.browser.ds, null, 2)
        );
    }

    createHtmlShacl(dsJson) {
        const preStyle = `font-size: medium; /* Overwrite schema.org CSS */
            background: none;
            text-align: left;
            width: auto;
            padding: 0;
            overflow: visible;
            color: rgb(0, 0, 0);
            line-height: normal;
            display: block;     /* Defaults for pre https://www.w3schools.com/cssref/css_default_values.asp */
            font-family: monospace;
            margin: 1em 0;
            word-wrap: break-word;  /* From Browser when loading SHACL file */
            white-space: pre-wrap;`;
        return `<pre style="` + preStyle + `">${dsJson}</pre>`;
    }
}

module.exports = SHACLRenderer;