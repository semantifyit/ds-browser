class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    render() {
        this.graph = this.browser.ds['@graph'][0];

        const mainContent = this.createHeader() + this.createPropertyTable();
        this.browser.elem.innerHTML = this.createMainContent('rdfs:Class', mainContent);

    }

    /**
     * Create a HTML div with the main content for the vocab browser element.
     *
     * @param {string} rdfaTypeOf - The RDFa type of the main content.
     * @param {string} mainContent - The HTML of the main content.
     * @returns {string} The resulting HTML.
     */
    createMainContent(rdfaTypeOf, mainContent) {
        return '' +
            '<div id="mainContent" vocab="http://schema.org/" typeof="' + rdfaTypeOf + '" ' +
            'resource="' + window.location + '">' +
            mainContent +
            '</div>';
    }


    createHeader() {
        let name, description;
        if (!this.browser.path) {
            name = this.graph['schema:name'];
            description = this.graph['schema:description'];
        } else {
            const nodeName = this.browser.dsNode.node['sh:class'];
            name = this.util.prettyPrintIri(nodeName);
            description = this.browser.sdoAdapter.getTerm(nodeName).getDescription();
        }
        description = this.util.repairLinksInHTMLCode(description);

        return '' +
            '<h1 property="schema:name">' + name + '</h1>' +
            '<div property="schema:description">' + description + '<br><br></div>';
    }

    createPropertyTable() {
        let properties;
        if (this.graph['sh:targetClass'] !== undefined) { //root node
            properties = this.graph['sh:property'].slice(0);
        } else { //nested node
            properties = this.graph['sh:node']['sh:property'].slice(0);
        }

        return '' +
            '<table class="definition-table">' +
            '<thead>' +
            '<tr>' +
            '<th>Property</th>' +
            '<th>Expected Type</th>' +
            '<th>Description</th>' +
            '<th>Cardinality</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' +
            properties.map((p) => {
                return this.createProperty(p);
            }).join('') +
            '</tbody>' +
            '</table>'
    }

    createProperty(propertyNode) {
        const name = this.util.prettyPrintIri(propertyNode['sh:path']);
        const expectedTypes = this.createExpectedTypes(name, propertyNode['sh:or']);
        const cardinalityCode = this.createCardinality(propertyNode);
        return '' +
            '<tr class="removable">' +
            '<th class="prop-nam">' +
            '<code property="rdfs:label">' +
            this.util.repairLinksInHTMLCode('<a href="' + this.util.makeURLFromIRI(propertyNode['sh:path']) + '">' +
                name + '</a>') +
            '</code>' +
            '</th>' +
            '<td class="prop-ect" style="text-align: center; vertical-align: middle;">' + expectedTypes + '</td>' +
            '<td class="prop-desc">' + this.createPropertyDescText(propertyNode) + '</td>' +
            '<td class="prop-ect" style="text-align: center; vertical-align: middle;">' + cardinalityCode + '</td>' +
            '</tr>';
    }

    createPropertyDescText(propertyNode) {
        const name = this.util.prettyPrintIri(propertyNode['sh:path']);
        let description = '';
        try { description = this.browser.sdoAdapter.getProperty(name).getDescription(); } catch (e) {}
        const dsDescription = (propertyNode['rdfs:comment'] ? propertyNode['rdfs:comment'] : '');

        let descText = '';
        if (description !== '') {
            if (dsDescription !== '') {
                descText += '<b>From Vocabulary:</b> ';
            }
            descText += description;
        }
        if (dsDescription !== '') {
            if (description !== '') {
                descText += '<br>' +
                    '<b>From Domain Specification:</b> ';
            }
            descText += dsDescription;
        }
        return this.util.repairLinksInHTMLCode(descText);
    }

    createExpectedTypes(propertyName, expectedTypes) {
        let html = '';
        expectedTypes.forEach((expectedType) => {
            let name;
            if (expectedType['sh:datatype']) {
                name = expectedType['sh:datatype'];
            } else if (expectedType['sh:class']) {
                name = expectedType['sh:class'];
            }
            if (this.util.dataTypeMapperFromSHACL(name) !== null) {
                html += this.util.repairLinksInHTMLCode('<a href="/' + this.util.dataTypeMapperFromSHACL(name) + '">' +
                    this.util.dataTypeMapperFromSHACL(name) + '</a>');
            } else {
                name = this.util.rangesToString(name);
                const newPath = propertyName + '-' + name;
                html += this.util.createJSLink('path', newPath, '-', name);
            }
            html += '<br>';
        });
        return html;
    }

    createCardinality(dsPropertyNode) {
        const minCount = dsPropertyNode['sh:minCount'];
        const maxCount = dsPropertyNode['sh:maxCount'];
        let title, cardinality = '';

        if (minCount && minCount !== 0) {
            if (maxCount && maxCount !== 0) {
                if (minCount !== maxCount) {
                    title = 'This property is required. It must have between ' + minCount + ' and ' + maxCount +
                        ' value(s).';
                    cardinality = minCount + ".." + maxCount;
                } else {
                    title = 'This property is required. It must have ' + minCount + ' value(s).';
                    cardinality = minCount;
                }
            } else {
                title = 'This property is required. It must have at least ' + minCount + ' value(s).';
                cardinality = minCount + '..N';
            }
        } else {
            if (maxCount && maxCount !== 0) {
                title = 'This property is optional. It must have at most ' + maxCount + ' value(s).';
                cardinality = '0..' + maxCount;
            } else {
                title = 'This property is optional. It may have any amount of values.';
                cardinality = '0..N';
            }
        }

        return '<span title="' + title + '">' + cardinality + '</span>';
    }
}

module.exports = DSRenderer;
