const NavigationBar = require("./templates/NavigationBar.js");

class SharedFunctions {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // creates the HTML code for the navigation bar
  getNavigationBarHTML() {
    // List button (show only if a list exists and a DS is currently being shown)
    let listName, listBtnClass, listBtnAttributes;
    if (this.b.listId && this.b.dsId) {
      listBtnClass = "";
      if (this.b.list) {
        listName = this.b.list["schema:name"] || "List";
      }
      listBtnAttributes = this.b.util.createInternalLinkAttributes({
        dsId: null,
      });
    } else {
      listBtnClass = "d-none";
      listBtnAttributes = "";
    }
    // View buttons
    let nativeViewBtnAttributes, nativeViewBtnClass;
    let treeViewBtnAttributes, treeViewBtnClass;
    let shaclViewBtnAttributes, shaclViewBtnClass;
    if (this.b.dsId) {
      nativeViewBtnClass = treeViewBtnClass = "";
      shaclViewBtnClass = "d-sm-flex";
      nativeViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        viewMode: null,
      });
      treeViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        viewMode: "tree",
      });
      shaclViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        format: "shacl",
      });
    } else {
      nativeViewBtnClass = treeViewBtnClass = shaclViewBtnClass = "d-none";
      nativeViewBtnAttributes =
        treeViewBtnAttributes =
        shaclViewBtnAttributes =
          "";
    }
    return NavigationBar.replace(/{{listBtnClass}}/g, listBtnClass)
      .replace(/{{listBtnAttributes}}/g, listBtnAttributes)
      .replace(/{{listName}}/g, listName)
      .replace(/{{nativeViewBtnClass}}/g, nativeViewBtnClass)
      .replace(/{{nativeViewBtnAttributes}}/g, nativeViewBtnAttributes)
      .replace(/{{treeViewBtnClass}}/g, treeViewBtnClass)
      .replace(/{{treeViewBtnAttributes}}/g, treeViewBtnAttributes)
      .replace(/{{shaclViewBtnClass}}/g, shaclViewBtnClass)
      .replace(/{{shaclViewBtnAttributes}}/g, shaclViewBtnAttributes);
  }

  setDsTitleHtml(htmlCode) {
    const rootNode = this.b.dsRootNode;
    const ds = this.b.ds;

    // set ds name in title
    htmlCode = htmlCode.replace(
      /{{dsTitleName}}/g,
      this.b.dsUtil.getDsName(ds)
    );

    // schema:description
    htmlCode = htmlCode.replace(
      /{{dsDescription}}/g,
      this.b.dsUtil.getDsDescription(ds)
    );
    // @id
    htmlCode = htmlCode.replace(/{{dsId}}/g, rootNode["@id"]);
    // sh:targetClass
    const htmlTargetClasses = rootNode["sh:targetClass"]
      .map((c) => {
        return "<li>" + this.b.util.createTermLink(c) + "</li>";
      })
      .join("");
    htmlCode = htmlCode.replace(/{{dsTargetClasses}}/g, htmlTargetClasses);
    // ds:subDSOf
    if (rootNode["ds:subDSOf"]) {
      htmlCode = htmlCode.replace(/{{showSuperDs}}/g, "");
      htmlCode = htmlCode.replace(/{{dsSuperDs}}/g, rootNode["ds:subDSOf"]);
    } else {
      htmlCode = htmlCode.replace(/{{showSuperDs}}/g, "d-none");
      htmlCode = htmlCode.replace(/{{dsSuperDs}}/g, "");
    }
    // schema:schemaVersion
    htmlCode = htmlCode.replace(
      /{{dsSdoVersion}}/g,
      this.b.dsUtil.getDsSchemaVersion(ds)
    );
    // ds:usedVocabulary
    if (rootNode["ds:usedVocabulary"]) {
      htmlCode = htmlCode.replace(/{{showExternalVocabularies}}/g, "");
      const htmlExternalVocabs = rootNode["ds:usedVocabulary"]
        .map((v) => {
          return `<li><a href="${v}" target="_blank">${v}</a></li>`;
        })
        .join("");
      htmlCode = htmlCode.replace(
        /{{dsExternalVocabularies}}/g,
        htmlExternalVocabs
      );
    } else {
      htmlCode = htmlCode.replace(/{{showExternalVocabularies}}/g, "d-none");
      htmlCode = htmlCode.replace(/{{dsExternalVocabularies}}/g, "");
    }
    return htmlCode;
  }
}

module.exports = SharedFunctions;
