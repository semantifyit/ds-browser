class DSRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = this.browser.util;
    }

    render() {
        this.graph = this.browser.ds['@graph'][0];

        this.browser.elem.innerHTML = '' +
            '<h1 property="schema:name">' + this.graph['schema:name'] + '</h1>' +
            '<div property="schema:description">' + this.graph['schema:description'] + '<br><br></div>' +
            this.createPropertyTable();
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
                    this.util.dataTypeMapperFromSHACL(name) + '</a><br>');
            } else {
                name = this.util.rangesToString(name);

                /**
                let newUrl = this.dsd.hash + "/";
                if (glob.dsPath === undefined) {
                    newUrl = newUrl.concat(propertyName + "/" + name);
                } else {
                    newUrl = newUrl.concat(glob.dsPath + "/" + propertyName + "/" + name);
                }*/
                html += '<a href="TODO">' + name + '</a><br>';
            }
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
