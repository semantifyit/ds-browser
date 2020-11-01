class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    /**
     * Render the JSON-LD serialization of the Vocabulary.
     */
    renderShacl() {
        const preStyle = '' +
            // Overwrite schema.org CSS
            'font-size: medium; ' +
            'background: none; ' +
            'text-align: left; ' +
            'width: auto; ' +
            'padding: 0; ' +
            'overflow: visible; ' +
            'color: rgb(0, 0, 0); ' +
            'line-height: normal; ' +

            // Defaults for pre https://www.w3schools.com/cssref/css_default_values.asp
            'display: block; ' +
            'font-family: monospace; ' +
            'margin: 1em 0; ' +

            // From Browser when loading SHACL file
            'word-wrap: break-word; ' +
            'white-space: pre-wrap;';

        this.browser.elem.innerHTML = '' +
            '<pre style="' + preStyle + '">' +
            JSON.stringify(this.browser.ds, null, 2) +
            '</pre>';
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
        let name, description, breadcrumbs = '';
        if (!this.browser.path) {
            const graph = this.browser.ds['@graph'][0];
            name = graph['schema:name'];
            description = graph['schema:description'];
        } else {
            const nodeName = this.node['sh:class'];
            name = this.util.prettyPrintIri(nodeName);
            description = this.browser.sdoAdapter.getTerm(nodeName).getDescription();
            breadcrumbs = this.createBreadcrumbs();
        }
        description = this.util.repairLinksInHTMLCode(description);

        return '' +
            this.createNavigation() +
            '<h1 property="schema:name">' + name + '</h1>' +
            this.util.createExternalLinkLegend() +
            breadcrumbs +
            '<div property="schema:description">' + description + '<br><br></div>';
    }

    createBreadcrumbs() {
        return '' +
            '<h4>' +
            '<span class="breadcrumbs">' +
            this.util.createJSLink('path', null, this.browser.ds['@graph'][0]['schema:name']) +
            ' > ' +
            this.browser.path.split('-').map((term, index, pathSplitted) => {
                if (index % 2 === 0) {
                    return term;
                } else {
                    const newPath = pathSplitted.slice(0, index + 1).join('-');
                    return this.util.createJSLink('path', newPath, term);
                }
            }).join(' > ') +
            '</span>' +
            '</h4>';
    }


    createNavigation() {
        return '' +
            '<span style="float: right;">' +
            '(' +
            this.util.createJSLink('format', 'shacl', 'SHACL serialization') +
            (this.browser.list ? ' | from List: ' +
                this.util.createJSLink('ds', null, this.browser.list['schema:name']) : '') +
            ')' +
            '</span>';
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
            this.util.createLink(property.getIRI(), name) +
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
            const mappedDataType = this.util.dataTypeMapperFromSHACL(name);
            if (mappedDataType !== null) {
                html += this.util.createLink(mappedDataType);
            } else {
                name = this.util.rangesToString(name);
                const newPath = propertyName + '-' + name;
                html += this.util.createJSLink('path', newPath, name, null, '-');
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
                        this.util.createLink(enumMember.getIRI(), e) +
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
