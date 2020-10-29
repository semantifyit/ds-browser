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
            if (DSNode[i]["sh:class"] !== undefined && this.util.rangesToString(DSNode[i]["sh:class"]) === name) {
                return DSNode[i];
            }
        }
        return null;
    }

    // Get the property with that name
    getProperty(propertyArray, name) {
        for (let i = 0; i < propertyArray.length; i++) {
            if (this.util.rangesToString(propertyArray[i]["sh:path"]) === name) {
                return propertyArray[i];
            }
        }
        return null;
    }
}

module.exports = DSHandler;
