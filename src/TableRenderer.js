class TableRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
    }

    render() {
        const rootClass = this.dsHandler.generateDsClass(this.browser.ds['@graph'][0], false, false);
        const mainContent = this.dsRenderer.createHeader() +
            this.dsRenderer.createViewModeSelectors(this.dsRenderer.MODES.table) +
            '<table class="firstLevel">' +
            '<tr class="firstRowTableView sti-red">' +
            '<td><img src="" class="glyphicon glyphicon-list-alt">' + rootClass.text + '</td>' +
            '<td colspan="2">' + rootClass.data.dsDescription + '</td>' +
            '<td><div class="firstRowCardinality"><b>Cardinality</b></div></td>' +
            '</tr>' +
            //processPropertiesForTableView(properties, 0, ds._id) +
            '</table>';

        this.browser.elem.innerHTML = this.util.createMainContent('rdfs:Class', mainContent);
    }
}

module.exports = TableRenderer;
