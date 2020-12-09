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
            '<table id="table-ds">' +
            '<tr class="first-row-ds">' +
            '<td><img src="" class="glyphicon glyphicon-list-alt">' + rootClass.text + '</td>' +
            '<td colspan="2">' + rootClass.data.dsDescription + '</td>' +
            '<td><b>Cardinality</b></td>' +
            '</tr>' +
            this.processProperties(rootClass.children, 0, rootClass._id) +
            '</table>';

        this.browser.elem.innerHTML = this.util.createMainContent('rdfs:Class', mainContent);
    }

    processProperties(properties, level, dsID) {
        return properties.map((property, i) => {
            if (property.children && property.children.length !== 0 && !property.isEnum) {
                return this.processPropertyWithChildren(property, level, dsID, i);
            } else {
                return this.processPropertyWithNoChildren(property, dsID);
            }
        }).join('');
    }

    processPropertyWithChildren(property, level, dsID, propertyNumber) {
        let csClass, html = '';
        level++;
        if (level < 4) {
            switch (level) {
                case 1:
                    csClass = 'secondLevel';
                    break;
                case 2:
                    csClass = 'thirdLevel';
                    break;
                case 3:
                    csClass = 'fourthLevel';
                    break;
                default:
                    csClass = 'firstLevel';
                    break;
            }
            csClass += ' innerTable';
            const terms = (property.data.dsRange).split(' or ');
            const isOnlyClass = this.testIsOnlyClass(terms);
            const dsRange = this.createDSRange(property, level, dsID, propertyNumber, terms, isOnlyClass);
            let properties = property.children;
            html += '' +
                '<tr>' +
                this.createTdProperty(property) +
                '<td colspan="2" class="' + csClass + '">' +
                this.createOuterTable(dsRange, property) +
                this.createInnerTable(properties, level, dsID, propertyNumber, isOnlyClass) +
                '</td>' +
                '<td class="cardinality">' +
                this.dsHandler.createCardinality(property.data.minCount, property.data.maxCount) +
                '</td>' +
                '</tr>';
        } else {
            console.log('To many levels for table view. Level: ' + level);
        }
        return html;
    }

    testIsOnlyClass(potentialClasses) {
        let isOnlyClass = true;
        let countOfClasses = 0;
        potentialClasses.forEach((potentialClass) => {
            const cleanClass = potentialClass.replace(/ /g, '');
            if (this.isClass(cleanClass)) {
                countOfClasses++;
            }
        });
        if (countOfClasses > 1) {
            isOnlyClass = false;
        }
        return isOnlyClass;
    }

    isClass(term) {
        return !['Text', 'Number', 'URL', 'Boolean'].includes(term);
    }

    createDSRange(property, level, dsID, propertyNumber, terms, isOnlyClass) {
        return '' +
            terms.map((aTerm, i) => {
                const cleanTerm = this.cleanTerm(aTerm);
                const isClass = this.isClass(cleanTerm);
                const or = (i + 1 < terms.length ? '&nbsp;or  <br>' : '');

                return '' +
                    (isClass ? '<span style="display: flex; align-items: center;">' +
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
            '<div style="display: flex; align-items: center;">' +
            '<img class="glyphicon glyphicon-tag ' + (property.data.isOptional ? 'optional' : 'mandatory') + '-property" src="" />' + property.text +
            '</div>' +
            '</td>';
    }

    createOuterTable(dsRange, property) {
        return '' +
            '<table>' +
            '<tr>' +
            '<td>' + dsRange + '</td>' +
            '<td colspan="2">' + property.data.dsDescription + '</td>' +
            '<td><b>Cardinality</b></td>' +
            '</tr>'

    }

    createInnerTable(properties, level, dsID, propertyNumber, isOnlyClass) {
        return '' +
            properties.map((property, i) => {
                if (properties.length === 1) {
                    return this.processProperties(property.children, level, dsID);
                } else {
                    const id = `${dsID}-l${level}-p${propertyNumber}-c${i}`;
                    return '' +
                        '<tr>' +
                        (isOnlyClass || i === 0 ?
                            `<tbody class="testDs" id="${id}">` :
                            `<tbody style="display: none;" class="testDs" id="${id}">`) +
                        this.processProperties(property.children, level, dsID) +
                        '</tbody>' +
                        '</tr>';
                }
            }).join('') +
            '</table>'
    }

    processPropertyWithNoChildren(property) {
        return '' +
            '<tr>' +
            this.createTdProperty(property) +
            '<td><div class="thContent">' + property.data.dsRange + '</div></td>' +
            '<td><div class="thContent">' + property.data.dsDescription + '</div> </td>' +
            `<td class="cardinality">${this.dsHandler.createCardinality(property.data.minCount, property.data.maxCount)}</div> </td>` +
            '</tr>' +
            (property.data.enuMembers ? this.genHTML_enuMembers(property.data.enuMembers) : '');
    }

    genHTML_enuMembers(enuMemberArray) {
        let code = '';
        enuMemberArray.forEach((enuMember) => {
            code += `<tr class="enuMemberTd">
          <td class="enuMemberTd"></td>
          <td>${enuMember.name}</td>
          <td>${enuMember.description}</td>
          <td class="enuMemberTd"></td>
     </tr>`;
        });
        return code;
    }

    generateTableHelpContent() {
        // TODO
        return '' +
            '<div class="">' +
            'Here comes a description to: </br><h4>how to read the Table View of a DomainSpecifciation</h4>' +
            '</div>';
    }
}

module.exports = TableRenderer;
