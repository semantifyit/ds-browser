const formatHighlight = require("json-format-highlight");

// Renders the DS directly as JSON-LD (raw object). Some custom CSS added to increase the readability
class SHACLView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // renders (creates and appends) this view
  render() {
    // the SHACL code for the DS is preprocessed with a library to highlight parts of the JSON syntax
    const preContent = formatHighlight(this.b.ds, {
      keyColor: "black",
      numberColor: "#3A01DC",
      stringColor: "#DF0002",
      trueColor: "#C801A4",
      falseColor: "#C801A4",
      nullColor: "cornflowerblue",
    });
    // creates the html code for this view
    let viewHtml = this.getFrame();
    viewHtml = viewHtml.replace(/{{preContent}}/g, preContent);
    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = viewHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="shacl-view" class="noNav" >
      <pre style="
        font-size: large;
        text-align: left;
        width: auto;
        background-color: whitesmoke;
        padding: 15px 20px;
        margin: 0;
        overflow: visible;
        line-height: normal;
        display: block;
        font-family: monospace;
        word-wrap: break-word;
        white-space: pre-wrap;
        ">{{preContent}}</pre>
    </div>`;
  }
}

module.exports = SHACLView;
