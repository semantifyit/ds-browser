const DSTitleFrame = require("../templates/DsTitle.js");
const NativeTableClassHeader = require("../templates/NativeTableClassHeader.js");
const NativeTableClassRow = require("../templates/NativeTableClassRow.js");
const NativeTableEnumerationHeader = require("../templates/NativeTableEnumerationHeader.js");
const NativeTableEnumerationRow = require("../templates/NativeTableEnumerationRow.js");

class NativeView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // renders (creates and appends) this view
  render() {
    // creates the html code for this view
    let nativeHtml = this.getFrame();

    // set html for navigationBar
    nativeHtml = nativeHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set ds title
    nativeHtml = this.b.sharedFunctions.setDsTitleHtml(nativeHtml);

    // set ds path breadcrumbs
    nativeHtml = nativeHtml.replace(
      /{{dsPathBreadcrumbs}}/g,
      this.getDsPathBreadcrumbsHTML()
    );

    // set table based on node type
    if (this.b.dsNode.type === "Class") {
      // todo what if standard class ? no sh:property
      nativeHtml = nativeHtml.replace(/{{tableHead}}/g, NativeTableClassHeader);
      const tableBodyHtml =
        "<tbody>" +
        this.b.dsNode.node["sh:property"]
          .map((p) => {
            return this.getPropertyRowHTML(p);
          })
          .join("") +
        "</tbody>";
      nativeHtml = nativeHtml.replace(/{{tableBody}}/g, tableBodyHtml);
    } else {
      // todo what if standard enumeration ? no sh:in
      nativeHtml = nativeHtml.replace(
        /{{tableHead}}/g,
        NativeTableEnumerationHeader
      );
      const tableBodyHtml =
        "<tbody>" +
        this.b.dsNode.node["sh:in"]
          .map((em) => {
            return this.getEnumerationMemberRowHTML(em);
          })
          .join("") +
        "</tbody>";
      nativeHtml = nativeHtml.replace(/{{tableBody}}/g, tableBodyHtml);
    }
    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = nativeHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="native-view" class="withNav">
      <!--Navigation Bar-->
      {{navigationBar}}
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        ${DSTitleFrame}
        <!--Breadcrumbs for DS Path-->
        <div class="card my-3 shadow-2">
          <div class="card-body d-flex p-2 align-items-center">
            <div title="Current path within the Domain Specification" class="align-items-center px-2">
              <span><i class="fas fa-code-branch"></i></span>
            </div>
            <div id="native-path" class="align-items-center">{{dsPathBreadcrumbs}}</div>
          </div>
        </div>
        <!--Table for DS node Content  -->
        <table id="native-table" class="table bg-light rounded shadow-2">
          {{tableHead}}
          {{tableBody}}
        </table>
      </div>
    </div>`;
  }

  // returns the html for the ds path breadcrumbs
  getDsPathBreadcrumbsHTML() {
    // create first step of the breadcrumbs (always visible), which is the class of the root node
    let htmlBreadcrumbs = this.b.util.createInternalLink(
      { path: null },
      this.b.dsHandler.rangesToString(this.b.dsRootNode["sh:targetClass"])
    );
    // add additional steps for the breadcrumbs if needed (given by the actual path within the ds)
    if (this.b.path) {
      htmlBreadcrumbs =
        htmlBreadcrumbs +
        " > " +
        this.b.path
          .split("-")
          .map((term, index, pathSplit) => {
            if (index % 2 === 0) {
              // property term
              return term;
            } else {
              // class/enumeration term
              const newPath = pathSplit.slice(0, index + 1).join("-");
              return this.b.util.createInternalLink({ path: newPath }, term);
            }
          })
          .join(" > ");
    }
    return ` <span class="breadcrumbs">${htmlBreadcrumbs}</span>`;
  }

  // returns the html for a property table row
  getPropertyRowHTML(p) {
    let isFromSuperDS = this.isPropertyFromSuperDs(p);
    let iconsHtml = "";
    if (isFromSuperDS) {
      iconsHtml = ` <i class="fas fa-angle-double-down" title="This property originates from the Super-DS"></i>`;
    }
    const propertyLink = this.b.util.createTermLink(p["sh:path"]) + iconsHtml;
    const expectedType = this.createHtmlExpectedTypes(p);
    const details = this.createHtmlPropertyDescription(p);
    const cardinality = this.b.dsHandler.createHtmlCardinality(
      p["sh:minCount"],
      p["sh:maxCount"]
    );
    return NativeTableClassRow.replace(/{{property}}/g, propertyLink)
      .replace(/{{cardinality}}/g, cardinality)
      .replace(/{{expectedType}}/g, expectedType)
      .replace(/{{details}}/g, details);
  }

  isPropertyFromSuperDs(p) {
    // properties from a super ds are only considered for the root node
    // if there is no unpopulated version of the DS it means the DS was not DS-V7 in the first place (no superDS feature)
    if (this.b.path !== null || !this.b.dsUnpopulated) {
      return false;
    }
    const rootNode = this.b.dsUtil.getDsRootNode(this.b.dsUnpopulated);
    const unpopulatedPropertyNode = rootNode["sh:property"].find(
      (propNode) => propNode["sh:path"] === p["sh:path"]
    );
    return unpopulatedPropertyNode !== undefined;
  }

  // returns the html for a enumeration member table row
  getEnumerationMemberRowHTML(em) {
    const emObj = this.b.sdoAdapter.getEnumerationMember(em["@id"]);
    const enumerationMemberLink = this.b.util.createTermLink(em["@id"]);
    const details = this.b.util.repairLinksInHTMLCode(emObj.getDescription());
    return NativeTableEnumerationRow.replace(
      /{{enumerationMember}}/g,
      enumerationMemberLink
    ).replace(/{{details}}/g, details);
  }

  createHtmlExpectedTypes(propertyNode) {
    const property = this.b.sdoAdapter.getProperty(propertyNode["sh:path"]);
    const propertyName = this.b.util.prettyPrintIri(property.getIRI(true));
    return propertyNode["sh:or"]
      .map((rangeNode) => {
        let name;
        let classNode = this.b.util.getClassNodeIfExists(rangeNode);
        if (rangeNode["sh:datatype"]) {
          name = rangeNode["sh:datatype"];
        } else if (classNode && classNode["sh:class"]) {
          name = classNode["sh:class"];
        }
        const mappedDataType = this.b.dsHandler.dataTypeMapperFromSHACL(name);
        if (mappedDataType !== null) {
          let specialName = null;
          if (name === "rdf:langString") {
            specialName = "Localized Text";
          } else if (name === "rdf:HTML") {
            specialName = "HTML Text";
          }
          return this.b.util.createLink(mappedDataType, specialName);
        } else {
          name = this.b.dsHandler.rangesToString(name);
          if (
            classNode &&
            Array.isArray(classNode["sh:property"]) &&
            classNode["sh:property"].length !== 0
          ) {
            // Case: Range is a Restricted Class
            const newPath = this.b.path
              ? this.b.path + "-" + propertyName + "-" + name
              : propertyName + "-" + name;
            return this.b.util.createInternalLink({ path: newPath }, name);
          } else if (
            classNode &&
            classNode["sh:class"] &&
            Array.isArray(classNode["sh:in"])
          ) {
            // Case: Range is a Restricted Enumeration
            const newPath = this.b.path
              ? this.b.path + "-" + propertyName + "-" + name
              : propertyName + "-" + name;
            return this.b.util.createInternalLink({ path: newPath }, name);
          } else {
            // Case: Anything else
            return this.b.util.createTermLink(name);
          }
        }
      })
      .join("<br>");
  }

  createHtmlPropertyDescription(propertyNode) {
    const name = this.b.util.prettyPrintIri(propertyNode["sh:path"]);
    let description;
    try {
      description = this.b.sdoAdapter.getProperty(name).getDescription();
    } catch (e) {
      description = "";
    }
    const dsDescription = propertyNode["rdfs:comment"]
      ? this.b.util.getLanguageString(propertyNode["rdfs:comment"])
      : "";

    let descText = "";
    if (description !== "") {
      if (dsDescription !== "") {
        descText += "<b>From Vocabulary:</b> ";
      }
      descText += description;
    }
    if (dsDescription !== "") {
      if (description !== "") {
        descText += "<br>" + "<b>From Domain Specification:</b> ";
      }
      descText += dsDescription;
    }
    return this.b.util.repairLinksInHTMLCode(descText);
  }
}

module.exports = NativeView;
