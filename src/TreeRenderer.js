class TreeRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
    }

    render() {
        const htmlHeader = this.dsRenderer.createHtmlHeader();
        const htmlViewModeSelector = this.dsRenderer.createViewModeSelectors(this.dsRenderer.MODES.tree);
        // The div-iframe is needed for padding
        const mainContent = `${htmlHeader}
            ${htmlViewModeSelector}
            <div id="div-iframe">
            <iframe id="iframe-jsTree" frameborder="0" width="100%" scrolling="no"></iframe>
            </div>`;
        this.browser.targetElement.innerHTML = this.util.createHtmlMainContent('rdfs:Class', mainContent);
        this.initIFrameForJSTree();
    }

    initIFrameForJSTree() {
        this.iFrame = document.getElementById('iframe-jsTree');
        this.iFrameCW = this.iFrame.contentWindow;
        const doc = this.iFrameCW.document;
        const jsTreeHtml = this.createJSTreeHTML();
        doc.open();
        doc.write(jsTreeHtml);
        doc.close();
        const dsClass = this.dsHandler.generateDsClass(this.browser.dsRootNode, false, false);
        this.mapNodeForJSTree([dsClass]);
    }

    createJSTreeHTML() {
        const htmlVisBtnRow = this.dsRenderer.createVisBtnRow();
        const htmlTreeStyle = this.createTreeStyle();
        return `<head>
            <script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/jstree.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstreegrid/3.10.2/jstreegrid.min.js"></script>
            <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/themes/default/style.min.css" />
            ${htmlTreeStyle}
            </head>
            <body>${htmlVisBtnRow}<div id="jsTree"></div></body>`;
    }

    createTreeStyle() {
        return `<style>
            .optional-property { color: #ffa517; }
            .mandatory-property { color: #00ce0c; }
            #btn-row { padding: 12px 0px 12px 5px; }
            .btn-vis { padding: 5px; }
            .btn-vis-shadow {
                cursor: pointer;
                webkit-box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
                box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
            }
            </style>`;
    }

    mapNodeForJSTree(data) {
        const self = this;
        this.iFrame.addEventListener('load', function() {
            self.iFrameCW.$('#jsTree').jstree({
                plugins: ['grid'],
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
                            width: '20%',
                            value: function(node) {
                                return (node.data.dsRange);
                            }
                        },
                        {
                            width: '40%',
                            header: 'Description',
                            value: function(node) {
                                return (node.data.dsDescription);
                            }
                        },
                        {
                            width: '20%',
                            header: 'Cardinality',
                            value: function(node) {
                                if (node.data.dsRange) {
                                    return self.dsHandler.createHtmlCardinality(node.data.minCount, node.data.maxCount);
                                }
                            }
                        }
                    ],
                }
            }).bind('ready.jstree after_open.jstree after_close.jstree refresh.jstree', self.adaptIframe.bind(self));

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

            const dsClass = this.dsHandler.generateDsClass(this.browser.dsRootNode, false, showOptional);
            const jsTree = this.iFrameCW.$('#jsTree').jstree(true);
            jsTree.settings.core.data = dsClass;
            jsTree.refresh();
        });
    }
}

module.exports = TreeRenderer;
