class TableRenderer {
    constructor(browser) {
        this.browser = browser;
        this.util = browser.util;
        this.dsHandler = browser.dsHandler;
        this.dsRenderer = browser.dsRenderer;
        this.clickHandler = null; // see: https://stackoverflow.com/questions/33859113/javascript-removeeventlistener-not-working-inside-a-class
        this.changeInnerDSHandler = null;
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
        this.addChangeInnerDSEventListener();
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

    processProperties(properties, depth, innerDSIndex, hasMultipleClasses) {
        return properties.map((property, i) => {
            if (property.children && property.children.length !== 0 && !property.isEnum) {
                return this.processPropertyWithChildren(property, depth, innerDSIndex);
            } else {
                return this.processPropertyWithNoChildren(
                    property, depth, innerDSIndex, hasMultipleClasses, (properties.length === (i + 1)));
            }
        }).join('');
    }

    processPropertyWithChildren(property, depth) {
        let csClass, html = '';
        depth++;
        if (depth < 4) {
            csClass = 'depth' + depth + ' innerTable';
            const terms = (property.data.dsRange).split(' or ');
            const hasMultipleClasses = this.hasMultipleClasses(terms);
            const dsRange = this.createDSRange(property, depth, terms, hasMultipleClasses);
            const properties = property.children;
            html += '' +
                '<tr>' +
                this.createTdProperty(property) +
                '<td colspan="2" class="' + csClass + '">' +
                '<table>' +
                this.createInnerTableHeader(dsRange, property) +
                properties.map((p, i) => this.processProperties(p.children, depth, i, hasMultipleClasses)).join('') + // show first class defaultly, can be changed via click
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

    hasMultipleClasses(terms) {
        let classCount = 0;

        for (const term of terms) {
            if (this.isClass(term)) {
                classCount++;
                if (classCount === 2) {
                    return true;
                }
            }
        }
        return false;
    }

    isClass(term) {
        const cleanTerm = this.cleanTerm(term);
        return !['Text', 'Number', 'URL', 'Boolean'].includes(cleanTerm);
    }

    createDSRange(property, level, terms) {
        let otherClassExists = false;
        return '' +
            terms.map((aTerm, i) => {
                const cleanTerm = this.cleanTerm(aTerm);
                const isClass = this.isClass(cleanTerm);
                const or = (i + 1 < terms.length ? '&nbsp;or  <br>' : '');
                const classes = ((otherClassExists && isClass) ? ' class="change-to-class"' : '');

                if (isClass) {
                    otherClassExists = true;
                    return '' +
                        '<span class="align-items">' +
                        '<img src="" class="glyphicon glyphicon-list-alt">' +
                        '<b' + classes + ' data-innerdsindex="' + i + '">' + cleanTerm + '</b>' + or + '</span>';
                } else {
                    return cleanTerm + or;
                }
            }).join('');
    }

    cleanTerm(term) {
        return term.replace('<strong>', '')
            .replace('</strong>', '')
            .replace(/ /g, '');
    }

    createTdProperty(property, rmBorderBottom='') {
        return '' +
            '<td' + rmBorderBottom  + '>' +
            '<div class="align-items">' +
            '<img class="glyphicon glyphicon-tag ' + (property.data.isOptional ? 'optional' : 'mandatory') +
            '-property" src="" />' + property.text +
            '</div>' +
            '</td>';
    }

    createInnerTableHeader(dsRange, property) {
        return '' +
            '<tr>' +
            '<td data-innerdsindex="0">' + dsRange + '</td>' +
            '<td colspan="2">' + property.data.dsDescription + '</td>' +
            '<td><b>Cardinality</b></td>' +
            '</tr>'

    }

    processPropertyWithNoChildren(property, level, innerDSIndex, hasMultipleClasses, isLastProperty) {
        const cardinality = this.dsHandler.createCardinality(property.data.minCount, property.data.maxCount);
        const displayNone = (innerDSIndex !== 0 && hasMultipleClasses ? ' style="display: none;"' : '');
        const rmBorderBottom = (isLastProperty ? ' style="border-bottom: none !important;"' : '');

        return '' +
            '<tr data-innerdsindex="' + innerDSIndex + '"' + displayNone + '>' +
            this.createTdProperty(property, rmBorderBottom) +
            (property.isEnum ? this.createEnum(property, level, rmBorderBottom) :
                this.createSimpleType(property, rmBorderBottom)) +
            '<td class="cardinality"' + rmBorderBottom + '>' + cardinality + '</td>' +
            '</tr>';
    }

    createEnum(property, depth, rmBorderBottom) {
        depth++;
        return '' +
            '<td colspan="2" class="depth' + depth + ' innerTable"' + rmBorderBottom + '>' +
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

    createSimpleType(property, rmBorderBottom) {
        return '' +
            '<td' + rmBorderBottom +'>' + property.data.dsRange + '</td>' +
            '<td' + rmBorderBottom + '>' + property.data.dsDescription + '</td>';
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
        const table = document.getElementById('table-ds');
        table.innerHTML = this.createTableContent(rootClass);
        this.util.fade(table);

        this.addClickEvent();
        this.addChangeInnerDSEventListener();
    }


    addChangeInnerDSEventListener() {
        const divTableView = document.getElementById('table-view');
        const buttons = divTableView.getElementsByClassName('change-to-class');
        this.changeInnerDSHandler = this.changeInnerDSEvent.bind(this);

        for (const button of buttons) {
            button.addEventListener('click', this.changeInnerDSHandler, true);
        }
    }

    changeInnerDSEvent(event) {
        const button = event.target;
        let tr = button.closest('tr');
        const newIndex = button.dataset.innerdsindex;
        while(tr.nextSibling) {
            tr = tr.nextSibling;
            if (tr.dataset.innerdsindex === newIndex) {
                tr.style.display = 'table-row';
                this.util.fade(tr);
            } else {
                tr.style.display = 'none';
            }
        }

        const otherButton = button.closest('td').querySelector('b:not(.change-to-class)');
        otherButton.classList.add('change-to-class');

        otherButton.addEventListener('click', this.changeInnerDSHandler, true);

        button.classList.remove('change-to-class');
        button.removeEventListener('click', this.changeInnerDSHandler, true);
    }
}

module.exports = TableRenderer;
