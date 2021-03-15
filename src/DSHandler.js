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
                    if (pathSteps[i].charAt(0).toUpperCase() === pathSteps[i].charAt(0)) {
                        // Is uppercase -> class or Enum
                        if (currentNode !== null) {
                            currentNode = this.getClass(currentNode['sh:or'], pathSteps[i]);
                        }
                    } else {
                        // Property should not be the last part of an URL, skip to show containing class!
                        // Although the redirectCheck() would fire before this function
                        if (currentNode !== null && i !== pathSteps.length - 1) {
                            if (currentNode["sh:targetClass"] !== undefined) {
                                // Root node
                                currentNode = this.getProperty(currentNode['sh:property'], pathSteps[i]);
                            } else {
                                // Nested nodes
                                currentNode = this.getProperty(currentNode["sh:node"]['sh:property'], pathSteps[i]);
                            }
                        }
                    }
                }
                if (currentNode && currentNode["sh:class"] && !Array.isArray(currentNode["sh:class"])) {
                    try {
                        this.browser.sdoAdapter.getEnumeration(currentNode["sh:class"]);
                        result.type = "Enumeration";
                    } catch (e) {
                        result.type = "Class";
                    }
                } else {
                    result.type = "Class";
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
        return DSNode.find(el => (el["sh:class"] && this.rangesToString(el["sh:class"]) === name)) || null;
    }

    // Get the property with that name
    getProperty(propertyArray, name) {
        return propertyArray.find(el => this.rangesToString(el["sh:path"]) === name) || null;
    }

    // Get the corresponding SDO datatype from a given SHACL XSD datatype
    dataTypeMapperFromSHACL(dataType) {
        switch (dataType) {
            case 'xsd:string':
                return 'http://schema.org/Text';
            case 'xsd:boolean' :
                return 'http://schema.org/Boolean';
            case 'xsd:date' :
                return 'http://schema.org/Date';
            case 'xsd:dateTime':
                return 'http://schema.org/DateTime';
            case 'xsd:time':
                return 'http://schema.org/Time';
            case 'xsd:double':
                return 'http://schema.org/Number';
            case 'xsd:float':
                return 'http://schema.org/Float';
            case  'xsd:integer':
                return 'http://schema.org/Integer';
            case 'xsd:anyURI':
                return 'http://schema.org/URL';
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

    generateDsClass(dsvClass, closed, showOptional) {
        let dsClass = {};
        const targetClass = dsvClass['sh:targetClass'];
        dsClass.text = (targetClass ? this.util.prettyPrintClassDefinition(targetClass) :
            this.util.prettyPrintClassDefinition(dsvClass['sh:class']));

        dsClass.icon = 'glyphicon glyphicon-list-alt';
        if (!closed) {
            dsClass.state = {'opened': true};
        }

        let description;
        try {
            if (dsClass.text.indexOf(',') === -1) {
                description = this.browser.sdoAdapter.getClass(dsClass.text).getDescription();
            } else {
                description = 'No description found.';
            }
        } catch (e) {
            description = 'No description found.';
        }
        dsClass.data = {};
        dsClass.data.dsDescription = description;

        if (dsvClass['rdfs:comment']) { // Was dsv:justification
            dsClass.justification = dsvClass['rdfs:comment'];
        }
        dsClass.children = this.processChildren(dsvClass, showOptional);
        return dsClass;
    }

    processChildren(dsvClass, showOptional) {
        const children = [];
        let dsvProperties;
        const shProperty = dsvClass['sh:property'];
        const shNode = dsvClass['sh:node'];
        if (shProperty) {
            dsvProperties = shProperty;
        } else if (shNode && shNode['sh:property']) {
            dsvProperties = shNode['sh:property'];
        }
        if (dsvProperties !== undefined) {
            dsvProperties.forEach((dsvProperty) => {
                const dsProperty = this.generateDsProperty(dsvProperty, showOptional);
                if (dsProperty) {
                    children.push(dsProperty);
                }
            });
        }
        return children;
    }

    generateDsProperty(propertyObj, showOptional) {
        const dsProperty = {};
        dsProperty.justification = propertyObj['rdfs:comment'];
        dsProperty.text = this.util.prettyPrintIri(propertyObj['sh:path']);
        dsProperty.data = {};
        dsProperty.data.minCount = propertyObj['sh:minCount'];
        dsProperty.data.maxCount = propertyObj['sh:maxCount'];
        dsProperty.children = [];

        this.processEnum(dsProperty, propertyObj['sh:or'][0]);
        this.processVisibility(dsProperty, propertyObj['sh:minCount']);
        this.processExpectedTypes(dsProperty, propertyObj['sh:or'], showOptional);

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

    processExpectedTypes(dsProperty, dsvExpectedTypes, showOptional) {
        let isOpened = false;
        if (dsvExpectedTypes) {
            const dsRange = this.generateDsRange(dsvExpectedTypes);
            dsProperty.data.dsRange = dsRange.rangeAsString;
            dsProperty.data.rangeJustification = dsRange.rangeJustification;

            try {
                const description = this.browser.sdoAdapter.getProperty(dsProperty.text).getDescription();
                dsProperty.data.dsDescription = this.util.repairLinksInHTMLCode(description);
            } catch (e) {
                dsProperty.data.dsDescription = 'No description found.';
            }

            dsvExpectedTypes.forEach((dsvExpectedType) => {
                if (dsvExpectedType['sh:node']) { // Was dsv:restrictedClass
                    isOpened = true;
                    const dsClass = this.generateDsClass(dsvExpectedType, true, showOptional);
                    dsProperty.children.push(dsClass);
                }
            });
        }
        if (isOpened) {
            dsProperty.state = {'opened': true};
        }
    }

    generateDsRange(dsvExpectedTypes) {
        let returnObj = {
            rangeAsString: '',
            rangeJustification: []
        };
        returnObj.rangeAsString = dsvExpectedTypes.map((dsvExpectedType) => {
            let justification = {};
            let name, rangePart;
            const datatype = dsvExpectedType['sh:datatype'];
            const shClass = dsvExpectedType['sh:class'];
            if (datatype) { // Datatype
                name = this.util.prettyPrintIri(this.dataTypeMapperFromSHACL(datatype));
                rangePart = name;
            } else if (dsvExpectedType['sh:node']) { // Restricted class
                name = this.util.prettyPrintClassDefinition(shClass);
                rangePart = '<strong>' + name + '</strong>';
            } else {
                // Enumeration
                // Standard class
                name = this.util.prettyPrintClassDefinition(shClass);
                rangePart = name;
            }

            justification.name = name;
            justification.justification = dsvExpectedType['rdfs:comment']; // Was dsv:justification
            returnObj.rangeJustification.push(justification);
            return rangePart;
        }).join(' or ');

        return returnObj;
    }
}

module.exports = DSHandler;
