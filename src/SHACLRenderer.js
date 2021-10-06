const formatHighlight = require("json-format-highlight");

// Renders the DS directly as JSON-LD (raw object). Some custom CSS added to increase the readability
class SHACLRenderer {
  constructor(browser) {
    this.browser = browser;
  }

  render() {
    const preStyle = `font-size: large;
            text-align: left;
            width: auto;
            padding: 10px 20px;
            margin: 20px; 
            overflow: visible;
            line-height: normal;
            display: block;
            font-family: monospace;
            word-wrap: break-word;
            white-space: pre-wrap;`;
    const customColorOptions = {
      keyColor: "black",
      numberColor: "#3A01DC",
      stringColor: "#DF0002",
      trueColor: "#C801A4",
      falseColor: "#C801A4",
      nullColor: "cornflowerblue",
    };
    // replace the iFrame since this view is expected to be a whole-pager anyway (there is little sense in having this SHACL output rendered in an iFrame. If location-control is not active, then the SHACL view is a new tab redirecting to the semantify SHACL view
    this.browser.targetElement.innerHTML =
      `<pre style="` +
      preStyle +
      `">${formatHighlight(this.browser.ds, customColorOptions)}</pre>`;
  }
}

module.exports = SHACLRenderer;
