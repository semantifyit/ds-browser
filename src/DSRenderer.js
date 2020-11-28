class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
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
            name = graph['schema:name'] || 'Domain Specification';
            description = graph['schema:description'] || '';
        } else {
            const nodeClass = this.node['sh:class'];
            name = this.dsHandler.rangesToString(nodeClass);
            description = this.createNodeDescription(nodeClass);
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

    createNodeDescription(nodeClass) {
        if (this.util.isString(nodeClass)) {
            return this.browser.sdoAdapter.getTerm(nodeClass).getDescription();
        } else {
            return nodeClass.map((c) => {
                return '' +
                    '<b>' + this.util.prettyPrintIri(c) + ':</b> ' +
                    this.browser.sdoAdapter.getTerm(c).getDescription();
            }).join('<br>');
        }
    }

    createBreadcrumbs() {
        return '' +
            '<h4>' +
            '<span class="breadcrumbs">' +
            this.util.createJSLink('path', null, this.browser.ds['@graph'][0]['schema:name'] || 'Domain Specification') +
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

        const trs = properties.map((p) => {
            return this.createClassProperty(p);
        }).join('');
        return this.util.createDefinitionTable(['Property', 'Expected Type', 'Description', 'Cardinality'], trs);
    }

    createClassProperty(propertyNode) {
        const path = propertyNode['sh:path'];
        const property = this.browser.sdoAdapter.getProperty(path);

        return this.util.createTableRow('rdf:Property',
            property.getIRI(),
            'rdfs:label',
            this.util.createTermLink(path),
            this.createClassPropertySideCols(propertyNode),
            'prop-name'
        )
    }

    createClassPropertySideCols(propertyNode) {
        return '' +
            '<td class="prop-ect">' + this.createExpectedTypes(propertyNode) + '</td>' +
            '<td class="prop-desc">' + this.createClassPropertyDescText(propertyNode) + '</td>' +
            '<td class="prop-ect">' + this.createCardinality(propertyNode) + '</td>';
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

    createExpectedTypes(propertyNode) {
        const property = this.browser.sdoAdapter.getProperty(propertyNode['sh:path']);
        const propertyName = this.util.prettyPrintIri(property.getIRI(true));
        const expectedTypes = propertyNode['sh:or'];
        return expectedTypes.map((expectedType) => {
            let name;
            if (expectedType['sh:datatype']) {
                name = expectedType['sh:datatype'];
            } else if (expectedType['sh:class']) {
                name = expectedType['sh:class'];
            }
            const mappedDataType = this.dsHandler.dataTypeMapperFromSHACL(name);
            if (mappedDataType !== null) {
                return this.util.createLink(mappedDataType);
            } else {
                name = this.dsHandler.rangesToString(name);
                if (expectedType['sh:node'] && expectedType['sh:node']['sh:property'].length !== 0) {
                    const newPath = propertyName + '-' + name;
                    return this.util.createJSLink('path', newPath, name, null, '-');
                } else {
                    return this.util.createTermLink(name);
                }
            }
        }).join('<br>');
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
                    cardinality = minCount + '..' + maxCount;
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
