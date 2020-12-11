class TableRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
        this.clickHandler = null; // see: https://stackoverflow.com/questions/33859113/javascript-removeeventlistener-not-working-inside-a-class
    }

    render() {
        const rootClass = this.dsHandler.generateDsClass(this.browser.ds['@graph'][0], false, false);
        const mainContent = this.dsRenderer.createHeader() +
            this.dsRenderer.createViewModeSelectors(this.dsRenderer.MODES.table) +
            '<div id="table-view"> ' +
            this.dsRenderer.createVisBtnRow() +
            '<div id="table-wrapper">' +
            '<table id="table-ds">' +
            this.createTableContent(rootClass) +
            '</table>' +
            '</div>' +
            '</div>';

        this.browser.elem.innerHTML = this.util.createMainContent('rdfs:Class', mainContent);
        this.addClickEvent();
    }

    createTableContent(rootClass) {
        return '' +
            '<tr class="first-row-ds">' +
            '<td><div class="align-items"><img src="" class="glyphicon glyphicon-list-alt">' + rootClass.text + '</div></td>' +
            '<td colspan="2">' + rootClass.data.dsDescription + '</td>' +
            '<td><b>Cardinality</b></td>' +
            '</tr>' +
            this.processProperties(rootClass.children, 0);
    }

    processProperties(properties, depth) {
        return properties.map((property, i) => {
            if (property.children && property.children.length !== 0 && !property.isEnum) {
                return this.processPropertyWithChildren(property, depth, i);
            } else {
                return this.processPropertyWithNoChildren(property, depth);
            }
        }).join('');
    }

    processPropertyWithChildren(property, depth, propertyNumber) {
        let csClass, html = '';
        depth++;
        if (depth < 4) {
            csClass = 'depth' + depth + ' innerTable';
            const terms = (property.data.dsRange).split(' or ');
            const dsRange = this.createDSRange(property, depth, propertyNumber, terms);
            let properties = property.children;
            html += '' +
                '<tr>' +
                this.createTdProperty(property) +
                '<td colspan="2" class="' + csClass + '">' +
                '<table>' +
                this.createInnerTableHeader(dsRange, property) +
                this.processProperties(properties[0].children, depth) + // show first class defaultly, can be changed via click
                '</table>' +
                '</td>' +
                '<td class="cardinality">' +
                this.dsHandler.createCardinality(property.data.minCount, property.data.maxCount) +
                '</td>' +
                '</tr>';
        } else {
            console.log('To many levels for table view. Level: ' + depth);
        }
        return html;
    }

    isClass(term) {
        const cleanTerm = this.cleanTerm(term);
        return !['Text', 'Number', 'URL', 'Boolean'].includes(cleanTerm);
    }

    createDSRange(property, level, propertyNumber, terms) {
        return '' +
            terms.map((aTerm, i) => {
                const cleanTerm = this.cleanTerm(aTerm);
                const isClass = this.isClass(aTerm);
                const or = (i + 1 < terms.length ? '&nbsp;or  <br>' : '');

                return '' +
                    (isClass ? '<span class="align-items">' +
                        '<img src="" class="glyphicon glyphicon-list-alt">' +
                        '<b>' + cleanTerm + '</b>' + or + '</span>' : cleanTerm + or);
            }).join('');
    }

    cleanTerm(term) {
        return term.replace('<strong>', '')
            .replace('</strong>', '')
            .replace(/ /g, '');
    }

    createTdProperty(property) {
        return '' +
            '<td>' +
            '<div class="align-items">' +
            '<img class="glyphicon glyphicon-tag ' + (property.data.isOptional ? 'optional' : 'mandatory') +
            '-property" src="" />' + property.text +
            '</div>' +
            '</td>';
    }

    createInnerTableHeader(dsRange, property) {
        return '' +
            '<tr>' +
            '<td>' + dsRange + '</td>' +
            '<td colspan="2">' + property.data.dsDescription + '</td>' +
            '<td><b>Cardinality</b></td>' +
            '</tr>'

    }

    processPropertyWithNoChildren(property, level) {
        const cardinality = this.dsHandler.createCardinality(property.data.minCount, property.data.maxCount);

        return '' +
            '<tr>' +
            this.createTdProperty(property) +
            (property.isEnum ? this.createEnum(property, level) : this.createSimpleType(property)) +
            '<td class="cardinality">' + cardinality + '</td>' +
            '</tr>';
    }

    createEnum(property, depth) {
        depth++;
        return '' +
            '<td colspan="2" class="depth' + depth + ' innerTable">' +
            '<table class="enumTable">' +
            '<tr>' +
            '<td class="enumTd"><b>' + property.data.dsRange + '</b></td>' +
            '<td class="enumTd">' + property.data.dsDescription + '</td>' +
            '</tr>' +
            (property.data.enuMembers ? this.genHTML_enuMembers(property.data.enuMembers) : '') +
            '</table>' +
            '</td>';
    }

    genHTML_enuMembers(enuMemberArray) {
        return enuMemberArray.map((enuMember) => {
            return '' +
                '<tr>' +
                '<td class="enumTd">' + enuMember.name + '</td>' +
                '<td class="enumTd">' + enuMember.description + '</td>' +
                '</tr>';
        }).join('');
    }

    createSimpleType(property) {
        return '' +
            '<td>' + property.data.dsRange + '</td>' +
            '<td>' + property.data.dsDescription + '</td>';
    }

    addClickEvent() {
        const divTableView = document.getElementById('table-view');
        const button = divTableView.getElementsByClassName('btn-vis-shadow')[0];
        this.clickHandler = this.clickEvent.bind(this);
        button.addEventListener('click', this.clickHandler, true);
    }

    clickEvent(event) {
        const button = event.target;
        button.removeEventListener('click', this.clickHandler, true);

        button.classList.remove('btn-vis-shadow');
        let otherButton, showOptional;
        if (button.id === 'btn-opt') {
            otherButton = document.getElementById('btn-man');
            showOptional = true;
        } else {
            otherButton = document.getElementById('btn-opt');
            showOptional = false;
        }

        otherButton.classList.add('btn-vis-shadow');
        const rootClass = this.dsHandler.generateDsClass(this.browser.ds['@graph'][0], false, showOptional);
        document.getElementById('table-ds').innerHTML = this.createTableContent(rootClass);

        this.addClickEvent();
    }
}

module.exports = TableRenderer;
