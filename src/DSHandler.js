class DSHandler {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    getDSNodeForPath() {
        // DSNode is then the corresponding node from the domain specification
        let ds = this.browser.ds['@graph'][0];
        let result = {
            'type': '',
            'node': {}
        };
        // Check if DS provided
        if (this.browser.ds) {
            if (this.browser.path) {
                let pathSteps = this.browser.path.split('-');
                for (let i = 0; i < pathSteps.length; i++) {
                    if (pathSteps[i] === "") {
                        continue;
                    }
                    if (pathSteps[i].charAt(0).toUpperCase() === pathSteps[i].charAt(0)) {
                        // Is uppercase -> class or Enum
                        if (ds !== null) {
                            ds = this.getClass(ds['sh:or'], pathSteps[i]);
                        }
                    } else {
                        // Property should not be the last part of an URL, skip to show containing class!
                        // Although the redirectCheck() would fire before this function
                        if (ds !== null && i !== pathSteps.length - 1) {
                            if (ds["sh:targetClass"] !== undefined) {
                                // Root node
                                ds = this.getProperty(ds['sh:property'], pathSteps[i]);
                            } else {
                                // Nested nodes
                                ds = this.getProperty(ds["sh:node"]['sh:property'], pathSteps[i]);
                            }
                        }
                    }
                }
                if (ds && ds["sh:class"] && !Array.isArray(ds["sh:class"])) {
                    try {
                        this.browser.sdoAdapter.getEnumeration(ds["sh:class"]);
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
        result.node = ds;
        return result;
    }

    // Get the class or enumeration with that name
    getClass(DSNode, name) {
        for (let i = 0; i < DSNode.length; i++) {
            if (DSNode[i]["sh:class"] !== undefined && this.rangesToString(DSNode[i]["sh:class"]) === name) {
                return DSNode[i];
            }
        }
        return null;
    }

    // Get the property with that name
    getProperty(propertyArray, name) {
        for (let i = 0; i < propertyArray.length; i++) {
            if (this.rangesToString(propertyArray[i]["sh:path"]) === name) {
                return propertyArray[i];
            }
        }
        return null;
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

    createCardinality(minCount, maxCount) {
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
}

module.exports = DSHandler;
