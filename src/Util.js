class Util {
    constructor(browser) {
        this.browser = browser;
    }

    async parseToObject(variable) {
        if (this.isString(variable)) {
            /**
             * @type string
             */
            let jsonString;
            if (this.isValidUrl(variable)) {
                jsonString = await this.getJson(variable);
            } else {
                jsonString = variable;
            }
            return JSON.parse(jsonString);
        } else {
            return variable;
        }
    }

    isString(variable) {
        return (typeof variable === 'string' || variable instanceof String);
    }

    isValidUrl(string) {
        try {
            new URL(string);
        } catch (_) {
            return false;
        }
        return true;
    }

    getJson(url) {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        });
    }

    /**
     * Replace 'schema:' and escapes characters in iri.
     *
     * @param {string} iri - The IRI that should pretty-printed.
     * @returns {string} The pretty-printed IRI.
     */
    prettyPrintIri(iri) {
        return iri.replace(/^(schema:|https?:\/\/schema.org\/)(.+)/, '$2');
    }

    repairLinksInHTMLCode(htmlCode) {
        return htmlCode.replace(/<a(.*?)href="(.*?)"/g, (match, group1, group2) => {
            if (group2.startsWith('/')) {
                group2 = 'http://schema.org' + group2;
            }

            const style = this.createExternalLinkStyle(group2);
            return '<a' + group1 + 'href="' + group2 + '" style="' + style + '" target="_blank"';
        });
    }

    /**
     * Create an IRI with the current browser IRI and the given query parameter.
     * The query parameter can be either set, overwritten, deleted or enhanced.
     *
     * @param {string} key - The query parameter key.
     * @param {string} val - The query parameter values.
     * @param {string|null} enhanceSymbol - TODO
     * @returns {string} The resulting IRI.
     */
    createIriWithQueryParam(key, val, enhanceSymbol = null) {
        const searchParams = new URLSearchParams(window.location.search);
        if (val && val !== '') {
            const prevVal = searchParams.get(key);
            if (prevVal !== null && enhanceSymbol) {
                searchParams.set(key, prevVal + enhanceSymbol + val);
            } else {
                searchParams.set(key, val);
            }
        } else {
            searchParams.delete(key);
        }
        const queryString = searchParams.toString();
        const origin = window.location.protocol + '//' + (window.location.host ? window.location.host : '');
        return origin + window.location.pathname + (queryString !== '' ? '?' + queryString : '');
    }

    /**
     * Create a HTML JavaScript link that imitates a standard link with the current browser IRI and the given query
     * parameter.
     *
     * @param {string} queryKey - The query parameter key.
     * @param {string|null} queryVal - The query parameter value.
     * @param {string|null} enhanceSymbol - TODO
     * @param {string|null} text - The text of the link.
     * @param {object|null} attr - The HTML attributes of the link.
     * @returns {string} The resulting HTML.
     */
    createJSLink(queryKey, queryVal, text = null, attr = null, enhanceSymbol = null) {
        const iri = this.createIriWithQueryParam(queryKey, queryVal, enhanceSymbol);
        return '' +
            '<a ' +
            'class="a-js-link" ' +
            'href="' + this.escHtml(iri) + '" ' +
            'onclick="return false;"' +
            this.createHtmlAttr(attr) + '>' +
            (text ? this.escHtml(text) : this.escHtml(queryVal)) +
            '</a>';
    }

    /**
     * Escape HTML characters.
     *
     * @param {string} chars - The characters that should be escaped.
     * @returns {string} The escaped characters.
     */
    escHtml(chars) {
        return chars
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Create HTML attributes for elements.
     *
     * @param {object|null} attr - The attributes as key-value pairs.
     * @returns {string} The resulting HTML.
     */
    createHtmlAttr(attr) {
        if (attr) {
            return Object.entries(attr).map((a) => {
                return ' ' + this.escHtml(a[0]) + '="' + this.escHtml(a[1]) + '"';
            }).join('');
        } else {
            return '';
        }
    }

    /**
     * Create a HTML link to an external IRI.
     *
     * @param {string} href - The href value of the link.
     * @param {string|null} text - The text of the link.
     * @param {object|null} attr - The HTML attributes as key-value pairs.
     * @returns {string} The resulting HTML.
     */
    createLink(href, text = null, attr = null) {
        const urlObj = new URL(href);
        if (window.location.hostname !== urlObj.hostname) {
            let additionalStyles = ' ' + this.createExternalLinkStyle(href);

            if (!attr) {
                attr = {style: additionalStyles};
            } else if (!attr.hasOwnProperty('style')) {
                attr['style'] = additionalStyles;
            } else {
                attr['style'] = attr['style'] + additionalStyles;
            }
            attr['target'] = '_blank';
        }

        return '<a href="' + this.escHtml(href) + '"' +  this.createHtmlAttr(attr) + '>' +
            (text ? this.prettyPrintIri(text) : this.prettyPrintIri(href)) + '</a>';
    }

    /**
     * Create HTML attribute 'style' for an external link.
     *
     * @param iri - The IRI of the external link.
     * @return {string} The resulting style attribute.
     */
    createExternalLinkStyle(iri) {
        let style = '' +
            'background-position: center right; ' +
            'background-repeat: no-repeat; ' +
            'background-size: 10px 10px; ' +
            'padding-right: 13px; ';
        if ((/^https?:\/\/schema.org/).test(iri)) {
            style += 'background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-red.png);';
        } else {
            style += 'background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-blue.png);'
        }
        return style;
    }

    /**
     * Create a HTML table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
     *
     * @param {string} rdfaTypeOf - The RDFa type of the table row.
     * @param {string} rdfaResource - The RDFa resource.
     * @param {string} mainColRdfaProp - The RDFa property of the main column.
     * @param {string} mainColLink - The link of the main column.
     * @param {string} sideCols - The HTML of the side columns.
     * @param {string|null} mainColClass - The CSS class of the main column.
     * @returns {string} The resulting HTML.
     */
    createTableRow(rdfaTypeOf, rdfaResource, mainColRdfaProp, mainColLink, sideCols, mainColClass = null) {
        return '' +
            '<tr typeof="' + rdfaTypeOf + '" resource="' + rdfaResource + '">' +
            this.createMainCol(mainColRdfaProp, mainColLink, mainColClass) +
            sideCols +
            '</tr>';
    }

    /**
     * Create a HTML main column for a table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
     *
     * @param {string} rdfaProp - The RDFa property of the column.
     * @param {string} link - The link of the column.
     * @param {string|null} className -  The CSS class of the column.
     * @returns {string} The resulting HTML.
     */
    createMainCol(rdfaProp, link, className = null) {
        return '' +
            '<th' + (className ? ' class="' + className + '"' : '') + ' scope="row">' +
            this.createCodeLink(link, {'property': rdfaProp}) +
            '</th>';
    }

    /**
     * Create a HTML code element with a link inside it.
     *
     * @param {string} link - The link.
     * @param {object|null} codeAttr - The HTML attributes of the code element.
     * @returns {string} The resulting HTML.
     */
    createCodeLink(link, codeAttr = null) {
        return '' +
            '<code' + this.createHtmlAttr(codeAttr) + '>' +
            link +
            '</code>';
    }

    /**
     * Create a HTML table with class 'definition-table'.
     *
     * @param {string|string[]} ths - The table header cell/s. Must include <th> tags.
     * @param {string|string[]} trs - The table body row/s. Can already include <tr> tags to be more flexible.
     * @param {object|null} tableAttr - The HTML attributes of the table.
     * @param {object|null} tbodyAttr - The HTML attributes of the table body.
     * @returns {string} The resulting HTML.
     */
    createDefinitionTable(ths, trs, tableAttr=null, tbodyAttr=null) {
        if (!Array.isArray(ths)) {
            ths = [ths];
        }
        if (!Array.isArray(trs)) {
            trs = [trs];
        }
        return '' +
            '<table class="definition-table"' + this.createHtmlAttr(tableAttr) + '>' +
            '<thead>' +
            '<tr>' +
            ths.map((th) => {
                return '<th>' + th + '</th>';
            }).join('') +
            '</tr>' +
            '</thead>' +
            '<tbody' + this.createHtmlAttr(tbodyAttr) + '>' +
            (trs[0].startsWith('<tr') ? trs.join('') : trs.map((tr) => {
                return '<tr>' + tr + '</tr>';
            }).join('')) +
            '</tbody>' +
            '</table>';
    }

    /**
     * Create a HTML div with the main content for the vocab browser element.
     *
     * @param {string} rdfaTypeOf - The RDFa type of the main content.
     * @param {string} mainContent - The HTML of the main content.
     * @returns {string} The resulting HTML.
     */
    createMainContent(rdfaTypeOf, mainContent) {
        return `
            <div>
                <div id="mainContent" vocab="http://schema.org/" typeof="${rdfaTypeOf}" resource="${window.location}">
                    ${mainContent}
                </div>
            </div>`;
    }

    createExternalLinkLegend() {
        const commonExtLinkStyle = 'margin-right: 3px; ';
        const extLinkStyleBlue = commonExtLinkStyle + this.createExternalLinkStyle('');
        const extLinkStyleRed = commonExtLinkStyle + this.createExternalLinkStyle('http://schema.org') +
            ' margin-left: 6px;';

        return '' +
            '<p style="font-size: 12px; margin-top: 0">' +
            '(<span style="' + extLinkStyleBlue + '"></span>External link' +
            '<span style="' + extLinkStyleRed + '"></span>External link to schema.org )' +
            '</p>';
    }

    createTermLink(term) {
        const termObj = this.browser.sdoAdapter.getTerm(term);
        const vocabURLs = termObj.getVocabURLs();
        let href;
        if (vocabURLs) {
            for (const vocabURL of vocabURLs) {
                if (/http(s)?:\/\/(staging\.)?semantify\.it\/voc\//.test(vocabURL)) {
                    href = vocabURL + '?term=' + term;
                    break;
                }
            }
        }
        href = (href ? href : termObj.getIRI());
        return this.createLink(href, termObj.getIRI(true));
    }

    prettyPrintClassDefinition(classDef) {
        // ClassDefinition can be a string, or an array of strings (MTE)
        // ClassDefinition include strings with the vocab indicator in them
        // Remove vocab if it is the standard schema:
        // Return a human readable string of the classDefinition
        if (Array.isArray(classDef)) {
            return classDef.map((classDefPart) => {
                return this.prettyPrintIri(classDefPart);
            }).join(', ');
        } else {
            return this.prettyPrintIri(classDef);
        }
    }

    fade(element) {
        let op = 0.05;  // initial opacity
        const timer = setInterval(() => {
            if (op >= 1){
                clearInterval(timer);
            }
            element.style.opacity = op;
            element.style.filter = 'alpha(opacity=' + op * 100 + ")";
            op += op * 0.05;
        }, 10);
    }
}

module.exports = Util;
