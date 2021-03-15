class ListRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
    }

    render() {
        const mainContent = this.createHtmlHeader() + this.createHtmlDsTable();
        this.browser.targetElement.innerHTML = this.util.createHtmlMainContent('schema:DataSet', mainContent);
    }

    createHtmlHeader() {
        const listName = this.browser.list['schema:name'] || "";
        const externalLinkLegend = this.util.createHtmlExternalLinkLegend();
        const listDescription = this.browser.list['schema:description'] || "";
        return `<h1>${listName}</h1>
            ${externalLinkLegend}
            ${listDescription}`;
    }

    createHtmlDsTable() {
        return this.util.createHtmlDefinitionTable(
            ['Name', 'IRI', 'Description'],
            this.createHtmlDsTbody(),
            null,
            {'class': 'supertype'}
        );
    }

    createHtmlDsTbody() {
        return this.browser.list['schema:hasPart'].map((ds) => {
            return this.util.createHtmlTableRow('http://vocab.sti2.at/ds/Domain Specification',
                ds['@id'],
                'schema:name',
                this.util.createInternalLink({dsId: ds['@id'].split('/').pop()}, ds['schema:name'] || 'No Name'),
                this.createHtmlDsSideCols(ds)
            );
        }).join('');
    }

    createHtmlDsSideCols(ds) {
        const idLink = this.util.createLink(ds['@id']);
        const description = ds['schema:description'] || '';
        return `<td property="@id">${idLink}</td>
            <td property="schema:description">${description}</td>`;
    }
}

module.exports = ListRenderer;
