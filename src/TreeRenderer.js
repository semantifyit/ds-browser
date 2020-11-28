import $ from 'jquery'; // Needed or jstree
import 'jstree';

class TreeRenderer {
    constructor(browser) {
        this.browser = browser;
    }

    render() {
        this.browser.elem.innerHTML = '<div id="jsTree"></div>';
        this.mapNodeForJSTree();
    }

    mapNodeForJSTree() {
        $('#jsTree')
            .jstree({
                plugins: ['search', 'grid'],
                core: {
                    'themes': {
                        'icons': true,
                        'dots': true,
                        'responsive': true,
                        'stripes': true,
                        rootVisible: false,
                    },
                    'data': [ /* TODO */]
                },
                grid: {
                    columns: [
                        {'width': '20%', header: 'Class / Property'},
                        // { header: 'Class / Property'},
                        {
                            header: 'Range / Type',
                            value: function (node) {
                                // TODO
                            }
                        },
                        {
                            width: '60%',
                            header: 'Description',
                            value: function (node) {
                                // TODO
                            }
                        },
                        {
                            width: '20%',
                            header: 'Cardinality',
                            value: function (node) {
                                // TODO
                            }
                        }
                    ],
                }
            })
            .bind('select_node.jstree', function (event, data) {
                // TODO
            });
    }
}

module.exports = TreeRenderer;
