class DSRenderer {
    MODES = {
        'native' : 'native',
        'tree' : 'tree'
    };

    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
    }

    /**
     * Render the JSON-LD serialization of the Vocabulary.
     */
    renderShacl() {
        const preStyle = '' +
            // Overwrite schema.org CSS
            'font-size: medium; ' +
            'background: none; ' +
            'text-align: left; ' +
            'width: auto; ' +
            'padding: 0; ' +
            'overflow: visible; ' +
            'color: rgb(0, 0, 0); ' +
            'line-height: normal; ' +

            // Defaults for pre https://www.w3schools.com/cssref/css_default_values.asp
            'display: block; ' +
            'font-family: monospace; ' +
            'margin: 1em 0; ' +

            // From Browser when loading SHACL file
            'word-wrap: break-word; ' +
            'white-space: pre-wrap;';

        this.browser.elem.innerHTML = '' +
            '<pre style="' + preStyle + '">' +
            JSON.stringify(this.browser.ds, null, 2) +
            '</pre>';
    }

    createViewModeSelectors(selected=this.MODES.native) {
        return '' +
            '<div class="ds-selector-tabs ds-selector">' +
            '<div class="selectors">' +
            (selected === this.MODES.native ? '<a class="selected">Native View</a>' :
                this.util.createJSLink('mode', null, 'Native View')) +
            (selected === this.MODES.tree ? '<a class="selected">Tree View</a>' :
                this.util.createJSLink('mode', 'tree', 'Tree View')) +
            '</div>' +
            '</div>';
    }

    createHeader() {
        this.dsNode = this.browser.dsNode;
        this.node = this.dsNode.node;

        let name, description, breadcrumbs = '';
        if (!this.browser.path) {
            const graph = this.browser.ds['@graph'][0];
            name = graph['schema:name'] || 'Domain Specification';
            description = graph['schema:description'] || '';
        } else {
            const nodeClass = this.node['sh:class'];
            name = this.dsHandler.rangesToString(nodeClass);
            description = this.createNodeDescription(nodeClass);
            breadcrumbs = this.createBreadcrumbs();
        }
        description = this.util.repairLinksInHTMLCode(description);

        return '' +
            this.createNavigation() +
            '<h1 property="schema:name">' + name + '</h1>' +
            this.util.createExternalLinkLegend() +
            breadcrumbs +
            '<div property="schema:description">' + description + '<br><br></div>';
    }

    createNodeDescription(nodeClass) {
        if (this.util.isString(nodeClass)) {
            return this.browser.sdoAdapter.getTerm(nodeClass).getDescription();
        } else {
            return nodeClass.map((c) => {
                return '' +
                    '<b>' + this.util.prettyPrintIri(c) + ':</b> ' +
                    this.browser.sdoAdapter.getTerm(c).getDescription();
            }).join('<br>');
        }
    }

    createBreadcrumbs() {
        return '' +
            '<h4>' +
            '<span class="breadcrumbs">' +
            this.util.createJSLink('path', null, this.browser.ds['@graph'][0]['schema:name'] || 'Domain Specification') +
            ' > ' +
            this.browser.path.split('-').map((term, index, pathSplitted) => {
                if (index % 2 === 0) {
                    return term;
                } else {
                    const newPath = pathSplitted.slice(0, index + 1).join('-');
                    return this.util.createJSLink('path', newPath, term);
                }
            }).join(' > ') +
            '</span>' +
            '</h4>';
    }

    createNavigation() {
        return '' +
            '<span style="float: right;">' +
            '(' +
            this.util.createJSLink('format', 'shacl', 'SHACL serialization') +
            (this.browser.list ? ' | from List: ' +
                this.util.createJSLink('ds', null, this.browser.list['schema:name']) : '') +
            ')' +
            '</span>';
    }
}

module.exports = DSRenderer;
