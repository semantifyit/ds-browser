class TreeRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = this.browser.util;
        this.dsHandler = this.browser.dsHandler;
    }

    render() {
        const mainContent = '' +
            this.browser.dsRenderer.createHeader() +
            '<iframe id="iframe-jsTree" frameborder="0" width="100%" scrolling="no"></iframe>';
        this.browser.elem.innerHTML = this.util.createMainContent('rdfs:Class', mainContent);

        this.initIFrameForJSTree();
    }

    initIFrameForJSTree () {
        this.iFrame = document.getElementById('iframe-jsTree');
        this.iFrameCW = this.iFrame.contentWindow;
        const doc = this.iFrameCW.document;
        const jsTreeHtml = this.createJSTreeHTML();
        doc.open();
        doc.write(jsTreeHtml);
        doc.close();

        const dsClass = this.generateDsClass(this.browser.ds['@graph'][0], false, false);
        this.mapNodeForJSTree([dsClass]);
    }

    createJSTreeHTML() {
        return '' +
            '<head>' +
            '<script src="https://code.jquery.com/jquery-3.5.1.min.js" ' +
            '  integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>' +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/jstree.min.js"></script>' +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/jstreegrid/3.10.2/jstreegrid.min.js"></script>' +
            '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" />' +
            '<link rel="stylesheet" ' +
            '  href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/themes/default/style.min.css" />' +
            this.createTreeStyle() +
            '</head>' +
            '<body>' +
            '<div id="btn-row">' +
            'Show: ' +
            '<span id="btn-opt" class="btn-vis btn-vis-shadow" style="margin-left: 10px;">' +
            '<img src="" class="glyphicon glyphicon-tag optional-property"> optional' +
            '</span>' +
            '<span id="btn-man" class="btn-vis" style="margin-left: 10px;">' +
            '<img src="" class="glyphicon glyphicon-tag mandatory-property"> mandatory' +
            '</span>' +
            '</div>' +
            '<div id="jsTree"></div>' +
            '</body>';
    }

    createTreeStyle() {
        return '' +
            '<style>' +
            '.optional-property { color: #ffa517; }' +
            '.mandatory-property { color: #00ce0c; }' +
            '#btn-row { padding: 12px 0px 12px 5px; }' +
            '.btn-vis { padding: 5px; }' +
            '.btn-vis-shadow {' +
            '    cursor: pointer;' +
            '    webkit-box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);' +
            '    box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);' +
            '}' +
            '</style>';
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

    mapNodeForJSTree(data) {
        const self = this;
        this.iFrame.addEventListener('load', function() {
            self.iFrameCW.$('#jsTree').jstree({
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
                            maxWidth: '20%',
                            header: 'Class / Property'
                        },
                        {
                            header: 'Range / Type',
                            maxWidth: '20%',
                            value: function (node) {
                                return (node.data.dsRange);
                            }
                        },
                        {
                            maxWidth: '39%',
                            header: 'Description',
                            value: function (node) {
                                return (node.data.dsDescription);
                            }
                        },
                        {
                            maxWidth: '20%',
                            header: 'Cardinality',
                            value: function (node) {
                                if (node.data.dsRange) {
                                    return self.dsHandler.createCardinality(node.data.minCount, node.data.maxCount);
                                }
                            }
                        }
                    ],
                }
            }).bind('loaded.jstree after_open.jstree after_close.jstree refresh.jstree', self.adaptIframe.bind(self));

            self.addIframeClickEvent();
        });
    }

    adaptIframe() {
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        this.iFrame.height = "0px";
        this.iFrame.height = this.iFrameCW.document.body.scrollHeight;
        window.scrollTo(scrollX, scrollY);
    }

    addIframeClickEvent() {
        this.iFrameCW.$('.btn-vis-shadow').click((event) => {
            const $button = this.iFrameCW.$(event.currentTarget);
            $button.removeClass('btn-vis-shadow');
            let $otherButton, showOptional;
            if ($button.attr('id') === 'btn-opt') {
                $otherButton = this.iFrameCW.$('#btn-man');
                showOptional = true;
            } else {
                $otherButton = this.iFrameCW.$('#btn-opt');
                showOptional = false;
            }
            $otherButton.addClass('btn-vis-shadow');
            $button.off('click');
            this.addIframeClickEvent();

            const dsClass = this.generateDsClass(this.browser.ds['@graph'][0], false, showOptional);
            const jsTree = this.iFrameCW.$('#jsTree').jstree(true);
            jsTree.settings.core.data = dsClass;
            jsTree.refresh();
        })
    }


}

module.exports = TreeRenderer;
