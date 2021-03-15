class NativeRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
    }

    render() {
        // Cannot be in constructor, cause at this time the node is not initialized
        this.dsNode = this.browser.dsNode;
        this.node = this.dsNode.node;

        const mainContent = this.dsRenderer.createHtmlHeader() +
            this.dsRenderer.createViewModeSelectors(this.dsRenderer.MODES.native) +
            (this.dsNode.type === 'Class' ? this.createHtmlPropertiesTable() : this.createEnumerationMembers());

        this.browser.targetElement.innerHTML = this.util.createHtmlMainContent('rdfs:Class', mainContent);
    }

    createHtmlPropertiesTable() {
        let properties;
        if (!this.browser.path) {
            properties = this.node['sh:property'].slice(0);
        } else {
            properties = this.node['sh:node']['sh:property'].slice(0);
        }

        const trs = properties.map((p) => {
            return this.createClassProperty(p);
        }).join('');
        return this.util.createHtmlDefinitionTable(
            ['Property', 'Expected Type', 'Description', 'Cardinality'],
            trs,
            {'style': 'margin-top: 0px; border-top: none;'}
        );
    }

    createClassProperty(propertyNode) {
        const path = propertyNode['sh:path'];
        const property = this.browser.sdoAdapter.getProperty(path);

        return this.util.createHtmlTableRow('rdf:Property',
            property.getIRI(),
            'rdfs:label',
            this.util.createTermLink(path),
            this.createClassPropertySideCols(propertyNode),
            'prop-name'
        );
    }

    createClassPropertySideCols(node) {
        const htmlExpectedTypes = this.createHtmlExpectedTypes(node);
        const htmlPropertyDesc = this.createHtmlPropertyDescription(node);
        const htmlCardinality = this.dsHandler.createHtmlCardinality(node['sh:minCount'], node['sh:minCount']);
        return `<td class="prop-ect">${htmlExpectedTypes}</td>
            <td class="prop-desc">${htmlPropertyDesc}</td>
            <td class="prop-ect">${htmlCardinality}</td>`;
    }

    createHtmlPropertyDescription(propertyNode) {
        const name = this.util.prettyPrintIri(propertyNode['sh:path']);
        let description;
        try {
            description = this.browser.sdoAdapter.getProperty(name).getDescription();
        } catch (e) {
            description = '';
        }
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

    createHtmlExpectedTypes(propertyNode) {
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
                    const newPath = this.browser.path ? this.browser.path + "-" + propertyName + '-' + name : propertyName + '-' + name;
                    return this.util.createInternalLink({path: newPath}, name);
                } else {
                    return this.util.createTermLink(name);
                }
            }
        }).join('<br>');
    }

    /**
     * Create HTML for the enumeration members of the Enumeration.
     *
     * @returns {string} The resulting HTML.
     */
    createEnumerationMembers() {
        const enumMembers = this.browser.sdoAdapter.getTerm(this.node['sh:class']).getEnumerationMembers();
        if (enumMembers.length !== 0) {
            const htmlListItems = enumMembers.map((e) => {
                const enumMember = this.browser.sdoAdapter.getEnumerationMember(e);
                return '' +
                    '<li>' +
                    this.util.createLink(enumMember.getIRI(), e) +
                    '</li>';
            }).join('');
            return `An Enumeration with:<br>
                <b><a id="enumbers" title="Link: #enumbers" href="#enumbers" class="clickableAnchor">Enumeration members</a></b>
                <ul>${htmlListItems}</ul><br>`;
            // return '' +
            //     'An Enumeration with:<br>' +
            //     '<b>' +
            //     '<a id="enumbers" title="Link: #enumbers" href="#enumbers" class="clickableAnchor">' +
            //     'Enumeration members' +
            //     '</a>' +
            //     '</b>' +
            //     '<ul>' +
            //     enumMembers.map((e) => {
            //         const enumMember = this.browser.sdoAdapter.getEnumerationMember(e);
            //         return '' +
            //             '<li>' +
            //             this.util.createLink(enumMember.getIRI(), e) +
            //             '</li>';
            //     }).join('') +
            //     '</ul>' +
            //     '<br>';
        } else {
            return '';
        }
    }
}

module.exports = NativeRenderer;