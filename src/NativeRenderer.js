class NativeRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
    }

    render() {
    // cannot be in constructor, cause at this time the node is not initialized
        this.dsNode = this.browser.dsNode;
        this.node = this.dsNode.node;

        const mainContent = this.dsRenderer.createHtmlHeader() +
      this.dsRenderer.createViewModeSelectors(this.dsRenderer.MODES.native) +
      (this.dsNode.type === "Class" ? this.createHtmlPropertiesTable() : this.createHTMLEnumerationMembersTable());

        this.browser.targetElement.innerHTML = this.util.createHtmlMainContent("rdfs:Class", mainContent);
    }

    createHTMLEnumerationMembersTable() {
        let enumerationValues = this.node["sh:in"].slice(0);
        const trs = enumerationValues.map((ev) => {
            return this.createHTMLEnumerationMemberRow(ev);
        }).join("");
        return this.util.createHtmlDefinitionTable(
            ["Enumeration Member", "Description"],
            trs,
            { "style": "margin-top: 0px; border-top: none;" }
        );
    }

    createHTMLEnumerationMemberRow(ev) {
        const evObj = this.browser.sdoAdapter.getEnumerationMember(ev["@id"]);
        return this.util.createHtmlTableRow("rdfs:Class",
            evObj.getIRI(),
            "rdfs:label",
            this.util.createTermLink(ev["@id"]),
            this.createHTMLEnumerationMemberDescription(evObj)
        );
    }

    createHTMLEnumerationMemberDescription(evObj) {
        let htmlDesc = this.util.repairLinksInHTMLCode(evObj.getDescription());
        return `<td className="prop-desc">${htmlDesc}</td>`;
    }

    createHtmlPropertiesTable() {
        let properties;
        properties = this.node["sh:property"].slice(0);
        const trs = properties.map((p) => {
            return this.createClassProperty(p);
        }).join("");
        return this.util.createHtmlDefinitionTable(
            ["Property", "Expected Type", "Description", "Cardinality"],
            trs,
            { "style": "margin-top: 0px; border-top: none;" }
        );
    }

    createClassProperty(propertyNode) {
        const path = propertyNode["sh:path"];
        const property = this.browser.sdoAdapter.getProperty(path);

        return this.util.createHtmlTableRow("rdf:Property",
            property.getIRI(),
            "rdfs:label",
            this.util.createTermLink(path),
            this.createClassPropertySideCols(propertyNode),
            "prop-name"
        );
    }

    createClassPropertySideCols(node) {
        const htmlExpectedTypes = this.createHtmlExpectedTypes(node);
        const htmlPropertyDesc = this.createHtmlPropertyDescription(node);
        const htmlCardinality = this.dsHandler.createHtmlCardinality(node["sh:minCount"], node["sh:maxCount"]);
        return `<td class="prop-ect">${htmlExpectedTypes}</td>
            <td class="prop-desc">${htmlPropertyDesc}</td>
            <td class="prop-ect" style="text-align: center">${htmlCardinality}</td>`;
    }

    createHtmlPropertyDescription(propertyNode) {
        const name = this.util.prettyPrintIri(propertyNode["sh:path"]);
        let description;
        try {
            description = this.browser.sdoAdapter.getProperty(name).getDescription();
        } catch (e) {
            description = "";
        }
        const dsDescription = (propertyNode["rdfs:comment"] ? this.util.getLanguageString(propertyNode["rdfs:comment"]) : "");

        let descText = "";
        if (description !== "") {
            if (dsDescription !== "") {
                descText += "<b>From Vocabulary:</b> ";
            }
            descText += description;
        }
        if (dsDescription !== "") {
            if (description !== "") {
                descText += "<br>" +
          "<b>From Domain Specification:</b> ";
            }
            descText += dsDescription;
        }
        return this.util.repairLinksInHTMLCode(descText);
    }

    createHtmlExpectedTypes(propertyNode) {
        const property = this.browser.sdoAdapter.getProperty(propertyNode["sh:path"]);
        const propertyName = this.util.prettyPrintIri(property.getIRI(true));
        return propertyNode["sh:or"].map((rangeNode) => {
            let name;
            let classNode = this.util.getClassNodeIfExists(rangeNode);
            if (rangeNode["sh:datatype"]) {
                name = rangeNode["sh:datatype"];
            } else if (classNode && classNode["sh:class"]) {
                name = classNode["sh:class"];
            }
            const mappedDataType = this.dsHandler.dataTypeMapperFromSHACL(name);
            if (mappedDataType !== null) {
                let specialName = null;
                if (name === "rdf:langString") {
                    specialName = "Localized Text";
                } else if (name === "rdf:HTML") {
                    specialName = "HTML Text";
                }
                return this.util.createLink(mappedDataType, specialName);
            } else {
                name = this.dsHandler.rangesToString(name);
                if (classNode && Array.isArray(classNode["sh:property"]) && classNode["sh:property"].length !== 0) {
                    // Case: Range is a Restricted Class
                    const newPath = this.browser.path ? this.browser.path + "-" + propertyName + "-" + name : propertyName + "-" + name;
                    return this.util.createInternalLink({ path: newPath }, name);
                } else if (classNode && classNode["sh:class"] && Array.isArray(classNode["sh:in"])) {
                    // Case: Range is a Restricted Enumeration
                    const newPath = this.browser.path ? this.browser.path + "-" + propertyName + "-" + name : propertyName + "-" + name;
                    return this.util.createInternalLink({ path: newPath }, name);
                } else {
                    // Case: Anything else
                    return this.util.createTermLink(name);
                }
            }
        }).join("<br>");
    }
}

module.exports = NativeRenderer;