class DSHandler {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    getDSNodeForPath() {
        // DSNode is then the corresponding node from the domain specification
        let currentNode = this.browser.dsRootNode;
        let result = {
            'type': '',
            'node': {}
        };
        // Check if DS provided
        if (currentNode) {
            if (this.browser.path) {
                let pathSteps = this.browser.path.split('-');
                for (let i = 0; i < pathSteps.length; i++) {
                    if (pathSteps[i] === "") {
                        continue;
                    }
                    let currPathStepWithoutIndicator;
                    if (pathSteps[i].indexOf(":") >= 0) {
                        currPathStepWithoutIndicator = pathSteps[i].substring(pathSteps[i].indexOf(":") + 1);
                    } else {
                        currPathStepWithoutIndicator = pathSteps[i];
                    }
                    if (currPathStepWithoutIndicator.charAt(0).toUpperCase() === currPathStepWithoutIndicator.charAt(0)) {
                        // Is uppercase -> class or Enum
                        if (currentNode !== null) {
                            currentNode = this.getClass(currentNode['sh:or'], pathSteps[i]);
                        }
                    } else {
                        // Property should not be the last part of an URL, skip to show containing class!
                        // Although the redirectCheck() would fire before this function
                        if (currentNode !== null && i !== pathSteps.length - 1) {
                            currentNode = this.getProperty(currentNode['sh:property'], pathSteps[i]);
                        }
                    }
                }
                try {
                    this.browser.sdoAdapter.getTerm(currentNode["sh:class"][0]);
                    if (this.browser.sdoAdapter.getTerm(currentNode["sh:class"][0]).getTermType() === "schema:Enumeration") {
                        result.type = "Enumeration";
                    } else {
                        result.type = "Class";
                    }
                } catch (e) {
                    result.type = "error";
                }
            } else {
                // Root class
                result.type = "Class";
            }
        } else {
            // No DS
            result.type = "error";
        }
        result.node = currentNode;
        return result;
    }

    // Get the class or enumeration with that name
    getClass(DSNode, name) {
        return DSNode.find(el => (el["sh:node"] && el["sh:node"]["sh:class"] && this.rangesToString(el["sh:node"]["sh:class"]) === name))["sh:node"] || null;
    }

    // Get the property with that name
    getProperty(propertyArray, name) {
        return propertyArray.find(el => this.rangesToString(el["sh:path"]) === name) || null;
    }

    // Get the corresponding SDO datatype from a given SHACL XSD datatype
    dataTypeMapperFromSHACL(dataType) {
        switch (dataType) {
            case 'xsd:string':
                return 'https://schema.org/Text';
            case 'rdf:langString':
                return 'https://schema.org/Text';
            case 'xsd:boolean' :
                return 'https://schema.org/Boolean';
            case 'xsd:date' :
                return 'https://schema.org/Date';
            case 'xsd:dateTime':
                return 'https://schema.org/DateTime';
            case 'xsd:time':
                return 'https://schema.org/Time';
            case 'xsd:double':
                return 'https://schema.org/Number';
            case 'xsd:float':
                return 'https://schema.org/Float';
            case  'xsd:integer':
                return 'https://schema.org/Integer';
            case 'xsd:anyURI':
                return 'https://schema.org/URL';
        }
        return null; // If no match
    }

    // Converts a range array/string into a string usable in functions
    rangesToString(ranges) {
        if (Array.isArray(ranges)) {
            return ranges.map((range) => {
                return this.util.prettyPrintIri(range);
            }).join(' + ');
        } else {
            return this.util.prettyPrintIri(ranges); // Is already string
        }
    }

    createHtmlCardinality(minCount, maxCount) {
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
        return `<span title="${title}">${cardinality}</span>`;
    }

    generateDsClass(classNode, closed, showOptional) {
        let dsClass = {};
        const targetClass = classNode['sh:targetClass'] || classNode['sh:class'];
        dsClass.text = targetClass ? this.util.prettyPrintClassDefinition(targetClass) : "";
        dsClass.icon = 'glyphicon glyphicon-list-alt';
        if (!closed) {
            dsClass.state = {'opened': true};
        }
        let description;
        try {
            if (dsClass.text.indexOf(',') === -1) {
                description = this.util.repairLinksInHTMLCode(this.browser.sdoAdapter.getClass(dsClass.text).getDescription());
            } else {
                description = 'No description found.';
            }
        } catch (e) {
            description = 'No description found.';
        }
        dsClass.data = {};
        dsClass.data.dsDescription = description;
        dsClass.children = this.processChildren(classNode, showOptional);
        return dsClass;
    }

    processChildren(classNode, showOptional) {
        const children = [];
        let propertyNodes = classNode['sh:property'];
        if (propertyNodes) {
            propertyNodes.forEach((propertyNode) => {
                const dsProperty = this.generateDsProperty(propertyNode, showOptional);
                if (dsProperty) {
                    children.push(dsProperty);
                }
            });
        }
        return children;
    }

    generateDsProperty(propertyObj, showOptional) {
        const dsProperty = {};
        dsProperty.justification = this.util.getLanguageString(propertyObj['rdfs:comment']);
        dsProperty.text = this.util.prettyPrintIri(propertyObj['sh:path']);
        dsProperty.data = {};
        dsProperty.data.minCount = propertyObj['sh:minCount'];
        dsProperty.data.maxCount = propertyObj['sh:maxCount'];
        dsProperty.children = [];

        this.processEnum(dsProperty, propertyObj['sh:or'][0]);
        this.processVisibility(dsProperty, propertyObj['sh:minCount']);
        this.processRanges(dsProperty, propertyObj['sh:or'], showOptional);

        if (showOptional) {
            // return -> show property anyway (mandatory and optional)
            return dsProperty;
        } else if (!dsProperty.data.isOptional) {
            // return -> show property only if it is mandatory (not optional)
            return dsProperty;
        } else {
            // dont show
            return null;
        }
    }

    processEnum(dsProperty, shOr,) {
        dsProperty.isEnum = false;
        let enuWithSdo;
        try {
            const rangeOfProp = shOr['sh:class'];
            enuWithSdo = this.browser.sdoAdapter.getEnumeration(rangeOfProp);
            dsProperty.isEnum = true;
        } catch (e) { /* Ignore */
        }

        if (dsProperty.isEnum) {
            const enuMembersArray = this.getEnumMemberArray(shOr['sh:in'], enuWithSdo);

            // Get description
            enuMembersArray.forEach((eachMember) => {
                const enuMemberDesc = this.browser.sdoAdapter.getEnumerationMember(eachMember.name);
                eachMember.description = this.util.repairLinksInHTMLCode(enuMemberDesc.getDescription());
            });

            dsProperty.data.enuMembers = enuMembersArray;
            dsProperty.children = enuMembersArray.map((enuMem) => {
                return {
                    children: [],
                    data: {
                        dsRange: '',
                        dsDescription: this.util.repairLinksInHTMLCode(enuMem.description)
                    },
                    icon: 'glyphicon glyphicon-chevron-right',
                    text: enuMem.name,
                };
            });
        }
    }

    getEnumMemberArray(shIn, enuWithSdo) {
        if (shIn) { // Objects
            return shIn.map((enuMember) => {
                let enuMemberName = enuMember['@id'];
                enuMemberName = enuMemberName.replace('schema:', '');
                return {name: enuMemberName};
            });
        } else { // Strings
            const enuMembersArrayString = enuWithSdo.getEnumerationMembers();
            return enuMembersArrayString.map((enuMemName) => {
                return {name: enuMemName};
            });
        }
    }

    processVisibility(dsProperty, minCount) {
        dsProperty.icon = 'glyphicon glyphicon-tag';
        if (!minCount > 0) {
            dsProperty.icon += ' optional-property';
            dsProperty.data.isOptional = true;
        } else {
            dsProperty.icon += ' mandatory-property';
            dsProperty.data.isOptional = false;
        }
    }

    processRanges(dsProperty, rangeNodes, showOptional) {
        let isOpened = false;
        if (rangeNodes) {
            const dsRange = this.generateDsRange(rangeNodes);
            dsProperty.data.dsRange = dsRange.rangeAsString;

            try {
                const description = this.browser.sdoAdapter.getProperty(dsProperty.text).getDescription();
                dsProperty.data.dsDescription = this.util.repairLinksInHTMLCode(description);
            } catch (e) {
                dsProperty.data.dsDescription = 'No description found.';
            }

            rangeNodes.forEach((rangeNode) => {
                if (rangeNode['sh:node'] && rangeNode['sh:node']["sh:class"]) {
                    isOpened = true;
                    const dsClass = this.generateDsClass(rangeNode['sh:node'], true, showOptional);
                    dsProperty.children.push(dsClass);
                }
            });
        }
        if (isOpened) {
            dsProperty.state = {'opened': true};
        }
    }

    generateDsRange(rangeNodes) {
        let returnObj = {
            rangeAsString: ''
        };
        returnObj.rangeAsString = rangeNodes.map((rangeNode) => {
            let name, rangePart;
            const datatype = rangeNode['sh:datatype'];
            const shClass = (rangeNode['sh:node'] && rangeNode['sh:node']['sh:class']) ? rangeNode['sh:node']['sh:class'] : null;
            if (datatype) { // Datatype
                name = this.util.prettyPrintIri(this.dataTypeMapperFromSHACL(datatype));
                rangePart = name;
            } else if (rangeNode['sh:node'] && rangeNode['sh:node']['sh:property']) { // Restricted class
                name = this.util.prettyPrintClassDefinition(shClass);
                rangePart = '<strong>' + name + '</strong>';
            } else {
                // Enumeration
                // Standard class
                name = this.util.prettyPrintClassDefinition(shClass);
                rangePart = name;
            }
            return rangePart;
        }).join(' or ');

        return returnObj;
    }
}

module.exports = DSHandler;
