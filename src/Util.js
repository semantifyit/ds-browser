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
        const schema = 'schema:';
        if (iri.startsWith(schema)) {
            return iri.substring(schema.length);
        }
        return this.escHtml(iri);
    }

    makeURLFromIRI(IRITerm) {
        const vocabularies = this.browser.sdoAdapter.getVocabularies();
        const vocabKeys = Object.keys(vocabularies);
        vocabKeys.forEach((vocabKey) => {
            if (IRITerm.startsWith(vocabKey)) {
                return vocabularies[vocabKey] + IRITerm.substring(IRITerm.indexOf(':') + 1);
            }
        });

        return '';
    }

    repairLinksInHTMLCode(htmlCode) {
        return htmlCode.replace(/<a(.*?)href="(.*?)"/g, (match, group1, group2) => {
            if (group2.startsWith('/')) {
                group2 = 'http://schema.org' + group2;
            }

            let style = '' +
                'background-position: center right; ' +
                'background-repeat: no-repeat; ' +
                'background-size: 10px 10px; ' +
                'padding-right: 13px; ';
            if ((/^https?:\/\/schema.org/).test(group2)) {
                style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-red.png);';
            } else {
                style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-blue.png);';
            }

            return '<a' + group1 + 'href="' + group2 + '" style="' + style + '" target="_blank"';
        });
    }

    // Get the corresponding SDO datatype from a given SHACL XSD datatype
    dataTypeMapperFromSHACL(dataType) {
        switch (dataType) {
            case 'xsd:string':
                return 'Text';
            case 'xsd:boolean' :
                return 'Boolean';
            case 'xsd:date' :
                return 'Date';
            case 'xsd:dateTime':
                return 'DateTime';
            case 'xsd:time':
                return 'Time';
            case 'xsd:double':
                return 'Number';
            case 'xsd:float':
                return 'Float';
            case  'xsd:integer':
                return 'Integer';
            case 'xsd:anyURI':
                return 'URL';
        }
        return null; // If no match
    }

    // Converts a range array/string into a string usable in functions
    rangesToString(ranges) {
        if (Array.isArray(ranges)) {
            return ranges.map((range) => {
                return this.prettyPrintIri(range);
            }).join(' + ');
        } else {
            return this.prettyPrintIri(ranges); // Is already string
        }
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
    createJSLink(queryKey, queryVal, enhanceSymbol = null, text = null, attr = null) {
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
    createExternalLink(href, text = null, attr = null) {
        let additionalStyles = ' ' + this.createExternalLinkStyle(href);

        if (!attr) {
            attr = {style: additionalStyles};
        } else if (!attr.hasOwnProperty('style')) {
            attr['style'] = additionalStyles;
        } else {
            attr['style'] = attr['style'] + additionalStyles;
        }

        return '<a href="' + this.escHtml(href) + '" target="_blank"' + this.createHtmlAttr(attr) + '>' +
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
        if (iri.indexOf('https://schema.org') === -1 && iri.indexOf('http://schema.org') === -1) {
            style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-blue.png);';
        } else {
            style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-red.png);'
        }
        return style;
    }

    /**
     * Create a HTML table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
     *
     * @param {string} rdfaTypeOf - The RDFa type of the table row.
     * @param {string} rdfaResource - The RDFa resource.
     * @param {string} mainColRdfaProp - The RDFa property of the main column.
     * @param {string} mainColTermOrLink - The term name that should be linked or the link of the main column.
     * @param {string} sideCols - The HTML of the side columns.
     * @param {string|null} mainColClass - The CSS class of the main column.
     * @returns {string} The resulting HTML.
     */
    createTableRow(rdfaTypeOf, rdfaResource, mainColRdfaProp, mainColTermOrLink, sideCols, mainColClass = null) {
        return '' +
            '<tr typeof="' + rdfaTypeOf + '" resource="' + rdfaResource + '">' +
            this.createMainCol(mainColRdfaProp, mainColTermOrLink, mainColClass) +
            sideCols +
            '</tr>';
    }

    /**
     * Create a HTML main column for a table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
     *
     * @param {string} rdfaProp - The RDFa property of the column.
     * @param {string} termOrLink - The term name that should be linked or the link of the column.
     * @param {string|null} className -  The CSS class of the column.
     * @returns {string} The resulting HTML.
     */
    createMainCol(rdfaProp, termOrLink, className = null) {
        return '' +
            '<th' + (className ? ' class="' + className + '"' : '') + ' scope="row">' +
            this.createCodeLink(termOrLink, {'property': rdfaProp}) +
            '</th>';
    }

    /**
     * Create a HTML code element with a link inside it.
     *
     * @param {string} termOrLink - The term name that should be linked or the link.
     * @param {object|null} codeAttr - The HTML attributes of the code element.
     * @param {object|null} linkAttr - The HTML attributes of the link.
     * @param {string|null} rdfaProp - The RDFa property of the link.
     * @returns {string} The resulting HTML.
     */
    createCodeLink(termOrLink, codeAttr = null, linkAttr = null, rdfaProp = null) {
        return '' +
            '<code' + this.createHtmlAttr(codeAttr) + '>' +
            this.createFullLink(termOrLink, linkAttr, rdfaProp) +
            '</code>';
    }

    /**
     * Create a HTML link, optionally with semantic attributes.
     *
     * @param termOrLink - The term name that should be linked or a link.
     * @param linkAttr - The HTML attributes of the link.
     * @param rdfaProp - The RDFa property of the link.
     * @returns {string} The resulting HTML.
     */
    createFullLink(termOrLink, linkAttr, rdfaProp) {
        let term = null;
        try {
            term = this.browser.sdoAdapter.getTerm(termOrLink);
        } catch (e) {
        }
        return '' +
            (rdfaProp ? this.createSemanticLink(rdfaProp, termOrLink) : '') +
            (term ? this.createLink(termOrLink, linkAttr) : termOrLink);
    }

    /**
     * Create a HTML semantic link for a term.
     *
     * @param {string} property - The RDFa property of the link.
     * @param {string} term - The vocabulary term.
     * @returns {string} The resulting HTML.
     */
    createSemanticLink(property, term) {
        return '<link property="' + this.escHtml(property) + '" href="' + this.escHtml(this.createHref(term)) + '">';
    }

    /**
     * Create a HTML href for a vocabulary term.
     *
     * @param {string} term - The vocabulary term.
     * @returns {string} The resulting HTML.
     */
    createHref(term) {
        /*
        if (this.isTermOfVocab(term)) {
            return this.createIriWithQueryParam('term', term);
        } else {

         */

            return this.browser.sdoAdapter.getTerm(term).getIRI();
        //}
    }

    /**
     * Create a HTML link for a term.
     *
     * @param {string} term - The vocabulary term.
     * @param {object|null} attr - The HTML attributes as key-value pairs.
     * @returns {string} The resulting HTML.
     */
    createLink(term, attr = null) {
        /*
        if (this.isTermOfVocab(term)) {
            return this.createJSLink('term', term, null, attr);
        } else {*/
            return this.createExternalLink(this.createHref(term), term, attr);
        //}
    }

    /**
     * Create a HTML table with class 'definition-table'.
     *
     * @param {string|string[]} ths - The table header cell/s. Must include <th> tags.
     * @param {string|string[]} trs - The table body row/s. Can already include <tr> tags to be more flexible.
     * @param {object|null} tbodyAttr - The HTML attributes of the table body.
     * @returns {string} The resulting HTML.
     */
    createDefinitionTable(ths, trs, tbodyAttr=null) {
        if (!Array.isArray(ths)) {
            ths = [ths];
        }
        if (!Array.isArray(trs)) {
            trs = [trs];
        }
        return '' +
            '<table class="definition-table">' +
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
        return '' +
            '<div id="mainContent" vocab="http://schema.org/" typeof="' + rdfaTypeOf + '" ' +
            'resource="' + window.location + '">' +
            mainContent +
            '</div>';
    }
}

module.exports = Util;
