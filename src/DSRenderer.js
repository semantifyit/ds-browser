class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    render() {
        // Cannot be in constructor, cause at this time the node is not initialized
        this.dsNode = this.browser.dsNode;
        this.node = this.dsNode.node;

        const mainContent = this.createHeader() +
            (this.dsNode.type === 'Class' ? this.createClassPropertyTable() : this.createEnumerationMembers());
        this.browser.elem.innerHTML = this.util.createMainContent('rdfs:Class', mainContent);
    }

    createHeader() {
        let name, description;
        if (!this.browser.path) {
            const graph = this.browser.ds['@graph'][0];
            name = graph['schema:name'];
            description = graph['schema:description'];
        } else {
            const nodeName = this.node['sh:class'];
            name = this.util.prettyPrintIri(nodeName);
            description = this.browser.sdoAdapter.getTerm(nodeName).getDescription();
        }
        description = this.util.repairLinksInHTMLCode(description);

        return '' +
            '<h1 property="schema:name">' + name + '</h1>' +
            '<div property="schema:description">' + description + '<br><br></div>';
    }

    createClassPropertyTable() {
        let properties;
        if (!this.browser.path) {
            properties = this.node['sh:property'].slice(0);
        } else {
            properties = this.node['sh:node']['sh:property'].slice(0);
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
                return this.createClassProperty(p);
            }).join('') +
            '</tbody>' +
            '</table>'
    }

    createClassProperty(propertyNode) {
        const property = this.browser.sdoAdapter.getProperty(propertyNode['sh:path']);
        const name = this.util.prettyPrintIri(property.getIRI(true));
        const expectedTypes = this.createExpectedTypes(name, propertyNode['sh:or']);
        const cardinalityCode = this.createCardinality(propertyNode);

        return '' +
            '<tr>' +
            '<th class="prop-nam" scope="row">' +
            '<code property="rdfs:label">' +
            this.util.repairLinksInHTMLCode('<a href="' + property.getIRI() + '">' + name + '</a>') +
            '</code>' +
            '</th>' +
            '<td class="prop-ect">' + expectedTypes + '</td>' +
            '<td class="prop-desc">' + this.createClassPropertyDescText(propertyNode) + '</td>' +
            '<td class="prop-ect">' + cardinalityCode + '</td>' +
            '</tr>';
    }

    createClassPropertyDescText(propertyNode) {
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

    /**
     * Create HTML for the enumeration members of the Enumeration.
     *
     * @returns {string} The resulting HTML.
     */
    createEnumerationMembers() {
        const enumMembers = this.browser.sdoAdapter.getTerm(this.node['sh:class']).getEnumerationMembers();
        if (enumMembers.length !== 0) {
            return '' +
                'An Enumeration with:<br>' +
                '<b>' +
                '<a id="enumbers" title="Link: #enumbers" href="#enumbers" class="clickableAnchor">' +
                'Enumeration members' +
                '</a>' +
                '</b>' +
                '<ul>' +
                enumMembers.map((e) => {
                    const enumMember = this.browser.sdoAdapter.getEnumerationMember(e);
                    return '' +
                        '<li>' +
                        this.util.repairLinksInHTMLCode(
                            '<a href="' + enumMember.getIRI() + '">' + this.util.prettyPrintIri(e) + '</a>'
                        ) +
                        '</li>';
                }).join('') +
                '</ul>' +
                '<br>';
        } else {
            return '';
        }
    }
}

module.exports = DSRenderer;
