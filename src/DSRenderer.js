class DSRenderer {
  constructor(browser) {
    this.browser = browser;
    this.util = browser.util;
    this.dsHandler = browser.dsHandler;
    this.MODES = {
      native: "native",
      tree: "tree",
    };
  }

  createViewModeSelectors(selected = this.MODES.native) {
    return (
      "" +
      '<div class="ds-selector-tabs ds-selector">' +
      '<div class="selectors">' +
      (selected === this.MODES.native
        ? '<a class="selected">Native View</a>'
        : this.util.createInternalLink({ viewMode: null }, "Native View")) +
      (selected === this.MODES.tree
        ? '<a class="selected">Tree View</a>'
        : this.util.createInternalLink({ viewMode: "tree" }, "Tree View")) +
      "</div>" +
      "</div>"
    );
  }

  createHtmlHeader() {
    this.dsNode = this.browser.dsNode;
    this.node = this.dsNode.node;

    let name,
      description,
      breadcrumbs = "";
    if (!this.browser.path) {
      const graph = this.browser.ds["@graph"][0];
      name =
        this.util.getLanguageString(graph["schema:name"]) ||
        "Domain Specification";
      description =
        this.util.getLanguageString(graph["schema:description"]) || "";
    } else {
      const nodeClass = this.node["sh:class"];
      name = this.dsHandler.rangesToString(nodeClass);
      description = this.createNodeDescription(nodeClass);
      breadcrumbs = this.createBreadcrumbs();
    }
    description = this.util.repairLinksInHTMLCode(description);

    return (
      "" +
      this.createNavigation() +
      '<h1 property="schema:name">' +
      name +
      "</h1>" +
      this.util.createHtmlExternalLinkLegend() +
      breadcrumbs +
      '<div property="schema:description">' +
      description +
      "<br><br></div>"
    );
  }

  createNodeDescription(nodeClass) {
    if (!nodeClass) {
      return "";
    } else if (nodeClass.length === 1) {
      return this.browser.sdoAdapter.getTerm(nodeClass[0]).getDescription();
    } else {
      return nodeClass
        .map((c) => {
          return (
            "" +
            "<b>" +
            this.util.prettyPrintIri(c) +
            ":</b> " +
            this.browser.sdoAdapter.getTerm(c).getDescription()
          );
        })
        .join("<br>");
    }
  }

  createBreadcrumbs() {
    const htmlFirstBreadcrumb = this.util.createInternalLink(
      { path: null },
      this.util.getLanguageString(this.browser.dsRootNode["schema:name"]) ||
        "Domain Specification"
    );
    const htmlBreadcrumbs = this.browser.path
      .split("-")
      .map((term, index, pathSplit) => {
        if (index % 2 === 0) {
          return term;
        } else {
          const newPath = pathSplit.slice(0, index + 1).join("-");
          return this.util.createInternalLink({ path: newPath }, term);
        }
      })
      .join(" > ");
    return `<h4><span class="breadcrumbs">
            ${htmlFirstBreadcrumb} > ${htmlBreadcrumbs}
            </span></h4>`;
  }

  // todo delete
  createNavigation() {
    let shaclLink;
    const dsId = this.browser.dsId;
    if (this.browser.locationControl) {
      shaclLink = this.util.createInternalLink(
        { format: "shacl" },
        "SHACL serialization"
      );
    } else {
      shaclLink = `<a href="https://semantify.it/ds/${dsId}?format=shacl" target="_blank">SHACL serialization</a>`;
    }
    const listHtml = this.browser.list
      ? " | from List: " +
        this.util.createInternalLink(
          {
            dsId: null,
            path: null,
          },
          this.browser.list["schema:name"]
        )
      : "";
    return `<span style="float: right;">(${shaclLink}${listHtml})</span>`;
  }

  createVisBtnRow() {
    return `<div id="btn-row" style="padding: 12px 0px 12px 5px; font-size: 14px; line-height: 1.42857143; color: #333;">Show: 
            <span id="btn-opt" class="btn-vis btn-vis-shadow" style="margin-left: 10px; padding: 5px;">
                <img src="" class="glyphicon glyphicon-tag optional-property"> optional
            </span>
            <span id="btn-man" class="btn-vis" style="margin-left: 10px; padding: 5px;">
                <img src="" class="glyphicon glyphicon-tag mandatory-property"> mandatory
            </span></div>`;
  }
}

module.exports = DSRenderer;
