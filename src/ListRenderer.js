/** This class is responsible to render a semantify.it based List in the HTML element of the browser. */
class ListRenderer {
    /**
     * Create a ListRenderer object.
     *
     * @param {DSBrowser} browser - the underlying vocab browser to enable access to its data members.
     */
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    /**
     * Render the List.
     */
    render() {
        const mainContent = this.createHeader() + this.createDSTable();
        this.browser.elem.innerHTML = this.util.createMainContent('schema:DataSet', mainContent);
    }

    /**
     * Create HTML for the header of the List.
     *
     * @returns {string} The resulting HTML
     */
    createHeader() {
        return '' +
            '<h1>' + this.browser.list['schema:name'] + '</h1>' +
            this.util.createExternalLinkLegend();
    }

    /**
     * Create HTML table for the vocabularies of the List.
     *
     * @returns {string} The resulting HTML.
     */
    createDSTable() {
        return this.util.createDefinitionTable(['Name', 'IRI', 'Description'],
            this.createDSTbody(),
            {'class': 'supertype'});
    }

    /**
     * Create HTML table bodies for the vocabularies of the List.
     *
     * @returns {string} The resulting HTML.
     */
    createDSTbody() {
        return this.browser.list['schema:hasPart'].map((ds) => {
            return this.util.createTableRow('http://vocab.sti2.at/ds/Domain Specification',
                ds['@id'],
                'schema:name',
                this.util.createJSLink('ds', ds['@id'].split('/').pop(), null, ds['schema:name'] || 'No Name'),
                this.createDSSideCols(ds)
            );
        }).join('');
    }

    /**
     * Create HTML side columns for a vocabulary of the List.
     *
     * @param {object} ds - The vocabulary of the List.
     * @returns {string} The resulting HTML.
     */
    createDSSideCols(ds) {
        return '' +
            '<td property="@id">' + this.util.createLink(ds['@id']) + '</td>' +
            '<td property="schema:description">' + (ds['schema:description'] || '') + '</td>';
    }
}

module.exports = ListRenderer;
