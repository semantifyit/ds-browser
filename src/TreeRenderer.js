import $ from 'jquery';

import 'jstree';
import 'jstreegrid';

class TreeRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = this.browser.util;
        this.dsHandler = this.browser.dsHandler;
    }

    render() {
        this.browser.elem.innerHTML = '' +
            '<div>' +
            this.createTreeStyle() +
            '<div id="btn-row">' +
            'Show: ' +
            '<span class="btn-vis btn-vis-shadow" style="margin-left: 10px;">' +
            '<img src="" class="glyphicon glyphicon-tag optional-property"> optional' +
            '</span>' +
            '<span class="btn-vis" style="margin-left: 10px;">' +
            '<img src="" class="glyphicon glyphicon-tag mandatory-property"> mandatory' +
            '</span>' +
            '</div>' +
            '<div id="jsTree"></div>' +
            '</div>';
        const dsClass = this.generateDsClass(this.browser.ds['@graph'][0], false, false);
        this.mapNodeForJSTree([dsClass]);
    }

    createTreeStyle() {
        return '' +
            '<style>' +
            '@import url("https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.8/themes/default/style.min.css");' +
            '@import url("https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css");' +
            '.optional-property { color: #ffa517; }' +
            '.mandatory-property { color: #00ce0c; }' +
            '#btn-row { padding: 12px 0px 12px 5px; }' +
            '.btn-vis { padding: 5px; }' +
            '.btn-vis-shadow {' +
            '    webkit-box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);' +
            '    box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);' +
            '}'+
            '</style>';
    }

    mapNodeForJSTree(data) {
        const self = this;
        $('#jsTree').jstree({
            plugins: ['search', 'grid'],
            core: {
                themes: {
                    icons: true,
                    dots: true,
                    responsive: true,
                    stripes: true,
                    rootVisible: false,
                },
                data: data
            },
            grid: {
                columns: [
                    {
                        width: '20%',
                        header: 'Class / Property'
                    },
                    {
                        header: 'Range / Type',
                        value: function (node) {
                            return (node.data.dsRange);
                        }
                    },
                    {
                        width: '60%',
                        header: 'Description',
                        value: function (node) {
                            return (node.data.dsDescription);
                        }
                    },
                    {
                        width: '20%',
                        header: 'Cardinality',
                        value: function (node) {
                            if (node.data.dsRange) {
                                return self.dsHandler.createCardinality(node.data.minCount, node.data.maxCount);
                            }
                        }
                    }
                ],
            }
        });
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
            return dsProperty;
        } else if (!dsProperty.data.isOptional) {
            return dsProperty;
        }
        // TODO: Probably a mistake: What happens when if / else if is not entered?
    }


    processEnum(dsProperty, shOr,) {
        dsProperty.isEnum = false;
        let enuWithSdo;
        try {
            const rangeOfProp = shOr['sh:class'];
            enuWithSdo = this.browser.sdoAdapter.getEnumeration(rangeOfProp);
            dsProperty.isEnum = true;
        } catch (e) { /* Ignore */ }

        if (dsProperty.isEnum) {
            const enuMembersArray = this.getEnumMemberArray(shOr['sh:in'], enuWithSdo);

            // Get description
            enuMembersArray.forEach((eachMember) => {
                const enuMemberDesc = this.browser.sdoAdapter.getEnumerationMember(eachMember.name);
                eachMember.description = enuMemberDesc.getDescription();
            });

            dsProperty.data.enuMembers = enuMembersArray;
            dsProperty.children = enuMembersArray.map((enuMem) => {
                return {
                    children: [],
                    data: {
                        dsRange: '',
                        dsDescription: enuMem.description
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
                dsProperty.data.dsDescription = this.browser.sdoAdapter.getProperty(dsProperty.text).getDescription();
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
        returnObj.rangeAsString = dsvExpectedTypes.map((dsvExpectedType, i) => {
            let justification = {};
            let name, rangePart;
            const datatype = dsvExpectedType['sh:datatype'];
            const shClass = dsvExpectedType['sh:class'];
            if (datatype) { // Datatype
                name = this.util.prettyPrintIri(this.dsHandler.dataTypeMapperFromSHACL(datatype));
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

module.exports = TreeRenderer;
